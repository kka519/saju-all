// 다크 톤 friendly markdown 렌더 — prose-saju(라이트용)와 분리.
// SajuResult 5섹션 카드 + /onboarding/preview 무료 운세 공통.
// arbitrary variant 의존 없이 ReactMarkdown components prop 으로 명시적 스타일.
// TODO: ResultBody 와의 통합 가능성 검토 (현재 위계·여백만 다른 거의 동일 코드).
//
// 한국어 강조 정규화는 src/lib/saju/markdown.ts 의 preprocessKoreanBold 공유.
// (results 페이지 ResultBody 와 동일 로직 — 중복 회피.)

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { preprocessKoreanBold } from "@/lib/saju/markdown";

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
