// =====================================================
// 만세력/명식 fetch-or-mock 폴백 — 결제 완료 이후 라우트 공용
// =====================================================
// orders/confirm/route.ts(8개 일반 상품 + today-fortune)와
// couple-reports/[id]/generate/route.ts(커플 궁합 리포트 백그라운드 파이프라인)가
// 공유한다. Next.js route.ts 파일은 표준 export 외 추가 export 를 금지(.next/types
// 검증)하므로 route.ts 안에 두지 않고 별도 모듈로 분리.

import { computeMyeongsik, type Myeongsik } from "@/lib/saju/manseryeok";
import {
  isSajuApiConfigured,
  fetchSajuAnalysis,
  formatSajuToManseryeok,
  ganjiToMyeongsik,
  type AnalysisField,
  type BirthInfo,
  type SajuAnalysisResponse,
} from "@/lib/saju/saju-api";

// 본인(SajuInputRow 전체)과 상대방(partner_* 필드 5개)이 공유하는 최소 구조.
// couple-match 상대방 데이터도 이 타입으로 동일한 폴백 로직을 재사용한다.
export type BirthInputLike = {
  birth_date: string;
  birth_time: string | null;
  time_unknown: boolean;
  gender: "male" | "female";
  calendar: "solar" | "lunar";
  is_leap_month: boolean;
};

export function toBirthInfo(input: BirthInputLike): BirthInfo {
  const [y, m, d] = input.birth_date.split("-");
  const hasTime = !input.time_unknown && !!input.birth_time;
  const [hh, mm] = hasTime ? input.birth_time!.split(":") : [undefined, undefined];
  return {
    birthYear: y,
    birthMonth: String(parseInt(m, 10)),
    birthDay: String(parseInt(d, 10)),
    ...(hasTime ? { birthHour: String(parseInt(hh!, 10)), birthMinute: String(parseInt(mm!, 10)) } : {}),
    calendarType: input.calendar === "lunar" ? "음력" : "양력",
    gender: input.gender,
    isLeapMonth: input.is_leap_month,
  };
}

export function toComputeInput(input: BirthInputLike) {
  return {
    birthDate: input.birth_date,
    birthTime: input.birth_time,
    timeUnknown: input.time_unknown,
    calendar: input.calendar,
    gender: input.gender,
  };
}

// luckyloveme API-or-mock 폴백 — 본인/상대방 공용(couple-match는 이 함수를 2회 호출,
// 서로 독립적으로 폴백된다: 본인 성공+상대 실패 조합도 허용).
// fields 생략 시 16종 전체([]) 요청 — couple-match 만 COUPLE_MATCH_FIELDS(경량)로 좁힌다.
// 이유: 두 사람 분 전체 16필드를 합치면 프롬프트가 160K+자로 커져 LLM 응답이 잘리는
// 문제가 실측 확인됨(2026-07-15) — src/lib/saju/saju-api.ts COUPLE_MATCH_FIELDS 참고.
export async function fetchMyeongsikWithFallback(
  input: BirthInputLike,
  fields: AnalysisField[] = [],
): Promise<{ myeongsik: Myeongsik; manseryeokText?: string; fullAnalysis: SajuAnalysisResponse | null }> {
  if (!isSajuApiConfigured()) {
    return { myeongsik: await computeMyeongsik(toComputeInput(input)), fullAnalysis: null };
  }
  try {
    const birthInfo = toBirthInfo(input);
    const analysis = await fetchSajuAnalysis(birthInfo, fields, { source: "confirm" });
    const converted = ganjiToMyeongsik(analysis);
    if (converted) {
      return { myeongsik: converted, manseryeokText: formatSajuToManseryeok(analysis, birthInfo), fullAnalysis: analysis };
    }
    // ganji 필드 누락 — mock 으로 폴백
    return { myeongsik: await computeMyeongsik(toComputeInput(input)), fullAnalysis: null };
  } catch (apiErr) {
    // luckyloveme 호출 실패 — 결제는 이미 승인됐으므로 mock 으로 폴백해서 결과지는 무조건 생성
    console.error("[saju-api] fallback to mock:", apiErr);
    return { myeongsik: await computeMyeongsik(toComputeInput(input)), fullAnalysis: null };
  }
}
