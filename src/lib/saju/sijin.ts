// =====================================================
// src/lib/saju/sijin.ts
// =====================================================
// 오자원둔법(五子元遁法) — 하루(일간)를 기준으로 12시진(자시~해시)의 간지를
// 결정론적으로 계산하는 고정 테이블. API 호출 없음, gongmang.ts/cheoneul-table.ts와
// 동일한 "순수 계산 모듈" 스타일. today-fortune 프롬프트가 "AI는 재계산하지 말고
// 이 표를 그대로 인용하라"는 데이터 소스로 사용한다.

const CHEONGAN_ORDER = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"] as const;
const JIJI_ORDER = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"] as const;

/** 일간 → 자시(子時) 시두 천간. 갑기=갑, 을경=병, 병신=무, 정임=경, 무계=임. */
const SI_DU_START: Record<string, string> = {
  갑: "갑", 기: "갑",
  을: "병", 경: "병",
  병: "무", 신: "무",
  정: "경", 임: "경",
  무: "임", 계: "임",
};

export type SijinEntry = { label: string; cheongan: string; jiji: string };

/**
 * 주어진 일간(day 천간)의 하루 12시진 간지를 전부 계산한다.
 * @param dayGan 일간 한글 1글자 (예: "갑")
 * @returns 자시~해시 순서 12개
 */
export function computeSijinTable(dayGan: string): SijinEntry[] {
  const startGan = SI_DU_START[dayGan];
  if (!startGan) throw new Error(`computeSijinTable: 알 수 없는 일간 "${dayGan}"`);
  const startIdx = CHEONGAN_ORDER.indexOf(startGan as (typeof CHEONGAN_ORDER)[number]);

  return JIJI_ORDER.map((jiji, i) => ({
    label: `${jiji}시`,
    cheongan: CHEONGAN_ORDER[(startIdx + i) % 10],
    jiji,
  }));
}
