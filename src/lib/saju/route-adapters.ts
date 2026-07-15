// =====================================================
// src/lib/saju/route-adapters.ts
// =====================================================
// 라우트 입력값 → 자미두수 입력값 어댑터 (서버 라우트 공통).
//
// 분리 이유:
//   Next.js 15+ App Router 의 route.ts 파일은 표준 export(GET/POST/...) 외
//   추가 export 를 금지(.next/types 인덱스 시그니처가 never 강제).
//   어댑터/타입을 route.ts 에 두면 tsc 빌드 실패 → 도메인 헬퍼로 분리.
//
// 본 모듈은 클라이언트에서 직접 호출하지 않지만, ZiweiInput 타입 import 만으로는
// 부수효과 없으므로 'server-only' 마커 없음. 실제 자미두수 계산은 호출 측에서
// computeZiweiForSlug 등 server-only 헬퍼를 통해 이뤄짐.

import type { ZiweiInput } from "./ziwei";

// ─────────────────────────────────────────────────────
// 1) /api/saju/interpret — birthInfo (zod 검증된 shape)
// ─────────────────────────────────────────────────────

/**
 * interpret route 의 birthInfo (zod 스키마 검증 후 통과한 shape).
 * 본 타입은 zod 의존성 없이 plain shape 으로 유지 — route.ts 의 zod 스키마와는
 * 별도로 관리(zod 의 z.infer 와 동일한 구조).
 */
export type BirthInfo = {
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  birthHour?: string;
  birthMinute?: string;
  calendarType: "양력" | "음력";
  gender: "male" | "female";
  isLeapMonth?: boolean;
  useYajasiRule?: boolean;
};

/**
 * birthInfo(zod 검증된 입력) → getZiwei input 어댑터.
 * 시 미상(birthHour 없음) 또는 매핑 불가 시 null 반환 → 호출처(computeZiweiForSlug)가 흡수.
 */
export function birthInfoToZiweiInput(bi: BirthInfo): ZiweiInput | null {
  if (!bi.birthHour) return null; // 시 미상 → 자미두수 계산 불가
  return {
    calendar: bi.calendarType === "양력" ? "solar" : "lunar",
    year: Number(bi.birthYear),
    month: Number(bi.birthMonth),
    day: Number(bi.birthDay),
    hour: Number(bi.birthHour),
    minute: Number(bi.birthMinute ?? "0"),
    gender: bi.gender === "male" ? "남" : "여",
    isLeapMonth: bi.isLeapMonth ?? false,
  };
}

// ─────────────────────────────────────────────────────
// 2) /api/orders/confirm — saju_inputs row
// ─────────────────────────────────────────────────────

/**
 * confirm route 의 saju_inputs DB row shape.
 */
export type SajuInputRow = {
  birth_date: string; // "YYYY-MM-DD"
  birth_time: string | null; // "HH:mm"
  time_unknown: boolean;
  calendar: "solar" | "lunar";
  gender: "male" | "female";
  concerns: string[];
  is_leap_month: boolean; // 0011 마이그레이션
};

/**
 * SajuInputRow → ZiweiInput 어댑터 (자미두수 계산용).
 * 시 미상(time_unknown=true 또는 birth_time=null) 시 null 반환 → computeZiweiForSlug가 흡수.
 */
export function sajuInputToZiweiInput(input: SajuInputRow): ZiweiInput | null {
  if (input.time_unknown || !input.birth_time) return null;
  const [y, m, d] = input.birth_date.split("-");
  const [hh, mm] = input.birth_time.split(":");
  return {
    calendar: input.calendar, // 이미 'solar' | 'lunar' — getZiwei 와 동일 포맷
    year: Number(y),
    month: Number(m),
    day: Number(d),
    hour: Number(hh),
    minute: Number(mm),
    gender: input.gender === "male" ? "남" : "여",
    isLeapMonth: input.is_leap_month,
  };
}
