// =====================================================
// 인생 애널리스트 리포트 — 운세지수 룰 엔진
// =====================================================
// 원래 스펙(IMPLEMENTATION_SPEC.md §5)은 "기본 60 + 용신/희신/기신 매치 가감 +
// 12운성 보너스 + 충 변동 + 천을귀인" 수동 휴리스틱을 직접 구현하는 안이었다.
//
// 그런데 실제 luckyloveme 응답을 까보니(2026-07-12 실측), 대운/세운/월운 각 항목에
// 이미 `yongsinJudgment.종합점수`(억부·통관·병약 다중 판정법을 종합한 luckyloveme
// 자체 점수, 관측 범위 대략 -103~+51)가 내려온다. 우리가 원국 오행만 보고 단순
// 가감법을 재구현하는 것보다, 이미 검증된 이 점수를 0~100 표시 스케일로
// 재매핑하는 편이 더 정확하고 중복 로직도 없다 — 그래서 이 엔진은 "재구현"이
// 아니라 "재매핑 어댑터"로 설계했다.
//
// - 숫자 축: rescaleScore() 가 종합점수를 중립선 60 기준 30~85 밴드로 선형 압축.
// - 태그 축(golden/변동/caution): 종합판정 라벨 + 충 관계 + 천을귀인 조견표
//   (cheoneul-table.ts) 조합으로 결정 — 이 부분은 luckyloveme 응답에 없는
//   "운(運)의 지지가 천을귀인에 해당하는지"를 우리가 직접 계산해야 하므로 유지.

import type { ScoredPeriod } from "./types";
import { isCheoneulGuiin } from "./cheoneul-table";

export type YongsinJudgment = {
  종합판정: string;
  종합점수: number;
  천간판정?: string;
  지지판정?: string;
  용신오행?: string;
  희신오행?: string;
  기신오행?: string;
  판정근거?: string;
};

export type HapChungRelationRaw = {
  type: string;
  source?: string;
  target?: string;
  sourcePosition?: string;
  targetPosition?: string;
  meaning?: string;
};

/** score-engine 입력 — daeun/seun/weolun 어댑터가 raw API 응답에서 이 shape 로 변환해 넘김. */
export type ScorablePeriod = {
  label: string;
  ganji: string;
  ganjiHanja: string;
  isCurrent: boolean;
  yongsinJudgment: YongsinJudgment | undefined;
  hapChungRelations?: HapChungRelationRaw[];
  /** 십신 라벨 "정재·편인" — 어댑터(normalize)가 raw sipseong 에서 조합해 넘김. */
  sipseong?: string;
  /** 실제 캘린더 연/월 (월운 전용 — 대운/세운은 label 에 이미 연도가 있어 미사용). */
  year?: number;
  month?: number;
};

const SCALE_CENTER = 60;
const SCALE_MIN = 30;
const SCALE_MAX = 85;
/** raw 종합점수 → 표시 스케일 압축 비율. 관측 범위(-103~+51) 기준 30~85 밴드에 맞춤. */
const SCALE_DIVISOR = 4;
/** 세운/월운 가중치 (스펙 §5: "세운·월운 동일 규칙(가중 0.7)") — 대운보다 변동을 완만하게. */
const MINOR_PERIOD_WEIGHT = 0.7;

function rescaleScore(rawScore: number, weight: number): number {
  const delta = (rawScore / SCALE_DIVISOR) * weight;
  const v = SCALE_CENTER + delta;
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, Math.round(v)));
}

function hasChungOrHyeong(relations: HapChungRelationRaw[] | undefined): boolean {
  if (!relations) return false;
  return relations.some((r) => r.type?.includes("충") || r.type?.includes("형"));
}

function determineTag(
  period: ScorablePeriod,
  dayGan: string,
): ScoredPeriod["tag"] {
  const judgment = period.yongsinJudgment?.종합판정 ?? "";
  const jiChar = period.ganji?.[1];
  const isGuiin = isCheoneulGuiin(dayGan, jiChar);

  if (isGuiin || judgment.includes("대길")) return "golden";
  if (judgment.includes("대흉")) return "caution";
  if (hasChungOrHyeong(period.hapChungRelations)) return "변동";
  return "neutral";
}

/**
 * ScorablePeriod[] → ScoredPeriod[] 일괄 채점.
 * @param dayGan 일간 한글 (천을귀인 판정용)
 * @param weight 대운=1(기본), 세운/월운=0.7
 */
export function scorePeriods(
  periods: ScorablePeriod[],
  dayGan: string,
  weight: number = 1,
): ScoredPeriod[] {
  let prevScore: number | null = null;
  return periods.map((p) => {
    const raw = p.yongsinJudgment?.종합점수;
    const score = typeof raw === "number" ? rescaleScore(raw, weight) : SCALE_CENTER;
    const direction: ScoredPeriod["direction"] =
      prevScore === null ? "flat" : score > prevScore ? "up" : score < prevScore ? "down" : "flat";
    prevScore = score;
    return {
      label: p.label,
      ganji: p.ganji,
      ganjiHanja: p.ganjiHanja,
      score,
      direction,
      tag: determineTag(p, dayGan),
      isCurrent: p.isCurrent,
      sipseong: p.sipseong,
      year: p.year,
      month: p.month,
      rawJudgment: p.yongsinJudgment?.종합판정,
      rawScore: raw,
    };
  });
}
