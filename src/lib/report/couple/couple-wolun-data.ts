// =====================================================
// 커플 궁합 리포트 — 온도 타이밍(케미 ⑧) 월운 탐색 (진실 원천)
// =====================================================
// 지시문_궁합_v4검토수정_20260716.md §2 — 마스터 §4-⑧ "향후 수개월 중 온도가
// 함께 오르는 구간 1개(운에서 식상·관성·충 — 코드 탐색)"를 실제 코드 계산으로 전환.
// weolun 필드는 COUPLE_MATCH_FIELDS 예산 절약을 위해 manseryeok 텍스트에서 제외돼
// 있으므로(saju-api.ts 주석 참고) 이 모듈이 raw fullAnalysis.weolun 을 직접 읽어
// "구간 1개"만 골라 짧은 문장으로 압축 주입한다 — 전체 12개월 페이로드는 프롬프트에
// 넣지 않는다(토큰 절약 원칙 유지).

import type { SajuAnalysisResponse } from "@/lib/saju/saju-api";
import type { RawWeolunItem, RawWeolunRoot } from "@/lib/report/raw-types";
import { findJijiRelations } from "@/lib/saju/jiji-relations";

const SIKSANG = new Set(["식신", "상관"]);
const GWANSEONG = new Set(["정관", "편관"]);

export type WolunQualifyReason = "식상" | "관성" | "충";

type WolunMonthCandidate = {
  year: number;
  month: number;
  ganji: string;
  selfReasons: WolunQualifyReason[];
  partnerReasons: WolunQualifyReason[];
};

export type CoupleWolunHighlight = {
  year: number;
  month: number;
  ganji: string;
  /** 이번 달부터 몇 번째 달인지(0=이번 달) — 프롬프트에 "N개월 후"로 상대 표기용. */
  monthsFromNow: number;
  /** 두 사람 모두 발동 요인이 있는 "동반" 구간인지. */
  shared: boolean;
  selfReasons: WolunQualifyReason[];
  partnerReasons: WolunQualifyReason[];
} | null;

function flattenWolun(root: RawWeolunRoot, limit = 12): RawWeolunItem[] {
  const seen = new Set<string>();
  const raw: RawWeolunItem[] = [];
  for (const item of [root.currentWeolun, root.nextWeolun, ...(root.upcomingWeoluns ?? [])]) {
    if (!item) continue;
    const key = `${item.year}-${item.month}`;
    if (seen.has(key)) continue;
    seen.add(key);
    raw.push(item);
  }
  return raw.slice(0, limit);
}

function qualifyReasons(item: RawWeolunItem, dayJi: string): WolunQualifyReason[] {
  const reasons: WolunQualifyReason[] = [];
  const sip = item.sipseongRelation;
  if (sip && (SIKSANG.has(sip.gan) || SIKSANG.has(sip.ji))) reasons.push("식상");
  if (sip && (GWANSEONG.has(sip.gan) || GWANSEONG.has(sip.ji))) reasons.push("관성");
  if (item.ji && findJijiRelations(dayJi, item.ji).includes("충")) reasons.push("충");
  return reasons;
}

/**
 * 향후 12개월 월운에서 "온도가 오르는 구간"(식상·관성 발동 또는 원국과의 충) 1개를
 * 탐색. 두 사람 모두 해당하는 "동반" 달을 우선하고, 없으면 둘 중 한쪽이라도
 * 해당하는 첫 달을 채택한다. 후보가 전혀 없으면 null(이 경우 프롬프트는 일반론으로만
 * 작성하도록 안내).
 */
export function computeCoupleWolunHighlight(
  selfFullAnalysis: SajuAnalysisResponse | null,
  partnerFullAnalysis: SajuAnalysisResponse | null,
  selfDayJi: string,
  partnerDayJi: string,
): CoupleWolunHighlight {
  const selfRoot = selfFullAnalysis?.weolun as RawWeolunRoot | undefined;
  const partnerRoot = partnerFullAnalysis?.weolun as RawWeolunRoot | undefined;
  if (!selfRoot || !partnerRoot) return null;

  const selfMonths = flattenWolun(selfRoot);
  const partnerByKey = new Map(flattenWolun(partnerRoot).map((m) => [`${m.year}-${m.month}`, m]));

  const candidates: WolunMonthCandidate[] = [];
  selfMonths.forEach((sm) => {
    const pm = partnerByKey.get(`${sm.year}-${sm.month}`);
    if (!pm) return;
    const selfReasons = qualifyReasons(sm, selfDayJi);
    const partnerReasons = qualifyReasons(pm, partnerDayJi);
    if (selfReasons.length === 0 && partnerReasons.length === 0) return;
    candidates.push({ year: sm.year, month: sm.month, ganji: sm.ganji, selfReasons, partnerReasons });
  });

  if (candidates.length === 0) return null;

  const shared = candidates.find((c) => c.selfReasons.length > 0 && c.partnerReasons.length > 0);
  const picked = shared ?? candidates[0];
  const idx = selfMonths.findIndex((m) => m.year === picked.year && m.month === picked.month);

  return {
    year: picked.year,
    month: picked.month,
    ganji: picked.ganji,
    monthsFromNow: idx === -1 ? 0 : idx,
    shared: picked.selfReasons.length > 0 && picked.partnerReasons.length > 0,
    selfReasons: picked.selfReasons,
    partnerReasons: picked.partnerReasons,
  };
}

/** 프롬프트 주입용 — 연도 대신 "N개월 후" 상대 표기만 쓰도록 강제. */
export function formatCoupleWolunHighlightForPrompt(
  highlight: CoupleWolunHighlight,
  names: { self: string; partner: string },
): string {
  if (!highlight) {
    return "[온도 타이밍 데이터 없음 — chemistryTimingPreview는 특정 시기 언급 없이 일반론으로만 작성하라]";
  }
  const reasonLabel = (reasons: WolunQualifyReason[]) => (reasons.length > 0 ? reasons.join("·") : "해당 없음");
  const relTiming = highlight.monthsFromNow === 0 ? "이번 달" : `약 ${highlight.monthsFromNow}개월 후`;
  return [
    `[온도 타이밍 — 이 구간만 사용. 세운 연도("20XX년") 절대 언급 금지]`,
    `${highlight.ganji}월 — ${names.self} 발동 요인: ${reasonLabel(highlight.selfReasons)} / ${names.partner} 발동 요인: ${reasonLabel(highlight.partnerReasons)}${highlight.shared ? " (동반 상승)" : ""}`,
    `⚠️ 시점 표기는 반드시 "${relTiming}"라는 문구를 정확히 그대로 써라 — "약 몇 개월 안에", "얼마 후"처럼 숫자를 뭉개는 표현 금지. 이 정확한 개월 수가 이 리포트가 다른 서비스와 차별화되는 지점이다.`,
  ].join("\n");
}

/**
 * chemistryTimingPreview에 정확한 개월 수(또는 "이번 달")가 실제로 등장하는지 검사
 * (지시문_궁합_v4검토수정_20260716.md 추가 지시 — "약 몇 개월"처럼 숫자를 뭉개는
 * 사례가 실측 확인됨).
 */
export function checkTimingPreviewHasMonthCount(chemistryTimingPreview: string, highlight: CoupleWolunHighlight): string[] {
  if (!highlight) return [];
  const required = highlight.monthsFromNow === 0 ? "이번 달" : `${highlight.monthsFromNow}개월`;
  if (!chemistryTimingPreview.includes(required)) {
    return [`chemistryTimingPreview에 정확한 시점 표기("${required}")가 없음 — "약 몇 개월" 같은 뭉갠 표현 대신 코드가 준 정확한 개월 수를 그대로 써야 함`];
  }
  return [];
}
