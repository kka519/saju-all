// =====================================================
// src/lib/saju/markdown.ts
// =====================================================
// LLM 마크다운 출력 정규화 공용 유틸.
// SajuResult/onboarding preview (SectionMarkdown), results 페이지 (ResultBody)
// 등 LLM 출력 화면 공통으로 import.

/**
 * 한국어 마크다운 강조 정규화 — CJK 경계 right-flanking 보장.
 *
 * 배경:
 *   CommonMark `**` 강조의 flanking 규칙은 CJK 환경에서 깨짐. 특히 `**한자(漢字)**조사`
 *   패턴은 닫는 `**` 뒤가 한글 조사(non-ws/non-punct)면 right-flanking 실패 → 리터럴 별표.
 *   이를 막기 위해 닫는 ** 직후 한글 앞에 공백 1칸 자동 삽입.
 *
 * content 첫 글자가 문장부호이면 매치 제외 — `**A**, **B**` 패턴에서 `**, **`을
 * 가짜 강조로 오인해 두 별개 강조를 침범하지 않도록.
 *
 * 적용 범위: 모든 LLM 출력 화면 (preview, SajuResult, results body).
 *
 * NOTE (이전 시도 회고):
 *   - step 1 (`** X **` 양쪽 공백 trim), step 2 (`** X**` 여는 공백 trim),
 *     step 3 (`**X **` 닫는 공백 trim) 모두 cross-bold 침범 문제 발생.
 *     세 정규식 모두 두 별개 강조 사이의 한글/단어를 가짜 강조로 매치해서
 *     정상 텍스트의 단어 공백을 파괴하는 부작용 보유.
 *   - `** X **`/`** X**`/`**X **` 같은 LLM 변동성 패턴은 프롬프트 강화로 source 단에서
 *     1차 방어 + 이 정규식 단순화로 정상 텍스트 보호.
 *   - LLM이 그 패턴을 계속 만들면 옵션 C (marked 라이브러리) 또는
 *     D (HTML strong + rehype-raw) 검토.
 */
export function preprocessKoreanBold(text: string): string {
  return text.replace(
    /(\*\*[^*\s,.()!?:;'"][^*\n]*?\*\*)(?=[가-힣])/g,
    "$1 ",
  );
}
