import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "내 후기" };

function Stars({ value }: { value: number }) {
  return (
    <span aria-label={`${value}점`}>
      <span className="text-night-fg">{"★".repeat(value)}</span>
      <span className="text-hairline-strong">{"★".repeat(5 - value)}</span>
    </span>
  );
}

export default async function MyReviewsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/mypage/reviews");

  const service = createServiceClient();
  const { data: reviews } = await service
    .from("reviews")
    .select("id, rating, content, created_at, product_id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const productIds = Array.from(new Set((reviews ?? []).map((r) => r.product_id)));
  const { data: products } = productIds.length
    ? await service.from("products").select("id, name").in("id", productIds)
    : { data: [] };
  const productMap = new Map((products ?? []).map((p) => [p.id, p.name]));

  return (
    <div className="container py-12 max-w-2xl">
      <header className="mb-8">
        <p className="text-xs font-mono text-night-fg-muted mb-2">REVIEWS</p>
        <h1 className="text-2xl font-semibold tracking-tight">내 후기</h1>
      </header>

      {!reviews || reviews.length === 0 ? (
        <div className="text-center py-20 text-sm text-night-fg-soft">작성한 후기가 없습니다.</div>
      ) : (
        <ul className="divide-y divide-hairline border-y border-hairline">
          {reviews.map((r) => (
            <li key={r.id} className="py-5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-night-fg">{productMap.get(r.product_id) ?? "-"}</span>
                <Stars value={r.rating} />
              </div>
              <p className="mt-2 text-sm text-night-fg-soft leading-relaxed">{r.content}</p>
              <p className="mt-2 text-xs text-night-fg-muted font-mono">{formatDate(r.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
