// =====================================================
// 분기 라벨 계산 — p.13 표기 + PART III 프롬프트 주입이 동일 값을 쓰도록 공용화
// =====================================================
// wolun 은 "생성 시점부터 12개월"을 배열 순서대로 담고 있다(달력 분기 정렬 아님).
// 이 배열을 3개월씩 4구간으로 묶는 기존 로직(build-template-context.ts)은 유지하되,
// 각 구간의 라벨을 "구간 순번(Q1..)" 대신 구간 첫 달의 실제 연도/분기로 계산한다.

import type { ScoredPeriod } from "./types";

export type QuarterLabel = {
  year: number;
  quarterNum: number;
  monthRange: string;
  full: string;
};

export function computeQuarterLabels(wolun: ScoredPeriod[]): QuarterLabel[] {
  const labels: QuarterLabel[] = [];
  for (let qi = 0; qi < 4; qi++) {
    const bucket = wolun.slice(qi * 3, qi * 3 + 3);
    if (bucket.length === 0) break;
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    const year = first.year ?? 0;
    const quarterNum = first.month ? Math.ceil(first.month / 3) : qi + 1;
    const monthRange =
      bucket.length > 1 && first.month != null && last.month != null
        ? `${first.month}~${last.month}월`
        : `${first.month ?? "-"}월`;
    labels.push({ year, quarterNum, monthRange, full: `${year}년 ${quarterNum}분기 (${monthRange})` });
  }
  return labels;
}
