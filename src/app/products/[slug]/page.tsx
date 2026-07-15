import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { SajuForm } from "@/components/saju/SajuForm";
import { formatKRW, formatDate } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/env";
import { productsSeed } from "@/config/products.seed";

type Product = { id: string; slug: string; name: string; description: string; price: number };
type Review = { id: string; rating: number; content: string; created_at: string };

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let product: Product | null;
  let reviews: Review[] | null = null;
  let user: Awaited<ReturnType<typeof getCurrentUser>> = null;

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("products")
      .select("id, slug, name, description, price")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    product = data;

    if (product) {
      const { data: r } = await supabase
        .from("reviews")
        .select("id, rating, content, created_at")
        .eq("product_id", product.id)
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(5);
      reviews = r;
    }
    user = await getCurrentUser();
  } else {
    const seed = productsSeed.find((p) => p.slug === slug && p.is_active);
    product = seed ? { id: seed.slug, ...seed } : null;
  }

  if (!product) notFound();

  return (
    <div className="container py-12 max-w-2xl text-night-fg">
      <header className="mb-10">
        <p className="text-xs font-mono text-night-fg-muted mb-2">PRODUCT / {product.slug}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{product.name}</h1>
        <p className="mt-2 text-sm text-night-fg-soft">{product.description}</p>
        <p className="mt-5 text-2xl font-mono font-medium text-starlight">{formatKRW(product.price)}</p>
      </header>

      <section>
        <h2 className="text-sm font-semibold mb-4 text-night-fg">사주 정보 입력</h2>
        <p className="text-xs text-night-fg-soft mb-4">정확할수록 더 정밀한 결과가 나옵니다.</p>
        <SajuForm
          productId={product.id}
          productSlug={product.slug}
          isLoggedIn={!!user}
          requiresPartner={product.slug === "couple-match"}
        />
      </section>

      {reviews && reviews.length > 0 && (
        <section className="mt-16 pt-10 border-t border-night-border">
          <h2 className="text-sm font-semibold mb-5 text-night-fg">최근 후기</h2>
          <ul className="divide-y divide-night-border border-y border-night-border">
            {reviews.map((r) => (
              <li key={r.id} className="py-5">
                <div className="flex items-center justify-between text-sm">
                  <span aria-label={`${r.rating}점`}>
                    <span className="text-starlight">{"★".repeat(r.rating)}</span>
                    <span className="text-night-fg-muted">{"★".repeat(5 - r.rating)}</span>
                  </span>
                  <span className="text-xs text-night-fg-muted font-mono">{formatDate(r.created_at)}</span>
                </div>
                <p className="mt-2 text-sm text-night-fg-soft leading-relaxed">{r.content}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
