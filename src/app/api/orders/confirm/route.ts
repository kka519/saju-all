import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/server";
import { confirmTossPayment } from "@/lib/toss/confirm";
import { buildSajuPrompt } from "@/lib/saju/prompt";
import { generateInterpretation } from "@/lib/saju/llm";
import { fetchMyeongsikWithFallback } from "@/lib/saju/fetch-myeongsik";
import { computeZiweiForSlug, type ZiweiSummary } from "@/lib/saju/ziwei";
import { sajuInputToZiweiInput } from "@/lib/saju/route-adapters";
import { fetchDayGanji, analyzeDayTone, findGoldenSijin, routeCtaSlug } from "@/lib/saju/today-ganji";
import { computeSijinTable } from "@/lib/saju/sijin";
import { generateTodayFortuneWithRetry, formatTodayFortuneAsMarkdown } from "@/lib/saju/today-fortune-prompt";
import { pickCtaTemplate, toCtaRouting } from "@/lib/saju/cta-templates";
import { buildMyeongsikView } from "@/lib/saju/build-myeongsik-view";
import type { Oheng } from "@/lib/saju/derived";

const bodySchema = z.object({
  paymentKey: z.string().min(1),
  orderId: z.string().min(1),
  amount: z.number().int().nonnegative(),
});

// toBirthInfo / toComputeInput / fetchMyeongsikWithFallback 은 couple-reports 백그라운드
// 파이프라인과 공유하기 위해 src/lib/saju/fetch-myeongsik.ts 로 이동.

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

  // "커플 궁합 리포트"(20페이지 PDF) — 2026-07-15 합병 리서치 개편으로 채팅형
  // 700~900자 결과에서 인생 애널리스트 리포트와 동일한 비동기 파이프라인으로 전환.
  // pending 행만 만들고 즉시 응답 — 본인+상대방 명식 fetch(2회) · LLM 생성 · PDF 렌더링은
  // /api/couple-reports/[id]/generate 가 after()로 백그라운드 실행.
  // 상대방 데이터 없이 궁합 생성 불가(3중 방어의 세 번째, orders/create 서버 검증
  // 통과 후에도 재확인 — 폼/서버/이 게이트 어느 하나가 뚫려도 나머지가 막는다).
  if (product.slug === "couple-match") {
    if (!input.partner_birth_date || !input.partner_gender || !input.partner_calendar) {
      return NextResponse.json(
        { error: "상대방 정보가 없어 궁합을 생성할 수 없습니다", detail: "saju_inputs.partner_birth_date missing" },
        { status: 500 },
      );
    }
    const { data: report, error: reportErr } = await service
      .from("couple_reports")
      .insert({ order_id: order.id })
      .select("id")
      .single();
    if (reportErr || !report) {
      return NextResponse.json(
        { error: "리포트 생성 준비 실패", detail: reportErr?.message },
        { status: 500 },
      );
    }
    return NextResponse.json({ coupleReportId: report.id });
  }

  try {
    // 만세력/풀 분석: luckyloveme 키가 있으면 실제 API, 없거나 실패하면 mock 으로 fallback.
    const self = await fetchMyeongsikWithFallback(input, []);
    const myeongsik = self.myeongsik;
    const manseryeokText = self.manseryeokText;
    // fullAnalysis: luckyloveme 16종 raw json. saju_results.full_analysis (0006) 컬럼에 저장.
    // mock 폴백/API 미설정/ganji 누락 케이스에서는 null 유지.
    const fullAnalysis = self.fullAnalysis;

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

      const { result: sections, provider, model, attempts } = await generateTodayFortuneWithRetry({
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

      // 원가 관측(지시문_무료운세_잠금티저_20260721.md §5) — 무료/유료 공통 구조화 로그.
      console.log(JSON.stringify({
        event: "today-fortune-generated", variant: "paid", attempts, provider, model, dayTone: sections.dayTone,
      }));

      // interpretation_md 는 not null 컬럼이라 감사/폴백용으로 8블록을 펼친 마크다운도 채운다.
      // free-fortune/route.ts와 동일 포맷터 재사용 — 두 경로의 마크다운 조립이 갈라지지 않게.
      const flattenedMd = formatTodayFortuneAsMarkdown(sections);

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
