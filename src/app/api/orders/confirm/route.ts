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
  type BirthInfo,
  type SajuAnalysisResponse,
} from "@/lib/saju/saju-api";
import { computeZiweiForSlug, type ZiweiSummary } from "@/lib/saju/ziwei";
import {
  sajuInputToZiweiInput,
  type SajuInputRow,
} from "@/lib/saju/route-adapters";

const bodySchema = z.object({
  paymentKey: z.string().min(1),
  orderId: z.string().min(1),
  amount: z.number().int().nonnegative(),
});

// SajuInputRow 타입은 src/lib/saju/route-adapters.ts 에서 import.
// (자미두수 외 toBirthInfo / toComputeInput 어댑터는 본 route 전용이라 여기 유지.)

function toBirthInfo(input: SajuInputRow): BirthInfo {
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

function toComputeInput(input: SajuInputRow) {
  return {
    birthDate: input.birth_date,
    birthTime: input.birth_time,
    timeUnknown: input.time_unknown,
    calendar: input.calendar,
    gender: input.gender,
  };
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

  try {
    // 만세력/풀 분석: luckyloveme 키가 있으면 실제 API, 없거나 실패하면 mock 으로 fallback
    let myeongsik: Myeongsik;
    let manseryeokText: string | undefined;
    // fullAnalysis: luckyloveme 16종 raw json. saju_results.full_analysis (0006) 컬럼에 저장.
    // mock 폴백/API 미설정/ganji 누락 케이스에서는 null 유지.
    let fullAnalysis: SajuAnalysisResponse | null = null;

    if (isSajuApiConfigured()) {
      try {
        const birthInfo = toBirthInfo(input);
        const analysis = await fetchSajuAnalysis(birthInfo, [], { source: "confirm" }); // [] = 16종 전체
        const converted = ganjiToMyeongsik(analysis);
        if (converted) {
          myeongsik = converted;
          manseryeokText = formatSajuToManseryeok(analysis, birthInfo);
          // ganji 변환 성공 케이스만 fullAnalysis 보관 (mock 폴백 시 부분 데이터 저장 회피)
          fullAnalysis = analysis;
        } else {
          // ganji 필드 누락 — mock 으로 폴백
          myeongsik = await computeMyeongsik(toComputeInput(input));
        }
      } catch (apiErr) {
        // luckyloveme 호출 실패 — 결제는 이미 승인됐으므로 mock 으로 폴백해서 결과지는 무조건 생성
        console.error("[saju-api] fallback to mock:", apiErr);
        myeongsik = await computeMyeongsik(toComputeInput(input));
      }
    } else {
      myeongsik = await computeMyeongsik(toComputeInput(input));
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
