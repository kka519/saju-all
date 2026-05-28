// =====================================================
// src/lib/saju/ziwei.ts
// =====================================================
// 자미두수 래퍼 모듈 (iztro 기반)
//
// ⚠️ 서버 전용 — 'server-only' import로 빌드 타임 클라이언트 번들 차단.
//    클라이언트 컴포넌트에서 import 시도 시 Next.js 빌드 에러 발생.
//
// 검증 기준: 본인 사주(1971-4-25 음력, 사시, 여) → 한국 표준 명반과 93.9% 일치.
// 로케일: ko-KR (별 이름 한국어 직접 출력)

import "server-only";
import { astro } from "iztro";

// ─────────────────────────────────────────────────────
// STEP 1: 시진 인덱스 변환
// ─────────────────────────────────────────────────────

/**
 * 24시간제 시·분을 자미두수 시진 인덱스(0~11)로 변환.
 *
 * 시진 매핑:
 *   자시=0: 23:00~00:59  (자시 경계 — 23시대와 0시대 모두)
 *   축시=1: 01:00~02:59
 *   인시=2: 03:00~04:59
 *   묘시=3: 05:00~06:59
 *   진시=4: 07:00~08:59
 *   사시=5: 09:00~10:59
 *   오시=6: 11:00~12:59
 *   미시=7: 13:00~14:59
 *   신시=8: 15:00~16:59
 *   유시=9: 17:00~18:59
 *   술시=10: 19:00~20:59
 *   해시=11: 21:00~22:59
 *
 * @param hour - 24시간제 시 (0~23)
 * @param _minute - 분 (0~59) — 현재 매핑에 영향 없음. iztro의 fixLeap 옵션이 절기 보정 처리.
 * @returns 시진 인덱스 (0~11)
 * @throws RangeError - hour 또는 minute가 유효 범위를 벗어날 때
 */
export function hourToTimeIndex(hour: number, _minute: number): number {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError(`hour must be integer 0~23, got: ${hour}`);
  }
  if (!Number.isInteger(_minute) || _minute < 0 || _minute > 59) {
    throw new RangeError(`minute must be integer 0~59, got: ${_minute}`);
  }

  // 자시 경계 (23시대) → 0
  if (hour === 23) return 0;

  // 그 외 0~22 → (hour + 1) / 2 의 정수부
  // hour=0 → 0 (자시) / hour=1,2 → 1 (축시) / hour=21,22 → 11 (해시)
  return Math.floor((hour + 1) / 2);
}

// ─────────────────────────────────────────────────────
// STEP 2: 메인 함수 getZiwei
// ─────────────────────────────────────────────────────

/**
 * 자미두수 명반 생성 입력.
 */
export type ZiweiInput = {
  /** 양력/음력 구분 */
  calendar: "solar" | "lunar";
  /** 출생년 (양력 또는 음력에 따라 의미 다름) */
  year: number;
  /** 출생월 1~12 */
  month: number;
  /** 출생일 1~31 */
  day: number;
  /** 24시간제 출생시 0~23 */
  hour: number;
  /** 출생분 0~59 (현재 시진 매핑에는 영향 없음 — 정시 보정은 iztro fixLeap 옵션 처리) */
  minute: number;
  /** 성별 — 단일 글자 입력 */
  gender: "남" | "여";
  /** 윤달 여부 (calendar='lunar' 일 때만 의미 있음, 기본 false). 양력일 경우 무시. */
  isLeapMonth?: boolean;
};

// 입력 '남'/'여' → ko-KR 로케일 gender 표기 ('남성'/'여자') 매핑.
// 어제 검증 작업(scripts/test-iztro.ts)에서 사용한 값과 동일 — ko-KR locale .d.ts 확인.
const GENDER_KO: Record<ZiweiInput["gender"], "남성" | "여자"> = {
  남: "남성",
  여: "여자",
};

/**
 * 자미두수 명반 생성. iztro `astro.bySolar` 또는 `astro.byLunar` 래퍼.
 *
 * @param input 입력 정보 (양/음력, 생년월일시, 성별, 윤달 여부)
 * @returns iztro astrolabe 객체 (FunctionalAstrolabe — 12궁, 사화, 명/신주 등 포함)
 *
 * @throws RangeError - hour/minute 범위 외 (hourToTimeIndex 내부 검증)
 *
 * iztro 시그니처 (node_modules/iztro/lib/astro/astro.d.ts 직접 확인):
 *   bySolar(solarDate, timeIndex, gender, fixLeap?, language?)
 *   byLunar(lunarDateStr, timeIndex, gender, isLeapMonth?, fixLeap?, language?)
 */
export function getZiwei(input: ZiweiInput) {
  const timeIndex = hourToTimeIndex(input.hour, input.minute);
  const dateStr = `${input.year}-${input.month}-${input.day}`;
  const gender = GENDER_KO[input.gender];
  const fixLeap = true; // 절기 보정 켬 (윤달의 전반=전월, 후반=다음월)

  if (input.calendar === "lunar") {
    return astro.byLunar(
      dateStr,
      timeIndex,
      gender,
      input.isLeapMonth ?? false,
      fixLeap,
      "ko-KR",
    );
  }

  // 양력 — bySolar는 isLeapMonth 인자 없음 (iztro 시그니처)
  return astro.bySolar(dateStr, timeIndex, gender, fixLeap, "ko-KR");
}

// ─────────────────────────────────────────────────────
// STEP 3: 요약 추출 함수
// ─────────────────────────────────────────────────────

/** 별 정보 (이름 + 사화 옵션) — 주성·보좌성용 */
export type ZiweiStarWithMutagen = {
  name: string;
  /** 사화: 록·권·과·기 (없으면 undefined) */
  mutagen?: string;
};

/** 잡요성 — 사화 없음, 이름만 */
export type ZiweiStarAdjective = {
  name: string;
};

/** 12궁 한 칸 */
export type ZiweiPalaceSummary = {
  /** 궁 이름 (예: '명궁', '재백', '복덕') */
  name: string;
  /** 천간 (예: '갑', '을') */
  heavenlyStem: string;
  /** 지지 (예: '자', '축') */
  earthlyBranch: string;
  /** 0~11 인덱스 */
  index: number;
  /** 주성 + 사화 */
  majorStars: ZiweiStarWithMutagen[];
  /** 보좌성 + 사화 */
  minorStars: ZiweiStarWithMutagen[];
  /** 잡요성 (사화 없음) */
  adjectiveStars: ZiweiStarAdjective[];
};

/** extractZiweiSummary 반환 타입 — JSON 직렬화 안전한 plain 객체 */
export type ZiweiSummary = {
  /** 명궁 지지 */
  soulPalaceBranch: string;
  /** 신궁 지지 */
  bodyPalaceBranch: string;
  /** 명주 (예: '탐랑') */
  soul: string;
  /** 신주 (예: '천기') */
  body: string;
  /** 오행국 (예: '토오국') */
  fiveElementsClass: string;
  /** 사주 명식 (예: '신해 계사 갑진 기사') */
  chineseDate: string;
  /** 12궁 배열 */
  palaces: ZiweiPalaceSummary[];
};

/**
 * iztro astrolabe 객체에서 자미두수 요약 정보를 추출 (plain JSON-safe 객체).
 *
 * - LLM 프롬프트 / DB 직렬화 / 클라이언트 전송 등 다양한 용도에 사용 가능.
 * - 함수 메서드(horoscope, palace 등)는 제외, 순수 데이터만 반환.
 *
 * @param astrolabe `getZiwei()` 의 반환값 (또는 직접 호출한 iztro astrolabe)
 * @returns 요약 정보
 */
export function extractZiweiSummary(
  astrolabe: ReturnType<typeof getZiwei>,
): ZiweiSummary {
  return {
    soulPalaceBranch: astrolabe.earthlyBranchOfSoulPalace,
    bodyPalaceBranch: astrolabe.earthlyBranchOfBodyPalace,
    soul: astrolabe.soul,
    body: astrolabe.body,
    fiveElementsClass: astrolabe.fiveElementsClass,
    chineseDate: astrolabe.chineseDate,
    palaces: astrolabe.palaces.map((palace) => ({
      name: palace.name,
      heavenlyStem: palace.heavenlyStem,
      earthlyBranch: palace.earthlyBranch,
      index: palace.index,
      majorStars: palace.majorStars.map((s) => ({
        name: s.name,
        ...(s.mutagen ? { mutagen: s.mutagen } : {}),
      })),
      minorStars: palace.minorStars.map((s) => ({
        name: s.name,
        ...(s.mutagen ? { mutagen: s.mutagen } : {}),
      })),
      adjectiveStars: palace.adjectiveStars.map((s) => ({ name: s.name })),
    })),
  };
}
