import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatKRW } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/env";
import { productsSeed } from "@/config/products.seed";

export const metadata = { title: "상품" };

export default async function ProductsPage() {
  let products: { slug: string; name: string; description: string; price: number }[] | null;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("products")
      .select("slug, name, description, price")
      .eq("is_active", true)
      .order("display_order", { ascending: true });
    products = data;
  } else {
    products = productsSeed
      .filter((p) => p.is_active)
      .sort((a, b) => a.display_order - b.display_order)
      .map(({ slug, name, description, price }) => ({ slug, name, description, price }));
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
              className="group block rounded-lg border border-night-border bg-night-secondary p-6 transition-colors hover:border-starlight hover:bg-night-elevated"
            >
              <p className="text-base font-semibold text-night-fg">{p.name}</p>
              <p className="mt-1.5 text-sm text-night-fg-soft leading-relaxed line-clamp-2">
                {p.description}
              </p>
              <p className="mt-5 text-lg font-mono font-medium text-starlight">{formatKRW(p.price)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
