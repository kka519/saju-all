// =====================================================
// 필드 글자수 강제 클램프
// =====================================================
// LLM은 프롬프트에 적은 max_chars 지시를 종종 초과한다 — A4 고정 페이지 레이아웃에선
// 이게 그대로 페이지 밀림으로 이어지므로, 파싱 단계에서 최종 방어선으로 자른다.
// 문장 중간에서 끊기지 않도록 마지막 종결 문장부호(다./요./음./…) 기준으로 자르고,
// 못 찾으면 그냥 길이로 잘라 "…" 를 붙인다.

export function clampChars(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastPunct = Math.max(cut.lastIndexOf("다."), cut.lastIndexOf("요."), cut.lastIndexOf("음."));
  if (lastPunct > maxChars * 0.6) return cut.slice(0, lastPunct + 1);
  return cut.slice(0, maxChars - 1) + "…";
}

export function clampArray(arr: string[], maxChars: number): string[] {
  return arr.map((s) => clampChars(s, maxChars));
}

/**
 * ** 마크다운 볼드 마커 제거 — {{md}} 헬퍼 없이 plain 렌더되는 필드용
 * (표의 짧은 셀: 항목명/진단/근거/유형/시기 등). md 필드는 <b>로 변환되지만
 * plain 필드에 ** 가 남으면 리터럴 별표로 노출되므로 파싱 단계에서 벗겨낸다.
 */
export function stripBold(text: string): string {
  return text.replace(/\*\*/g, "");
}
