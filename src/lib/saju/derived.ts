// =====================================================
// src/lib/saju/derived.ts
// =====================================================
// luckyloveme API 가 응답에 포함하지 않는 파생 데이터를
// myeongsik(4기둥 한글)에서 계산. 모두 결정적 상수 매핑·집계 — 외부 호출 0.
//
// 계산 대상:
//   1) 한자 매핑      — 천간/지지 한글 → 한자 (예: 갑→甲, 자→子)
//   2) 지장간 매핑    — 지지 한글 → 숨은 천간 한글 배열 (여기→중기→정기 순)
//   3) 오행 개수 집계 — myeongsik 8글자에서 목/화/토/금/수 카운트
//
// 지장간 출처: 한국 명리학 표준표 (여기→중기→정기 순서).
//   기준값 (강사님 정답지와 일치):
//     진 → 을·계·무
//     사 → 무·경·병
//     해 → 무·갑·임

import type { Myeongsik } from "./manseryeok";

// ─────────────────────────────────────────────────────
// 1) 한자 매핑
// ─────────────────────────────────────────────────────
// 한국어 표기상 천간 '신'(辛)과 지지 '신'(申)이 같은 글자로 보이므로
// 천간/지지를 별도 매핑으로 분리. 호출처에서 컨텍스트(천간/지지) 명시.

const CHEONGAN_HANJA: Record<string, string> = {
  갑: "甲",
  을: "乙",
  병: "丙",
  정: "丁",
  무: "戊",
  기: "己",
  경: "庚",
  신: "辛",
  임: "壬",
  계: "癸",
};

const JIJI_HANJA: Record<string, string> = {
  자: "子",
  축: "丑",
  인: "寅",
  묘: "卯",
  진: "辰",
  사: "巳",
  오: "午",
  미: "未",
  신: "申",
  유: "酉",
  술: "戌",
  해: "亥",
};

/**
 * 천간 한글 한 글자 → 한자.
 * 천간 10자(갑·을·병·정·무·기·경·신·임·계) 외 입력은 undefined.
 */
export function getCheonganHanja(c: string): string | undefined {
  return CHEONGAN_HANJA[c];
}

/**
 * 지지 한글 한 글자 → 한자.
 * 지지 12자(자·축·인·묘·진·사·오·미·신·유·술·해) 외 입력은 undefined.
 * 주의: '신'은 천간 辛(금)·지지 申(금) 한국어 표기가 같음.
 * 본 함수는 지지 申 으로 한정 — 천간은 getCheonganHanja 사용.
 */
export function getJijiHanja(j: string): string | undefined {
  return JIJI_HANJA[j];
}

// ─────────────────────────────────────────────────────
// 2) 지장간 매핑 (여기 → 중기 → 정기)
// ─────────────────────────────────────────────────────
// 한국 명리학 표준 12지장간표. 배열의 모든 원소는 천간 한글.
// 순서는 [여기, (중기), 정기] — 마지막이 정기(本氣).
// 자·묘·유 처럼 중기가 없는 지지는 2글자([여기, 정기]).
//
// 기준값 확인:
//   진 → ["을", "계", "무"]   (정기 무)  ← 강사님 정답지
//   사 → ["무", "경", "병"]   (정기 병)  ← 강사님 정답지
//   해 → ["무", "갑", "임"]   (정기 임)  ← 강사님 정답지
// 위 3건과 같은 출처/체계로 나머지 9개 지지도 통일.

const JIJANGGAN: Record<string, readonly string[]> = {
  자: ["임", "계"],          // 정기 계 (중기 없음)
  축: ["계", "신", "기"],     // 정기 기
  인: ["무", "병", "갑"],     // 정기 갑
  묘: ["갑", "을"],          // 정기 을 (중기 없음)
  진: ["을", "계", "무"],     // 정기 무  ← 기준값
  사: ["무", "경", "병"],     // 정기 병  ← 기준값
  오: ["병", "기", "정"],     // 정기 정
  미: ["정", "을", "기"],     // 정기 기
  신: ["무", "임", "경"],     // 정기 경 (지지 申)
  유: ["경", "신"],          // 정기 신(辛) (중기 없음)
  술: ["신", "정", "무"],     // 정기 무
  해: ["무", "갑", "임"],     // 정기 임  ← 기준값
};

/**
 * 지지 한글 → 지장간(천간) 한글 배열. 순서는 여기 → 중기 → 정기.
 * 매핑에 없는 지지 입력은 빈 배열.
 * 모든 원소는 천간 한글이므로 한자 변환은 getCheonganHanja 로.
 */
export function getJijanggan(jiji: string): readonly string[] {
  return JIJANGGAN[jiji] ?? [];
}

// ─────────────────────────────────────────────────────
// 3) 오행 개수 집계
// ─────────────────────────────────────────────────────

export type Oheng = "목" | "화" | "토" | "금" | "수";

/**
 * 천간 → 오행. 천간 신(辛) = 금.
 */
const CHEONGAN_OHENG: Record<string, Oheng> = {
  갑: "목",
  을: "목",
  병: "화",
  정: "화",
  무: "토",
  기: "토",
  경: "금",
  신: "금",
  임: "수",
  계: "수",
};

/**
 * 지지 → 오행. 지지 신(申) = 금.
 * 천간의 "신"과 한국어 표기는 같지만 한자(辛 vs 申)는 다른 별개 매핑.
 * 두 신 모두 오행은 '금'이라 집계 결과는 동일하나, 매핑 시 컨텍스트(천간/지지) 명확히 구분.
 */
const JIJI_OHENG: Record<string, Oheng> = {
  자: "수",
  축: "토",
  인: "목",
  묘: "목",
  진: "토",
  사: "화",
  오: "화",
  미: "토",
  신: "금",
  유: "금",
  술: "토",
  해: "수",
};

/**
 * 천간 한 글자 → 오행. 매핑에 없으면 undefined.
 * countOheng 과 동일한 CHEONGAN_OHENG 테이블 사용 — 단일 글자 조회 헬퍼.
 * 예: 갑→"목", 신(辛)→"금".
 */
export function getCheonganOheng(c: string): Oheng | undefined {
  return CHEONGAN_OHENG[c];
}

/**
 * 지지 한 글자 → 오행. 매핑에 없으면 undefined.
 * countOheng 과 동일한 JIJI_OHENG 테이블 사용 — 단일 글자 조회 헬퍼.
 * 예: 자→"수", 신(申)→"금".
 */
export function getJijiOheng(j: string): Oheng | undefined {
  return JIJI_OHENG[j];
}

/**
 * 오행 상생(相生) — key 오행이 value 오행을 생(生)한다.
 * 목생화·화생토·토생금·금생수·수생목.
 */
export const OHAENG_GENERATES: Record<Oheng, Oheng> = {
  목: "화",
  화: "토",
  토: "금",
  금: "수",
  수: "목",
};

/**
 * 오행 상극(相剋) — key 오행이 value 오행을 극(剋)한다.
 * 목극토·화극금·토극수·금극목·수극화.
 */
export const OHAENG_OVERCOMES: Record<Oheng, Oheng> = {
  목: "토",
  화: "금",
  토: "수",
  금: "목",
  수: "화",
};

/**
 * myeongsik 의 8글자(천간 4 + 지지 4)에서 오행 개수 집계.
 *
 * - 시 미상(hour === null) 시 6글자만 집계 (해당 칸 무시).
 * - 매핑에 없는 글자(잘못된 데이터)는 무시 — 카운트 안 함.
 *
 * @param myeongsik 4기둥 명식
 * @returns 목/화/토/금/수 5개 키의 개수 객체 (합계 0~8)
 */
export function countOheng(myeongsik: Myeongsik): Record<Oheng, number> {
  const counts: Record<Oheng, number> = { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
  const pillars = [
    myeongsik.year,
    myeongsik.month,
    myeongsik.day,
    myeongsik.hour,
  ];
  for (const p of pillars) {
    if (!p) continue;
    const cheonganOheng = CHEONGAN_OHENG[p.cheongan];
    const jijiOheng = JIJI_OHENG[p.jiji];
    if (cheonganOheng) counts[cheonganOheng] += 1;
    if (jijiOheng) counts[jijiOheng] += 1;
  }
  return counts;
}
