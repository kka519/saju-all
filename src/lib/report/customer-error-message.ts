// =====================================================
// 리포트 생성 실패 — 고객 노출용 메시지 매핑
// =====================================================
// error_message 원문(Anthropic/Supabase/PDF 렌더 등 내부 에러의 raw message)은
// DB에는 그대로 저장해 디버깅에 쓰되, 고객 화면에는 절대 노출하지 않는다 —
// 내부 API 이름·경로·스택 일부가 섞여 나올 수 있어 보안/신뢰도 리스크(2026-07-17,
// 배포 전 보완). life-analyst-report/couple-reports 양쪽 status route 공용.

export function toCustomerErrorMessage(rawErrorMessage: string | null | undefined): string | null {
  if (!rawErrorMessage) return null;
  return "일시적인 오류로 리포트 생성에 실패했습니다. 다시 시도해 주세요. 문제가 계속되면 고객센터로 문의해 주세요.";
}
