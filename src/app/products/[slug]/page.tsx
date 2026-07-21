import type { ComponentProps } from "react";
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
  let initialValues: ComponentProps<typeof SajuForm>["initialValues"];

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

    // 사주 입력 프리필(지시문_사주입력_프리필_20260721.md §1) — 소스 우선순위 1:
    // 로그인 사용자의 profiles 저장값. 이번 구현 범위는 오늘의 운세로 한정.
    if (user && product?.slug === "today-fortune") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, birth_date, birth_time, time_unknown, gender, calendar, is_leap_month")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.birth_date) {
        initialValues = {
          name: profile.display_name ?? undefined,
          birthDate: profile.birth_date,
          birthTime: profile.birth_time,
          timeUnknown: profile.time_unknown,
          gender: profile.gender ?? undefined,
          calendar: profile.calendar ?? undefined,
          isLeapMonth: profile.is_leap_month,
        };
      }
    }
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

      {product.slug === "couple-match" && (
        <section className="mb-10 rounded-lg border border-night-border bg-night-surface/40 p-5">
          <p className="text-xs font-mono text-night-fg-muted mb-1">WHAT&#39;S INSIDE</p>
          <p className="text-xs text-night-fg-muted mb-3">A4 20페이지 — 한 페이지에 하나씩, 서로 다른 근거로 채워집니다.</p>
          <ul className="space-y-2.5 text-sm text-night-fg-soft">
            <li><span className="text-starlight font-mono mr-2">01</span>명식표 2단 — 두 사람의 명식을 나란히 놓고 비교합니다</li>
            <li><span className="text-starlight font-mono mr-2">02</span>합충 관계도 — 두 명식 4기둥×4기둥 교차에서 합·충 신호를 표시합니다</li>
            <li><span className="text-starlight font-mono mr-2">03</span>2인 세운 곡선 — 두 사람의 연간 시황을 나란히 그래프로 비교합니다</li>
            <li><span className="text-starlight font-mono mr-2">04</span>커플 백테스트 — 과거 흐름이 실제 두 사람의 관계와 맞아떨어지는지 검증합니다</li>
            <li><span className="text-starlight font-mono mr-2">05</span>케미스트리 리포트 — 밤의 궁합까지 포함한 정면 분석입니다</li>
          </ul>
          <p className="mt-4 text-xs text-night-fg-muted">
            결제 후 자동 생성되며, 생성 진행 상황은 화면에서 실시간으로 안내해드려요.
          </p>
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold mb-4 text-night-fg">사주 정보 입력</h2>
        <p className="text-xs text-night-fg-soft mb-4">정확할수록 더 정밀한 결과가 나옵니다.</p>
        <SajuForm
          productId={product.id}
          productSlug={product.slug}
          isLoggedIn={!!user}
          requiresPartner={product.slug === "couple-match"}
          initialValues={initialValues}
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
