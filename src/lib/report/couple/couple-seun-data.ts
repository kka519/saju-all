// =====================================================
// 커플 궁합 리포트 — 2인 세운 교차 데이터 계산 (진실 원천)
// =====================================================
// 지시문_궁합PDF_비주얼3종_20260715.md §3 — 곡선 수치는 100% 코드 주입, LLM 생성 금지.
// luckyloveme 원자료(seun[].yongsinJudgment.종합점수)를 그대로 사용 — 재계산하지 않는다.

import type { SajuAnalysisResponse } from "@/lib/saju/saju-api";
import type { Seun, SeunItem } from "@/lib/saju/full-analysis-types";

export type SeunYearPoint = {
  year: number;
  ganji: string;
  ganjiHanja: string;
  score: number; // yongsinJudgment.종합점수 그대로
  rating: string; // "대길"/"소길"/"평"/"소흉"/"대흉" 등, yongsinJudgment.종합판정 그대로
};

export type CoupleSeunSeries = {
  self: SeunYearPoint[];
  partner: SeunYearPoint[];
  /** 두 사람 데이터가 공통으로 존재하는 연도만(교집합) — 7년 창(과거3+현재+향후3) 내. */
  years: number[];
  highlightYear: number | null;
  /** "동반 상승" — 두 사람 점수가 처음으로 함께 양수인 해. 없으면 "최소 온도차"로 대체. */
  highlightReason: "동반 상승" | "최소 온도차" | null;
};

function flattenSeun(seun: Seun): SeunYearPoint[] {
  const items: SeunItem[] = [seun.currentSeun, ...(seun.recentSeuns ?? []), ...(seun.upcomingSeuns ?? [])];
  const byYear = new Map<number, SeunYearPoint>();
  for (const it of items) {
    if (!it?.yongsinJudgment) continue;
    byYear.set(it.year, {
      year: it.year,
      ganji: it.ganji,
      ganjiHanja: it.ganji_hanja,
      score: it.yongsinJudgment.종합점수,
      rating: it.yongsinJudgment.종합판정,
    });
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year);
}

/**
 * 과거 3년 + 현재 + 향후 3년(7년 창)의 본인·상대 세운을 함께 계산.
 * 동반 상승 연도(둘 다 양수가 되는 첫 해)를 찾아 하이라이트 — 없으면 온도차(|점수차|)
 * 가 가장 작은 해로 대체(§3 엣지 케이스).
 */
export function computeCoupleSeunSeries(
  selfFullAnalysis: SajuAnalysisResponse | null,
  partnerFullAnalysis: SajuAnalysisResponse | null,
  currentYear: number = new Date().getFullYear(),
): CoupleSeunSeries {
  const selfSeun = selfFullAnalysis?.seun as Seun | undefined;
  const partnerSeun = partnerFullAnalysis?.seun as Seun | undefined;
  if (!selfSeun || !partnerSeun) {
    return { self: [], partner: [], years: [], highlightYear: null, highlightReason: null };
  }

  const windowStart = currentYear - 3;
  const windowEnd = currentYear + 3;
  const inWindow = (p: SeunYearPoint) => p.year >= windowStart && p.year <= windowEnd;

  const selfAll = flattenSeun(selfSeun).filter(inWindow);
  const partnerAll = flattenSeun(partnerSeun).filter(inWindow);

  const selfByYear = new Map(selfAll.map((p) => [p.year, p]));
  const partnerByYear = new Map(partnerAll.map((p) => [p.year, p]));
  const years = [...selfByYear.keys()].filter((y) => partnerByYear.has(y)).sort((a, b) => a - b);

  let highlightYear: number | null = null;
  let highlightReason: CoupleSeunSeries["highlightReason"] = null;

  for (const y of years) {
    const s = selfByYear.get(y)!;
    const p = partnerByYear.get(y)!;
    if (s.score > 0 && p.score > 0) {
      highlightYear = y;
      highlightReason = "동반 상승";
      break;
    }
  }
  if (highlightYear === null && years.length > 0) {
    let bestYear = years[0];
    let bestDiff = Infinity;
    for (const y of years) {
      const diff = Math.abs(selfByYear.get(y)!.score - partnerByYear.get(y)!.score);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestYear = y;
      }
    }
    highlightYear = bestYear;
    highlightReason = "최소 온도차";
  }

  return {
    self: years.map((y) => selfByYear.get(y)!),
    partner: years.map((y) => partnerByYear.get(y)!),
    years,
    highlightYear,
    highlightReason,
  };
}

/** 프롬프트 주입용 — 본문·공유 카드가 동일한 하이라이트 연도를 언급하도록 텍스트로 고정. */
export function formatCoupleSeunSeriesForPrompt(series: CoupleSeunSeries): string {
  if (series.years.length === 0) return "[세운 데이터 없음 — 이 항목은 언급하지 마라]";
  const lines = series.years.map((y, i) => {
    const s = series.self[i];
    const p = series.partner[i];
    const mark = y === series.highlightYear ? " ← 하이라이트" : "";
    return `  ${y}년(본인 ${s.ganji} ${s.rating} ${s.score >= 0 ? "+" : ""}${s.score} / 상대 ${p.ganji} ${p.rating} ${p.score >= 0 ? "+" : ""}${p.score})${mark}`;
  });
  const reasonLabel = series.highlightReason === "동반 상승" ? "두 사람이 함께 양운으로 접어드는 해" : "두 사람의 온도차가 가장 작은 해";
  return [
    `[세운 교차 — 이 수치만 사용, 재계산·창작 금지]`,
    ...lines,
    `[하이라이트 연도] ${series.highlightYear}년 — ${reasonLabel}(${series.highlightReason})`,
  ].join("\n");
}
