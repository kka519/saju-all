import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const partnerSchema = z.object({
  name: z.string().max(50).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birthTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  timeUnknown: z.boolean(),
  gender: z.enum(["male", "female"]),
  calendar: z.enum(["solar", "lunar"]),
});

const bodySchema = z.object({
  productId: z.string().uuid(),
  name: z.string().max(50).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birthTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  timeUnknown: z.boolean(),
  gender: z.enum(["male", "female"]),
  calendar: z.enum(["solar", "lunar"]),
  concerns: z.array(z.string().max(20)).max(20),
  partner: partnerSchema.optional(),
});

export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "잘못된 요청입니다", details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;

  // 로그인 필수 — 결과는 마이페이지에서 수령
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  // 가격은 서버에서만 (클라 변조 방지)
  const service = createServiceClient();
  const { data: product, error: productErr } = await service
    .from("products")
    .select("id, slug, price, is_active")
    .eq("id", body.productId)
    .maybeSingle();

  if (productErr || !product || !product.is_active) {
    return NextResponse.json({ error: "상품을 찾을 수 없습니다" }, { status: 404 });
  }

  // couple-match 는 상대방 데이터 없이 주문 자체를 생성할 수 없다(폼 검증 + 이 서버 검증 +
  // buildSajuPrompt 게이트 3중 방어 중 두 번째 — 2026-07-15 결함 수정).
  // couple-match 가 아닌데 partner 가 딸려오면 조용히 무시(저장하지 않음).
  const isCoupleMatch = product.slug === "couple-match";
  if (isCoupleMatch && !body.partner) {
    return NextResponse.json({ error: "상대방 정보를 입력해 주세요" }, { status: 400 });
  }
  const partner = isCoupleMatch ? body.partner : undefined;

  const orderId = `ord_${nanoid(20)}`;

  const { data: order, error: orderErr } = await service
    .from("orders")
    .insert({
      order_id: orderId,
      user_id: user.id,
      guest_email: null,
      product_id: product.id,
      amount: product.price,
      status: "pending",
    })
    .select("id")
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: "주문 생성 실패", detail: orderErr?.message }, { status: 500 });
  }

  const { error: inputErr } = await service.from("saju_inputs").insert({
    order_id: order.id,
    name: body.name ?? null,
    birth_date: body.birthDate,
    birth_time: body.birthTime,
    time_unknown: body.timeUnknown,
    gender: body.gender,
    calendar: body.calendar,
    concerns: body.concerns,
    partner_name: partner?.name ?? null,
    partner_birth_date: partner?.birthDate ?? null,
    partner_birth_time: partner?.birthTime ?? null,
    partner_time_unknown: partner?.timeUnknown ?? null,
    partner_gender: partner?.gender ?? null,
    partner_calendar: partner?.calendar ?? null,
  });

  if (inputErr) {
    await service.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: "사주 정보 저장 실패", detail: inputErr.message }, { status: 500 });
  }

  return NextResponse.json({ orderId, amount: product.price });
}
