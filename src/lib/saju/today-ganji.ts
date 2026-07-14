// =====================================================
// src/lib/saju/today-ganji.ts
// =====================================================
// today-fortune 전용 — 오늘/내일 "일진"(그날의 일주 간지) 조회 + 날씨(맑음/소나기)
// 판정 + CTA 라우팅.
//
// 로컬 60갑자 계산기가 코드베이스에 없어(조사 완료), 오늘/내일 날짜를 생년월일처럼
// luckyloveme API에 넣어 day 간지만 뽑아 재사용한다 — 시간은 지정하지 않는다
// (일진 자체는 시각과 무관, 4기둥 중 일주만 필요).

import { fetchSajuAnalysis, ganjiToMyeongsik, type BirthInfo } from "./saju-api";

export type DayGanji = { cheongan: string; jiji: string };

function toBirthInfoForDate(date: Date): BirthInfo {
  return {
    birthYear: String(date.getFullYear()),
    birthMonth: String(date.getMonth() + 1),
    birthDay: String(date.getDate()),
    calendarType: "양력",
    // 일주 계산에 성별은 영향 없음 — 스키마상 필수라 고정값 사용.
    gender: "male",
  };
}

/** date 의 일진(일주 간지)을 luckyloveme API로 조회. */
export async function fetchDayGanji(date: Date): Promise<DayGanji> {
  const analysis = await fetchSajuAnalysis(toBirthInfoForDate(date), ["ganji"], { source: "manual" });
  const myeongsik = ganjiToMyeongsik(analysis);
  if (!myeongsik) throw new Error("fetchDayGanji: ganji 응답 변환 실패");
  return myeongsik.day;
}

/** 지지 충(沖) 6쌍 — 자오/축미/인신/묘유/진술/사해. */
const JIJI_CHUNG_PAIRS: readonly [string, string][] = [
  ["자", "오"],
  ["축", "미"],
  ["인", "신"],
  ["묘", "유"],
  ["진", "술"],
  ["사", "해"],
];

function isChung(a: string, b: string): boolean {
  return JIJI_CHUNG_PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/**
 * 오늘 일진과 본인 일주의 관계로 "오늘의 날씨"를 판정.
 * 지지끼리 충이면 나쁜 날(소나기), 그 외(합·무관계)는 좋은 날(맑음)로 이분화.
 */
export function judgeDayQuality(todayJiji: string, personJiji: string): "good" | "bad" {
  return isChung(todayJiji, personJiji) ? "bad" : "good";
}

/** 고민 태그 → CTA 타겟 상품 slug. 매칭 없으면 love-saju 기본값. */
export function routeCtaSlug(concerns: string[]): string {
  const joined = concerns.join(" ");
  if (/연애|결혼/.test(joined)) return "love-saju";
  if (/재물|직장|사업|이직/.test(joined)) return "life-analyst-report";
  return "love-saju";
}
