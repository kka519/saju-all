import Link from "next/link";
import { formatKRW } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { productsSeed } from "@/config/products.seed";

type ProductCard = {
  slug: string;
  name: string;
  description: string;
  price: number;
  original_price?: number | null;
  badge_label?: string | null;
};

// Ollama: thin-border cards on the same canvas — no shadow, hairline only.
export async function ProductLineup() {
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

  if (!products || products.length === 0) {
    return (
      <section className="container py-12 text-center">
        <p className="text-sm text-night-fg-soft">
          상품이 아직 없어요. <code className="font-mono text-night-fg">pnpm seed:products</code> 를 실행해 주세요.
        </p>
      </section>
    );
  }

  return (
    <section className="container py-16 border-t border-night-border">
      <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-center mb-10 text-night-fg">
        상품 라인업
      </h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            {/* 취소선 종전가 표시 금지 — 판매 이력 없는 정가의 취소선은 공정위
                부당 가격표시(허위 종전거래가격) 소지. 보조 문구로만 안내. */}
            <p className="mt-5 text-lg font-mono font-medium text-starlight">
              {formatKRW(p.price)}
            </p>
            {p.original_price && (
              <p className="mt-1 text-xs text-night-fg-muted">
                정식 가격 {formatKRW(p.original_price)} 전환 예정
              </p>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
