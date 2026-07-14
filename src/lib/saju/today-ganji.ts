// =====================================================
// src/lib/saju/today-ganji.ts
// =====================================================
// today-fortune 전용 — 오늘/내일 "일진"(그날의 일주 간지) 조회 + 톤(good/mixed/
// caution) 3단 판정 + CTA 라우팅.
//
// 로컬 60갑자 계산기가 코드베이스에 없어(조사 완료), 오늘/내일 날짜를 생년월일처럼
// luckyloveme API에 넣어 day 간지만 뽑아 재사용한다 — 시간은 지정하지 않는다
// (일진 자체는 시각과 무관, 4기둥 중 일주만 필요).
//
// 톤 판정은 "일지 충만 본다"는 초판 로직의 문제(일지 충만 보면 오늘처럼 "일간
// 합 + 일지 파"가 동시에 있는 날을 놓친다)를 고쳐, 오늘 일진을 원국 4기둥
// 전체와 비교(합/충/파/형)하고 오행이 용신/희신/기신 중 무엇에 해당하는지까지
// 합산한 점수로 3단 판정한다. 판정 근거(relations)를 그대로 프롬프트에 주입해
// LLM이 같은 근거로 서술하게 한다 — "판정은 코드, 서술은 AI"로 진실 원천을 하나로.

import { fetchSajuAnalysis, ganjiToMyeongsik, type BirthInfo } from "./saju-api";
import type { Myeongsik } from "./manseryeok";
import { getCheonganOheng, getJijiOheng, type Oheng } from "./derived";
import { findCheonganRelations, findJijiRelations, type RelationType } from "./jiji-relations";
import { sijinTimeRangeLabel, type SijinEntry } from "./sijin";

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

export type DayTone = "good" | "mixed" | "caution";

export type DayToneRelation = {
  type: RelationType;
  scope: "천간" | "지지";
  pillar: "년" | "월" | "일" | "시";
  detail: string; // 예: "갑기합(일간)", "진축파(일지)"
};

export type DayToneResult = {
  tone: DayTone;
  score: number;
  relations: DayToneRelation[];
  ohengNote: string; // 예: "오늘 지지 축(토)=기신" — 프롬프트 근거용 한 줄
};

const PILLAR_LABELS = { year: "년", month: "월", day: "일", hour: "시" } as const;

export type OhengPrefs = { yongsinOheng?: Oheng; huisinOheng?: Oheng; gisinOheng?: Oheng };

/**
 * 임의의 간지 하나를 원국 4기둥(합·충·파·형) + 오행(용신/희신/기신)과 비교해 점수를 매긴다.
 * analyzeDayTone(오늘 일진 판정)과 findGoldenSijin(12시진 중 최고 시간대 선정)이 공유하는
 * 핵심 스코어링 — "관계는 코드가 계산, 해석만 AI가" 원칙의 계산부.
 */
export function scoreGanjiAgainstMyeongsik(
  ganji: DayGanji,
  myeongsik: Myeongsik,
  oheng: OhengPrefs = {},
): { score: number; relations: DayToneRelation[]; ohengNote: string } {
  const relations: DayToneRelation[] = [];
  let relationScore = 0;

  const pillars: { key: keyof typeof PILLAR_LABELS; pillar: { cheongan: string; jiji: string } | null }[] = [
    { key: "year", pillar: myeongsik.year },
    { key: "month", pillar: myeongsik.month },
    { key: "day", pillar: myeongsik.day },
    { key: "hour", pillar: myeongsik.hour },
  ];

  for (const { key, pillar } of pillars) {
    if (!pillar) continue;
    const label = PILLAR_LABELS[key];

    for (const rel of findCheonganRelations(ganji.cheongan, pillar.cheongan)) {
      relations.push({ type: rel, scope: "천간", pillar: label, detail: `${ganji.cheongan}${pillar.cheongan}${rel}(${label}간)` });
      relationScore += rel === "합" ? 1 : -1;
    }
    for (const rel of findJijiRelations(ganji.jiji, pillar.jiji)) {
      relations.push({ type: rel, scope: "지지", pillar: label, detail: `${ganji.jiji}${pillar.jiji}${rel}(${label}지)` });
      relationScore += rel === "합" ? 1 : -1;
    }
  }

  const ganOheng = getCheonganOheng(ganji.cheongan);
  const jiOheng = getJijiOheng(ganji.jiji);
  let ohengScore = 0;
  const ohengNotes: string[] = [];
  for (const [label, o] of [
    ["천간", ganOheng],
    ["지지", jiOheng],
  ] as const) {
    if (!o) continue;
    if (o === oheng.yongsinOheng) {
      ohengScore += 2;
      ohengNotes.push(`${label} 오행(${o})=용신`);
    } else if (o === oheng.huisinOheng) {
      ohengScore += 1;
      ohengNotes.push(`${label} 오행(${o})=희신`);
    } else if (o === oheng.gisinOheng) {
      ohengScore -= 2;
      ohengNotes.push(`${label} 오행(${o})=기신`);
    }
  }

  return {
    score: relationScore + ohengScore,
    relations,
    ohengNote: ohengNotes.length ? ohengNotes.join(", ") : "용신/희신/기신 오행과 직접 일치 없음",
  };
}

/**
 * 오늘 일진과 원국 4기둥(합·충·파·형) + 오행(용신/희신/기신)을 종합해 톤을 판정.
 * @param yongsinOheng view.yongsin?.오행, huisinOheng/gisinOheng 는 view.gyeokguk?.희신오행/기신오행.
 *   전부 optional — full_analysis 가 없는 mock 폴백 케이스에서는 오행 가점 없이 관계만으로 판정.
 */
export function analyzeDayTone(
  todayGanji: DayGanji,
  myeongsik: Myeongsik,
  oheng: OhengPrefs = {},
): DayToneResult {
  const { score, relations, ohengNote } = scoreGanjiAgainstMyeongsik(todayGanji, myeongsik, oheng);
  const tone: DayTone = score >= 2 ? "good" : score <= -2 ? "caution" : "mixed";
  return { tone, score, relations, ohengNote };
}

export type GoldenSijinResult = {
  entry: SijinEntry;
  score: number;
  timeRangeLabel: string;
};

/**
 * 12시진 중 원국·오행과의 궁합 점수가 가장 높은 시간대 1개를 코드가 선정.
 * 동점이면 배열 순서(자시부터)상 먼저 나오는 쪽을 취한다.
 */
export function findGoldenSijin(
  sijinTable: SijinEntry[],
  myeongsik: Myeongsik,
  oheng: OhengPrefs = {},
): GoldenSijinResult {
  let best: GoldenSijinResult | null = null;
  for (const entry of sijinTable) {
    const { score } = scoreGanjiAgainstMyeongsik({ cheongan: entry.cheongan, jiji: entry.jiji }, myeongsik, oheng);
    if (!best || score > best.score) {
      best = { entry, score, timeRangeLabel: sijinTimeRangeLabel(entry.jiji) };
    }
  }
  return best!;
}

/** 고민 태그 → CTA 타겟 상품 slug. 매칭 없으면 love-saju 기본값. */
export function routeCtaSlug(concerns: string[]): string {
  const joined = concerns.join(" ");
  if (/연애|결혼/.test(joined)) return "love-saju";
  if (/재물|직장|사업|이직/.test(joined)) return "life-analyst-report";
  return "love-saju";
}
