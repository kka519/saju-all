// =====================================================
// 오늘의 운세 — "오늘의 날씨" 카드
// =====================================================
// today-fortune 전용 결과 렌더러. saju_results.today_fortune(7블록 JSON)을 그대로
// 받아 구조화된 섹션으로 렌더한다 — 다른 상품의 <ResultBody markdown=.../> 자유
// 마크다운 경로와 분리(results/[resultId]/page.tsx 에서 slug 분기).
//
// 상단 "날씨 카드" 블록은 배경·마진을 자체 완결시켜 향후 카카오 공유 이미지로
// 그대로 캡처해도 되는 독립 섹션으로 구성했다.

import Link from "next/link";

export type TodayFortuneSections = {
  dayTone: "good" | "mixed" | "caution";
  headline: string;
  psychSnipe: string;
  weatherReason: string;
  flow: { morning: string; afternoon: string; evening: string };
  goldenTimeLabel: string;
  point: { take: string; avoid: string };
  check: string;
  teaserCta: { teaser: string; ctaLabel: string };
  tomorrow: string;
  targetSlug: string;
};

const WEATHER = {
  good: { emoji: "☀️", label: "맑음" },
  mixed: { emoji: "⛅", label: "구름" },
  caution: { emoji: "🌧️", label: "소나기" },
} as const;

export function TodayFortuneCard({ data }: { data: TodayFortuneSections }) {
  const weather = WEATHER[data.dayTone];

  return (
    <div className="space-y-6">
      {/* 오늘의 날씨 카드 — 독립 완결 섹션(공유 이미지 재사용 가능 구조) */}
      <section className="rounded-lg border border-night-border bg-night-secondary p-6">
        <p className="text-xs font-mono text-night-fg-muted mb-2">오늘의 날씨</p>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{weather.emoji}</span>
          <span className="text-sm font-semibold text-starlight">{weather.label}</span>
        </div>
        <p className="text-lg font-semibold leading-snug text-night-fg mb-3">{data.headline}</p>
        <p className="text-sm text-night-fg-soft mb-3 leading-relaxed">{data.psychSnipe}</p>
        <p className="text-sm text-night-fg-soft">{data.weatherReason}</p>
      </section>

      <section className="rounded-lg border border-night-border bg-night-secondary p-6">
        <p className="text-xs font-mono text-night-fg-muted mb-3">오늘의 흐름</p>
        <dl className="space-y-2 text-sm text-night-fg-soft">
          <div><dt className="inline font-semibold text-night-fg">오전 : </dt><dd className="inline">{data.flow.morning}</dd></div>
          <div><dt className="inline font-semibold text-night-fg">오후 : </dt><dd className="inline">{data.flow.afternoon}</dd></div>
          <div><dt className="inline font-semibold text-night-fg">저녁 : </dt><dd className="inline">{data.flow.evening}</dd></div>
        </dl>
        <p className="mt-3 inline-flex items-center rounded-full bg-starlight/15 px-3 py-1 text-xs font-semibold text-starlight">
          골든타임 : {data.goldenTimeLabel}
        </p>
      </section>

      <section className="rounded-lg border border-night-border bg-night-secondary p-6 space-y-3">
        <p className="text-xs font-mono text-night-fg-muted">오늘의 포인트</p>
        <div>
          <p className="text-sm font-semibold text-starlight mb-1">취할 것</p>
          <p className="text-sm text-night-fg-soft">{data.point.take}</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-starlight mb-1">피할 것</p>
          <p className="text-sm text-night-fg-soft">{data.point.avoid}</p>
        </div>
      </section>

      <p className="text-sm text-night-fg-muted italic">{data.check}</p>

      <section className="rounded-lg border border-starlight/40 bg-night-elevated p-6">
        <p className="text-sm text-night-fg-soft mb-4">{data.teaserCta.teaser}</p>
        <Link
          href={`/products/${data.targetSlug}`}
          className="inline-flex items-center rounded-md bg-starlight px-4 py-2 text-sm font-semibold text-night-primary transition-opacity hover:opacity-90"
        >
          {data.teaserCta.ctaLabel}
        </Link>
      </section>

      <p className="text-sm text-night-fg-muted">{data.tomorrow}</p>
    </div>
  );
}
