import Image from "next/image";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { DaeunSeunSlider } from "@/components/saju/DaeunSeunSlider";
import { MyeongsikTable } from "@/components/saju/MyeongsikTable";
import { ResultBody } from "@/components/saju/ResultBody";
import { TodayFortuneCard, type TodayFortuneSections } from "@/components/saju/TodayFortuneCard";
import { ZiweiChart } from "@/components/saju/ZiweiChart";
import type { Myeongsik } from "@/lib/saju/manseryeok";
import { buildMyeongsikView } from "@/lib/saju/build-myeongsik-view";
import { getIljuAlias } from "@/lib/saju/gapja-alias";
import { isZiweiSlug } from "@/lib/saju/ziwei";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "결과지" };

export default async function ResultPage({
  params,
}: {
  params: Promise<{ resultId: string }>;
}) {
  const { resultId } = await params;
  const service = createServiceClient();

  const { data: result } = await service
    .from("saju_results")
    .select(
      "id, myeongsik, full_analysis, today_fortune, partner_myeongsik, partner_full_analysis, interpretation_md, llm_provider, llm_model, created_at, order_id",
    )
    .eq("id", resultId)
    .maybeSingle();

  if (!result) notFound();

  const { data: order } = await service
    .from("orders")
    .select("product_id, paid_at")
    .eq("id", result.order_id)
    .single();
  const { data: product } = order
    ? await service.from("products").select("name, slug").eq("id", order.product_id).single()
    : { data: null };

  // 자미두수 명반 시각화용 — react-iztro는 입력값을 받아 화면에서 재계산 (방향 A).
  // DB의 saju_results.astrolabe (요약본) 는 LLM 프롬프트/감사용으로만 사용, 시각화에는 미사용.
  // → 추가 select 불필요. STEP 3 에서 product.slug + saju_inputs 조건으로 명반 렌더.
  const { data: sajuInput } = order
    ? await service
        .from("saju_inputs")
        .select("birth_date, birth_time, time_unknown, calendar, gender")
        .eq("order_id", result.order_id)
        .maybeSingle()
    : { data: null };

  const myeongsik = result.myeongsik as unknown as Myeongsik;
  // 5-B.1 — full_analysis null 일 때도 안전 (buildMyeongsikView 가 hasFullData=false 모드로 흡수).
  const view = buildMyeongsikView(myeongsik, result.full_analysis);
  // 5-B.2a — 일주 별칭 (색+동물). 매핑 외 글자면 undefined 반환 → 별칭 미노출.
  const iljuAlias = getIljuAlias(
    view.pillars.day.cheongan,
    view.pillars.day.jiji,
  );

  // couple-match 상대방 명식 카드 — 2026-07-15 결함 수정. partner_myeongsik 없으면(구주문/
  // 그 외 상품) 카드 자체를 렌더하지 않는다.
  const partnerMyeongsik = result.partner_myeongsik as unknown as Myeongsik | null;
  const partnerView = partnerMyeongsik
    ? buildMyeongsikView(partnerMyeongsik, result.partner_full_analysis)
    : null;
  const partnerIljuAlias = partnerView
    ? getIljuAlias(partnerView.pillars.day.cheongan, partnerView.pillars.day.jiji)
    : undefined;

  return (
    <div className="container py-12 max-w-2xl">
      <header className="mb-10">
        <p className="text-xs font-mono text-night-fg-muted mb-2">RESULT</p>
        <h1 className="text-3xl font-semibold tracking-tight text-night-fg">
          {product?.name ?? "사주 풀이"}
        </h1>
        <p className="mt-2 text-xs font-mono text-night-fg-muted">
          {result.llm_provider} · {result.llm_model} · {formatDate(result.created_at)}
        </p>
      </header>

      <section className="mb-12">
        {/* 두리 헤더 — 명식 카드 상단. 5-B.2a 보강 — getIljuAlias("색+동물") 적용. */}
        <div className="mb-6 flex items-center gap-4">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-night-border bg-night-secondary">
            <Image
              src="/characters/doori/doori-saju.png"
              alt="두리"
              fill
              sizes="64px"
              className="object-cover"
            />
          </div>
          <div>
            <p className="text-base font-semibold text-night-fg">
              두리가 {partnerView ? "내" : "그대의"} 명식을 펼쳤어요 ✨
            </p>
            <p className="mt-1 text-sm text-night-fg-soft">
              {view.pillars.day.cheongan}
              {view.pillars.day.jiji}일주{iljuAlias ? ` · ${iljuAlias}` : ""}
            </p>
          </div>
        </div>
        <MyeongsikTable view={view} />
        <div className="mt-8">
          <DaeunSeunSlider view={view} />
        </div>
      </section>

      {/* couple-match 상대방 명식 카드 — 2026-07-15 결함 수정. */}
      {partnerView && (
        <section className="mb-12">
          <div className="mb-6">
            <p className="text-base font-semibold text-night-fg">상대방 명식이에요</p>
            <p className="mt-1 text-sm text-night-fg-soft">
              {partnerView.pillars.day.cheongan}
              {partnerView.pillars.day.jiji}일주{partnerIljuAlias ? ` · ${partnerIljuAlias}` : ""}
            </p>
          </div>
          <MyeongsikTable view={partnerView} />
        </section>
      )}

      {/* 자미두수 명반 — 4개 상품(love-saju/couple-match/love-consulting/premium-saju)
          + 시 있음 일 때만 노출. 그 외(비-자미두수 5상품, 시 미상)는 섹션 자체 미렌더. */}
      {product?.slug &&
        isZiweiSlug(product.slug) &&
        sajuInput &&
        !sajuInput.time_unknown &&
        sajuInput.birth_time && (
          <section className="mb-12">
            <h2 className="text-sm font-semibold mb-3 text-night-fg">자미두수 명반</h2>
            <ZiweiChart
              birthDate={sajuInput.birth_date}
              birthTime={sajuInput.birth_time}
              timeUnknown={sajuInput.time_unknown}
              calendar={sajuInput.calendar}
              gender={sajuInput.gender}
            />
          </section>
        )}

      <article>
        {product?.slug === "today-fortune" && result.today_fortune ? (
          <TodayFortuneCard data={result.today_fortune as unknown as TodayFortuneSections} />
        ) : (
          <ResultBody markdown={result.interpretation_md} />
        )}
      </article>
    </div>
  );
}
