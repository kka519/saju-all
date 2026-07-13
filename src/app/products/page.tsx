import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatKRW } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/env";
import { productsSeed } from "@/config/products.seed";

export const metadata = { title: "상품" };

type ProductCard = {
  slug: string;
  name: string;
  description: string;
  price: number;
  original_price?: number | null;
  badge_label?: string | null;
};

export default async function ProductsPage() {
  let products: ProductCard[] | null;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("products")
      .select("slug, name, description, price, original_price, badge_label")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    products = data;
  } else {
    products = productsSeed
      .filter((p) => p.is_active)
      .sort((a, b) => a.display_order - b.display_order)
      .map(({ slug, name, description, price, original_price, badge_label }) => ({
        slug,
        name,
        description,
        price,
        original_price: original_price ?? null,
        badge_label: badge_label ?? null,
      }));
  }

  return (
    <div className="container py-12 text-night-fg">
      <header className="mb-10">
        <p className="text-xs font-mono text-night-fg-muted mb-2">PRODUCTS</p>
        <h1 className="text-3xl font-semibold tracking-tight">상품</h1>
        <p className="mt-2 text-sm text-night-fg-soft">가볍게 시작해서 깊이 있게 들어가세요.</p>
      </header>

      {!products || products.length === 0 ? (
        <p className="text-sm text-night-fg-soft">상품이 없습니다.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <Link
              key={p.slug}
              href={`/products/${p.slug}`}
              className="group relative block rounded-lg border border-night-border bg-night-secondary p-6 transition-colors hover:border-starlight hover:bg-night-elevated"
            >
              {p.badge_label && (
                <span className="absolute -top-2.5 right-4 inline-flex items-center rounded-full bg-amber-400 px-2.5 h-5 text-[10px] font-bold tracking-wide text-night-primary">
                  {p.badge_label}
                </span>
              )}
              <p className="text-base font-semibold text-night-fg">{p.name}</p>
              <p className="mt-1.5 text-sm text-night-fg-soft leading-relaxed line-clamp-2">
                {p.description}
              </p>
              <p className="mt-5 flex items-baseline gap-2">
                {p.original_price && (
                  <span className="text-sm font-mono text-night-fg-muted line-through">
                    {formatKRW(p.original_price)}
                  </span>
                )}
                <span className="text-lg font-mono font-medium text-starlight">
                  {formatKRW(p.price)}
                </span>
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
