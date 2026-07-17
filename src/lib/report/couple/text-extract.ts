// =====================================================
// 커플 궁합 리포트 — 페이지 골격 재배치용 문장 추출
// =====================================================
// 2026-07-17 채움률 실측(평균 53%)에도 사장님이 "70% 미달" 판정 — LLM 재생성
// 없이 이미 생성된 프로즈 안에서 문장을 뽑아 풀쿼트(킬러 문장)·결론 배너로
// 재배치하는 것으로 방향 전환. 새 텍스트를 만들지 않고 기존 문장만 골라 크게
// 보여주는 순수 재배치 — "계산은 코드가" 원칙과 동일하게 문장 선택도 결정적
// 규칙(길이·숫자 포함 여부)으로만 고른다.

/** 한국어 종결어미 기준으로 문장을 분리한다("다.", "요.", "까?", "다!" 등 뒤). */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * 킬러 문장(풀쿼트) 후보 — 너무 짧거나(설명 부족) 너무 길지(레이아웃 파괴) 않은
 * 문장 중, 숫자·간지 등 구체성이 있는 문장을 우선한다. 없으면 중간 길이 문장.
 */
export function extractPullQuote(text: string, opts?: { minLen?: number; maxLen?: number }): string {
  const minLen = opts?.minLen ?? 28;
  const maxLen = opts?.maxLen ?? 70;
  const sentences = splitSentences(text);
  const candidates = sentences.filter((s) => s.length >= minLen && s.length <= maxLen);
  if (candidates.length === 0) {
    // 후보가 없으면 가장 길이가 maxLen에 가까운 문장을 자른다.
    const longest = sentences.reduce((a, b) => (b.length > a.length ? b : a), sentences[0] ?? text);
    return longest.length > maxLen ? `${longest.slice(0, maxLen - 1)}…` : longest;
  }
  const withNumber = candidates.filter((s) => /\d/.test(s));
  const pool = withNumber.length > 0 ? withNumber : candidates;
  // 결정적 선택 — 풀 중 가장 긴 문장(정보 밀도가 가장 높다고 가정).
  return pool.reduce((a, b) => (b.length > a.length ? b : a), pool[0]);
}

/** 결론 배너 — 문단의 마지막 문장을 그대로 쓴다(한국어 에세이는 대개 마지막 문장이 결론). */
export function extractConclusion(text: string, maxLen = 60): string {
  const sentences = splitSentences(text);
  const last = sentences[sentences.length - 1] ?? text;
  return last.length > maxLen ? `${last.slice(0, maxLen - 1)}…` : last;
}
