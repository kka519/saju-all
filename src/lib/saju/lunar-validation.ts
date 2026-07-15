// =====================================================
// 음력 윤달 유효성 검증
// =====================================================
// KARI(한국천문연구원) 기준 변환 테이블을 내장한 korean-lunar-calendar 로 검증.
// setLunarDate 는 윤달 존재 여부뿐 아니라 음력 날짜 자체(예: 30일이 없는 달)도
// 함께 걸러준다 — 직접 윤달 표를 하드코딩하지 않는다(운세위키_API_가이드.md §3,
// 지시문_윤달입력_20260715.md 참고).

import KoreanLunarCalendar from "korean-lunar-calendar";

export function isValidLunarDate(
  year: number,
  month: number,
  day: number,
  isLeapMonth: boolean,
): boolean {
  const calendar = new KoreanLunarCalendar();
  return calendar.setLunarDate(year, month, day, isLeapMonth);
}
