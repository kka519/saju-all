// 다크 톤 friendly markdown 렌더 — prose-saju(라이트용)와 분리.
// SajuResult 5섹션 카드 + /onboarding/preview 무료 운세 공통.
// arbitrary variant 의존 없이 ReactMarkdown components prop 으로 명시적 스타일.
// 2-B 이후 단계에서 prose-saju 자체에 다크 변종 도입 후 통합 가능.

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// 한국어 마크다운 강조 정규화 — LLM이 만드는 4가지 깨짐 패턴 보정.
//
// CommonMark `**` 강조의 flanking 규칙은 CJK 환경에서 자주 깨짐:
//   - 여는 ** 직후 공백 → left-flanking 실패 (opening 인식 X)
//   - 닫는 ** 직전 공백 → right-flanking 실패 (closing 인식 X)
//   - 닫는 ** 뒤 문장부호+한글 조사 → right-flanking 실패
//
// (3)/(4) 단계는 강조 content 첫 글자가 문장부호이면 매치 제외 — 두 별개 강조 사이
// `**A**, **B**` 패턴을 `**,**` 가짜 강조로 오인해 침범하지 않도록.
//
// 적용 순서: 가장 구체적 → 일반.
// 적용 범위: 모든 LLM 출력 화면 (preview, SajuResult, 향후 결과지 등).
function preprocessKoreanBold(text: string): string {
  return (
    text
      // (1) 양쪽 공백 trim: `** X **` → `**X**`
      .replace(/\*\* +([^*\n]+?) +\*\*/g, "**$1**")
      // (2) 여는 ** 직후 공백만 trim: `** X**` → `**X**`
      .replace(/\*\* +([^*\s][^*\n]*?)\*\*/g, "**$1**")
      // (3) 닫는 ** 직전 공백만 trim: `**X **` → `**X**`
      //     content 첫 글자가 문장부호인 경우(예: `**, **`)는 가짜 매치라 제외.
      .replace(
        /\*\*([^*\s,.()!?:;'"][^*\n]*?[^*\s]|[^*\s,.()!?:;'"]) +\*\*/g,
        "**$1**",
      )
      // (4) 닫는 ** 직후 한글 앞에 공백 1칸 (CJK 경계 right-flanking 보장)
      //     content 첫 글자가 문장부호인 경우(예: `**,**의`)는 가짜 매치라 제외.
      .replace(
        /(\*\*[^*\s,.()!?:;'"][^*\n]*?\*\*)(?=[가-힣])/g,
        "$1 ",
      )
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
