import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";
import { MyeongsikTable } from "@/components/saju/MyeongsikTable";
import { ResultBody } from "@/components/saju/ResultBody";
import { ZiweiChart } from "@/components/saju/ZiweiChart";
import type { Myeongsik } from "@/lib/saju/manseryeok";
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
    .select("id, myeongsik, interpretation_md, llm_provider, llm_model, created_at, order_id")
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

  return (
    <div className="container py-12 max-w-2xl">
      <header className="mb-10">
        <p className="text-xs font-mono text-mute mb-2">RESULT</p>
        <h1 className="text-3xl font-semibold tracking-tight">{product?.name ?? "사주 풀이"}</h1>
        <p className="mt-2 text-xs font-mono text-mute">
          {result.llm_provider} · {result.llm_model} · {formatDate(result.created_at)}
        </p>
      </header>

      <section className="mb-12">
        <h2 className="text-sm font-semibold mb-3 text-ink">사주 명식</h2>
        <MyeongsikTable myeongsik={myeongsik} />
      </section>

      {/* 자미두수 명반 — 4개 상품(love-saju/couple-match/love-consulting/premium-saju)
          + 시 있음 일 때만 노출. 그 외(비-자미두수 5상품, 시 미상)는 섹션 자체 미렌더. */}
      {product?.slug &&
        isZiweiSlug(product.slug) &&
        sajuInput &&
        !sajuInput.time_unknown &&
        sajuInput.birth_time && (
          <section className="mb-12">
            <h2 className="text-sm font-semibold mb-3 text-ink">자미두수 명반</h2>
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
        <ResultBody markdown={result.interpretation_md} />
      </article>
    </div>
  );
}
