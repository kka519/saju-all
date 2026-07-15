import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { confirmTossPayment } from "@/lib/toss/confirm";
import { computeMyeongsik, type Myeongsik } from "@/lib/saju/manseryeok";
import { buildSajuPrompt } from "@/lib/saju/prompt";
import { generateInterpretation } from "@/lib/saju/llm";
import {
  isSajuApiConfigured,
  fetchSajuAnalysis,
  formatSajuToManseryeok,
  ganjiToMyeongsik,
  COUPLE_MATCH_FIELDS,
  type AnalysisField,
  type BirthInfo,
  type SajuAnalysisResponse,
} from "@/lib/saju/saju-api";
import { computeZiweiForSlug, type ZiweiSummary } from "@/lib/saju/ziwei";
import {
  sajuInputToZiweiInput,
  type SajuInputRow,
} from "@/lib/saju/route-adapters";
import { fetchDayGanji, analyzeDayTone, findGoldenSijin, routeCtaSlug } from "@/lib/saju/today-ganji";
import { computeSijinTable } from "@/lib/saju/sijin";
import { generateTodayFortuneWithRetry } from "@/lib/saju/today-fortune-prompt";
import { pickCtaTemplate, toCtaRouting } from "@/lib/saju/cta-templates";
import { buildMyeongsikView } from "@/lib/saju/build-myeongsik-view";
import type { Oheng } from "@/lib/saju/derived";

const bodySchema = z.object({
  paymentKey: z.string().min(1),
  orderId: z.string().min(1),
  amount: z.number().int().nonnegative(),
});

// SajuInputRow 타입은 src/lib/saju/route-adapters.ts 에서 import.
// (자미두수 외 toBirthInfo / toComputeInput 어댑터는 본 route 전용이라 여기 유지.)
// BirthInputLike — 본인(SajuInputRow 전체)과 상대방(partner_* 필드 5개)이 공유하는
// 최소 구조. couple-match 상대방 데이터도 이 타입으로 동일한 폴백 로직을 재사용한다.
type BirthInputLike = {
  birth_date: string;
  birth_time: string | null;
  time_unknown: boolean;
  gender: "male" | "female";
  calendar: "solar" | "lunar";
};

function toBirthInfo(input: BirthInputLike): BirthInfo {
  const [y, m, d] = input.birth_date.split("-");
  const hasTime = !input.time_unknown && !!input.birth_time;
  const [hh, mm] = hasTime ? input.birth_time!.split(":") : [undefined, undefined];
  return {
    birthYear: y,
    birthMonth: String(parseInt(m, 10)),
    birthDay: String(parseInt(d, 10)),
    ...(hasTime ? { birthHour: String(parseInt(hh!, 10)), birthMinute: String(parseInt(mm!, 10)) } : {}),
    calendarType: input.calendar === "lunar" ? "음력" : "양력",
    gender: input.gender,
  };
}

function toComputeInput(input: BirthInputLike) {
  return {
    birthDate: input.birth_date,
    birthTime: input.birth_time,
    timeUnknown: input.time_unknown,
    calendar: input.calendar,
    gender: input.gender,
  };
}

// luckyloveme API-or-mock 폴백 — 본인/상대방 공용(couple-match는 이 함수를 2회 호출,
// 서로 독립적으로 폴백된다: 본인 성공+상대 실패 조합도 허용).
// fields 생략 시 16종 전체([]) 요청 — couple-match 만 COUPLE_MATCH_FIELDS(경량)로 좁힌다.
// 이유: 두 사람 분 전체 16필드를 합치면 프롬프트가 160K+자로 커져 LLM 응답이 잘리는
// 문제가 실측 확인됨(2026-07-15) — src/lib/saju/saju-api.ts COUPLE_MATCH_FIELDS 참고.
async function fetchMyeongsikWithFallback(
  input: BirthInputLike,
  fields: AnalysisField[] = [],
): Promise<{ myeongsik: Myeongsik; manseryeokText?: string; fullAnalysis: SajuAnalysisResponse | null }> {
  if (!isSajuApiConfigured()) {
    return { myeongsik: await computeMyeongsik(toComputeInput(input)), fullAnalysis: null };
  }
  try {
    const birthInfo = toBirthInfo(input);
    const analysis = await fetchSajuAnalysis(birthInfo, fields, { source: "confirm" });
    const converted = ganjiToMyeongsik(analysis);
    if (converted) {
      return { myeongsik: converted, manseryeokText: formatSajuToManseryeok(analysis, birthInfo), fullAnalysis: analysis };
    }
    // ganji 필드 누락 — mock 으로 폴백
    return { myeongsik: await computeMyeongsik(toComputeInput(input)), fullAnalysis: null };
  } catch (apiErr) {
    // luckyloveme 호출 실패 — 결제는 이미 승인됐으므로 mock 으로 폴백해서 결과지는 무조건 생성
    console.error("[saju-api] fallback to mock:", apiErr);
    return { myeongsik: await computeMyeongsik(toComputeInput(input)), fullAnalysis: null };
  }
}

// sajuInputToZiweiInput 어댑터는 src/lib/saju/route-adapters.ts 로 이동.

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
  }
  const { paymentKey, orderId, amount } = parsed.data;

  const service = createServiceClient();

  // 1. DB의 주문과 amount 일치 검증 (위변조 차단)
  const { data: order, error: orderErr } = await service
    .from("orders")
    .select("id, amount, status, product_id, user_id, guest_email")
    .eq("order_id", orderId)
    .maybeSingle();

  if (orderErr || !order) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다" }, { status: 404 });
  }
  if (order.status === "paid") {
    // idempotent: 이미 결제된 주문 — 결과 페이지로 안내
    const { data: result } = await service
      .from("saju_results")
      .select("id")
      .eq("order_id", order.id)
      .maybeSingle();
    return NextResponse.json({ resultId: result?.id ?? null, alreadyPaid: true });
  }
  if (order.amount !== amount) {
    return NextResponse.json({ error: "금액이 일치하지 않습니다" }, { status: 400 });
  }

  // 2. 토스 confirm
  const toss = await confirmTossPayment({ paymentKey, orderId, amount });
  if (!toss.ok) {
    await service.from("orders").update({ status: "failed" }).eq("id", order.id);
    return NextResponse.json({ error: toss.error.message, code: toss.error.code }, { status: 402 });
  }
  if (toss.data.totalAmount !== amount) {
    await service.from("orders").update({ status: "failed" }).eq("id", order.id);
    return NextResponse.json({ error: "토스 응답 금액 불일치" }, { status: 400 });
  }

  await service
    .from("orders")
    .update({
      status: "paid",
      toss_payment_key: paymentKey,
      paid_at: toss.data.approvedAt,
    })
    .eq("id", order.id);

  // 3. 사주 생성
  const { data: input } = await service
    .from("saju_inputs")
    .select("*")
    .eq("order_id", order.id)
    .single();
  const { data: product } = await service
    .from("products")
    .select("slug, name")
    .eq("id", order.product_id)
    .single();

  if (!input || !product) {
    return NextResponse.json({ error: "사주 입력 또는 상품 조회 실패" }, { status: 500 });
  }

  // "인생 애널리스트 리포트"는 4파트 LLM 호출 + 차트 + PDF 렌더링까지 1~3분 걸려
  // 이 결제-확인 요청 안에서 동기 처리하지 않는다. pending 행만 만들고 즉시 응답 —
  // 실제 생성은 /api/reports/[id]/generate 가 after()로 백그라운드 실행.
  if (product.slug === "life-analyst-report") {
    const { data: report, error: reportErr } = await service
      .from("life_analyst_reports")
      .insert({ order_id: order.id })
      .select("id")
      .single();
    if (reportErr || !report) {
      return NextResponse.json(
        { error: "리포트 생성 준비 실패", detail: reportErr?.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ reportId: report.id });
  }

  try {
    // 만세력/풀 분석: luckyloveme 키가 있으면 실제 API, 없거나 실패하면 mock 으로 fallback.
    // couple-match 는 본인도 경량 필드셋 사용(상대방과 합쳐질 때 프롬프트 과다 방지).
    const selfFields = product.slug === "couple-match" ? COUPLE_MATCH_FIELDS : [];
    const self = await fetchMyeongsikWithFallback(input, selfFields);
    const myeongsik = self.myeongsik;
    const manseryeokText = self.manseryeokText;
    // fullAnalysis: luckyloveme 16종 raw json. saju_results.full_analysis (0006) 컬럼에 저장.
    // mock 폴백/API 미설정/ganji 누락 케이스에서는 null 유지.
    const fullAnalysis = self.fullAnalysis;

    // couple-match 상대방 데이터 — 2026-07-15 결함 수정: 상대방 없이 궁합 생성 불가(3중 방어의
    // 세 번째, orders/create 서버 검증 통과 후에도 재확인). 본인과 완전히 독립적으로 폴백된다
    // (본인 API 성공 + 상대 API 실패 조합도 허용).
    let partnerMyeongsik: Myeongsik | undefined;
    let partnerManseryeokText: string | undefined;
    let partnerFullAnalysis: SajuAnalysisResponse | null = null;
    if (product.slug === "couple-match") {
      if (!input.partner_birth_date || !input.partner_gender || !input.partner_calendar) {
        return NextResponse.json(
          { error: "상대방 정보가 없어 궁합을 생성할 수 없습니다", detail: "saju_inputs.partner_birth_date missing" },
          { status: 500 },
        );
      }
      const partnerFetch = await fetchMyeongsikWithFallback(
        {
          birth_date: input.partner_birth_date,
          birth_time: input.partner_birth_time ?? null,
          time_unknown: input.partner_time_unknown ?? false,
          gender: input.partner_gender,
          calendar: input.partner_calendar,
        },
        COUPLE_MATCH_FIELDS,
      );
      partnerMyeongsik = partnerFetch.myeongsik;
      partnerManseryeokText = partnerFetch.manseryeokText;
      partnerFullAnalysis = partnerFetch.fullAnalysis;
    }

    // today-fortune 전용 파이프라인 — 해설가이드.md 5장(2026-07-14) "퍼널 입구 상품" 사양.
    // 6블록 구조화 출력이라 다른 두리 상품의 자유 마크다운 경로(아래 STEP 3)와 분리한다.
    if (product.slug === "today-fortune") {
      const today = new Date();
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const [todayGanji, tomorrowGanji] = await Promise.all([
        fetchDayGanji(today),
        fetchDayGanji(tomorrow),
      ]);
      const sijinTable = computeSijinTable(todayGanji.cheongan);

      // 용신/희신/기신 오행 — full_analysis 있을 때만 채워짐(mock 폴백이면 undefined,
      // analyzeDayTone 이 관계 점수만으로 판정하도록 안전하게 흡수).
      const view = buildMyeongsikView(myeongsik, fullAnalysis);
      const { tone: dayTone, relations, ohengNote } = analyzeDayTone(todayGanji, myeongsik, {
        yongsinOheng: view.yongsin?.오행 as Oheng | undefined,
        huisinOheng: view.gyeokguk?.희신오행 as Oheng | undefined,
        gisinOheng: view.gyeokguk?.기신오행 as Oheng | undefined,
      });

      const goldenSijin = findGoldenSijin(sijinTable, myeongsik, {
        yongsinOheng: view.yongsin?.오행 as Oheng | undefined,
        huisinOheng: view.gyeokguk?.희신오행 as Oheng | undefined,
        gisinOheng: view.gyeokguk?.기신오행 as Oheng | undefined,
      });

      const targetSlug = routeCtaSlug(input.concerns);
      const ctaTemplateId = pickCtaTemplate(toCtaRouting(targetSlug), dayTone);

      const { result: sections, provider, model } = await generateTodayFortuneWithRetry({
        myeongsik,
        manseryeokText,
        birthDate: input.birth_date,
        gender: input.gender,
        todayGanji,
        tomorrowGanji,
        sijinTable,
        dayTone,
        relations,
        ohengNote,
        goldenSijin,
        ctaTemplateId,
      });

      // interpretation_md 는 not null 컬럼이라 감사/폴백용으로 8블록을 펼친 마크다운도 채운다.
      const flattenedMd = [
        `## ${sections.headline}`,
        ``,
        sections.psychSnipe,
        ``,
        sections.weatherReason,
        ``,
        `**오전** ${sections.flow.morning}`,
        `**오후** ${sections.flow.afternoon}`,
        `**저녁** ${sections.flow.evening}`,
        `**골든타임** ${sections.goldenTimeLabel}`,
        ``,
        `**취할 것**: ${sections.point.take}`,
        `**피할 것**: ${sections.point.avoid}`,
        ``,
        sections.check,
        ``,
        sections.teaserCta.teaser,
        ``,
        `**내일** ${sections.tomorrow}`,
      ].join("\n");

      const { data: savedResult, error: resultErr } = await service
        .from("saju_results")
        .insert({
          order_id: order.id,
          myeongsik: myeongsik as never,
          astrolabe: null,
          full_analysis: (fullAnalysis ?? null) as never,
          today_fortune: { ...sections, targetSlug } as never,
          interpretation_md: flattenedMd,
          llm_provider: provider,
          llm_model: model,
        })
        .select("id")
        .single();

      if (resultErr || !savedResult) {
        return NextResponse.json({ error: "결과 저장 실패", detail: resultErr?.message }, { status: 500 });
      }
      return NextResponse.json({ resultId: savedResult.id });
    }

    // 자미두수 (조건부) — 4개 상품 + 시 미상 아닐 때만 계산.
    // computeZiweiForSlug 가 slug 체크 + null(시 미상) 흡수 + 에러 catch까지 일괄 처리.
    // STEP 3에서 buildSajuPrompt 인자 + saju_results.insert 의 astrolabe 컬럼에 사용.
    const ziwei: ZiweiSummary | undefined = computeZiweiForSlug(
      product.slug,
      sajuInputToZiweiInput(input),
    );

    const { system, user } = buildSajuPrompt({
      productSlug: product.slug,
      productName: product.name,
      myeongsik,
      manseryeokText,
      birthDate: input.birth_date,
      birthTime: input.birth_time,
      timeUnknown: input.time_unknown,
      gender: input.gender,
      concerns: input.concerns,
      ziwei,
      partner: partnerMyeongsik
        ? {
            myeongsik: partnerMyeongsik,
            manseryeokText: partnerManseryeokText,
            gender: input.partner_gender!,
            name: input.partner_name ?? undefined,
          }
        : undefined,
    });

    const llm = await generateInterpretation({ system, user });

    const { data: result, error: resultErr } = await service
      .from("saju_results")
      .insert({
        order_id: order.id,
        myeongsik: myeongsik as never,
        // 자미두수 4개 상품 + 시 있음일 때만 채워짐. 나머지는 null (nullable jsonb 컬럼, 0005 마이그레이션).
        astrolabe: (ziwei ?? null) as never,
        // luckyloveme 16종 풀 분석 raw json. ganji 변환 성공 시만 채움, mock 폴백은 null (0006 마이그레이션).
        full_analysis: (fullAnalysis ?? null) as never,
        // couple-match 상대방 raw/명식 — 그 외 상품은 항상 null (0010 마이그레이션).
        partner_full_analysis: (partnerFullAnalysis ?? null) as never,
        partner_myeongsik: (partnerMyeongsik ?? null) as never,
        interpretation_md: llm.text,
        llm_provider: llm.provider,
        llm_model: llm.model,
      })
      .select("id")
      .single();

    if (resultErr || !result) {
      return NextResponse.json({ error: "결과 저장 실패", detail: resultErr?.message }, { status: 500 });
    }

    return NextResponse.json({ resultId: result.id });
  } catch (err) {
    return NextResponse.json(
      {
        error: "사주 해석 생성 실패",
        detail: err instanceof Error ? err.message : String(err),
        hint: "결제는 정상 승인되었습니다. /admin/orders 에서 수동 재생성하거나 환불을 진행하세요.",
      },
      { status: 500 },
    );
  }
}
