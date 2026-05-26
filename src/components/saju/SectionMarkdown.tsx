// 다크 톤 friendly markdown 렌더 — prose-saju(라이트용)와 분리.
// SajuResult 5섹션 카드 + /onboarding/preview 무료 운세 공통.
// arbitrary variant 의존 없이 ReactMarkdown components prop 으로 명시적 스타일.
// 2-B 이후 단계에서 prose-saju 자체에 다크 변종 도입 후 통합 가능.

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// CommonMark right-flanking 규칙: `**한자(漢字)**조사` 패턴에서 닫는 ** 직전이
// 문장부호(`)` 등)이고 직후가 한글 조사이면 닫는 강조로 인식 안 됨 → 리터럴 별표.
// 닫는 ** 직후 한글 앞에 공백 한 칸 삽입해 strong 렌더 보장.
// 적용 대상: 모든 LLM 출력 화면 (preview, SajuResult, 향후 결과지 등).
function preprocessKoreanBold(text: string): string {
  return text.replace(/(\*\*[^*\n]+?\*\*)(?=[가-힣])/g, "$1 ");
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
