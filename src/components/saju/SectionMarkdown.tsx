// 다크 톤 friendly markdown 렌더 — prose-saju(라이트용)와 분리.
// SajuResult 5섹션 카드 + /onboarding/preview 무료 운세 공통.
// arbitrary variant 의존 없이 ReactMarkdown components prop 으로 명시적 스타일.
// 2-B 이후 단계에서 prose-saju 자체에 다크 변종 도입 후 통합 가능.

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// 한국어 마크다운 강조 정규화 — CJK 경계 right-flanking 보장만 처리.
//
// 배경:
//   CommonMark `**` 강조의 flanking 규칙은 CJK 환경에서 깨짐. 특히 `**한자(漢字)**조사`
//   패턴은 닫는 `**` 뒤가 한글 조사(non-ws/non-punct)면 right-flanking 실패 → 리터럴 별표.
//   이를 막기 위해 닫는 ** 직후 한글 앞에 공백 1칸 자동 삽입.
//
// content 첫 글자가 문장부호이면 매치 제외 — `**A**, **B**` 패턴에서 `**, **`을
// 가짜 강조로 오인해 두 별개 강조를 침범하지 않도록.
//
// 적용 범위: 모든 LLM 출력 화면 (preview, SajuResult, 향후 결과지 등).
//
// NOTE (이전 시도 회고):
//   - step 1 (`** X **` 양쪽 공백 trim), step 2 (`** X**` 여는 공백 trim),
//     step 3 (`**X **` 닫는 공백 trim) 모두 cross-bold 침범 문제 발생.
//     세 정규식 모두 두 별개 강조 사이의 한글/단어를 가짜 강조로 매치해서
//     정상 텍스트의 단어 공백을 파괴하는 부작용 보유.
//   - `** X **`/`** X**`/`**X **` 같은 LLM 변동성 패턴은 프롬프트 강화로 source 단에서
//     1차 방어 + 이 정규식 단순화로 정상 텍스트 보호.
//   - LLM이 그 패턴을 계속 만들면 옵션 C (marked 라이브러리) 또는 D (HTML strong + rehype-raw) 검토.
function preprocessKoreanBold(text: string): string {
  return text.replace(
    /(\*\*[^*\s,.()!?:;'"][^*\n]*?\*\*)(?=[가-힣])/g,
    "$1 ",
  );
}

export function SectionMarkdown({ markdown }: { markdown: string }) {
  const processed = preprocessKoreanBold(markdown);
  return (
    <div className="text-sm leading-7 text-night-fg-soft">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-2">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-night-fg">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          h2: ({ children }) => (
            <h2 className="mt-4 mb-2 text-base font-semibold text-night-fg">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3 mb-1.5 text-sm font-semibold text-night-fg">{children}</h3>
          ),
          ul: ({ children }) => (
            <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>
          ),
          li: ({ children }) => <li className="my-1">{children}</li>,
          code: ({ children }) => (
            <code className="rounded bg-night-elevated px-1.5 py-0.5 text-[0.9em] text-night-fg">
              {children}
            </code>
          ),
          a: ({ href, children }) => (
            <a href={href} className="text-starlight underline hover:text-starlight-soft">
              {children}
            </a>
          ),
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
