// =====================================================
// KST(Asia/Seoul) 날짜 경계 헬퍼
// =====================================================
// 서버가 어느 리전에서 돌든(Vercel 기본은 UTC) "오늘"을 한국 자정 기준으로
// 고정하기 위한 유틸. 표시용 포맷팅(today-fortune 등 기존 코드)과 달리, 이건
// DB의 date 컬럼과 그대로 비교 가능한 "YYYY-MM-DD" 키를 만드는 용도.

/** KST 기준 오늘 날짜를 "YYYY-MM-DD"로 반환. */
export function getTodayKST(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}
