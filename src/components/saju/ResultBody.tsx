// =====================================================
// 결과지 메인 본문 (LLM 풀이 마크다운) — 다크 톤 렌더
// =====================================================
// results/[resultId] 페이지의 마지막 섹션. 부모는 night-primary 다크 wrapper.
// 이전 버전은 `prose-saju` (라이트 톤) 적용 → 다크 배경에 검정 글자 콘트라스트 깨짐.
//
// 본 컴포넌트 디자인 (5-B.2 다크 마이그레이션):
//   - prose-saju 미사용 — globals.css 의 라이트 룰 의존성 제거.
//   - components prop 으로 element 별 night-* 색 명시 (Tailwind JIT 정적 인식).
//   - 메인 본문 위계: text-base 컨테이너 + h2 text-2xl / h3 text-lg (기존 prose-saju 사이즈 유지).
//   - blockquote, hr 추가 정의 (LLM 출력의 긴 본문 대응).
//   - 새 알파/토큰 도입 0 — night-fg / night-fg-soft / night-fg-muted /
//     night-elevated / night-border / starlight / starlight-soft 기존 토큰만 사용.
//
// 한국어 강조 정규화 (preprocessKoreanBold) 는 src/lib/saju/markdown.ts 공유.
// SectionMarkdown 과 같은 LLM 출력 정규화 로직 — 중복 회피.
//
// TODO: SectionMarkdown 과 통합 검토 (위계·여백만 다른 거의 동일 컴포넌트).
//       이번 스코프(다크 마이그레이션)에선 분리 유지.

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { preprocessKoreanBold } from "@/lib/saju/markdown";

export function ResultBody({ markdown }: { markdown: string }) {
  const processed = preprocessKoreanBold(markdown);
  return (
    <div className="text-base leading-7 text-night-fg-soft">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="my-4">{children}</p>,
          strong: ({ children }) => (
            <strong className="font-semibold text-night-fg">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          h2: ({ children }) => (
            <h2 className="mt-10 mb-3 text-2xl font-semibold text-night-fg">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-6 mb-2 text-lg font-semibold text-night-fg">
              {children}
            </h3>
          ),
          ul: ({ children }) => (
            <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>
          ),
          li: ({ children }) => <li className="my-1">{children}</li>,
          code: ({ children }) => (
            <code className="rounded bg-night-elevated px-1.5 py-0.5 text-[0.9em] text-night-fg">
              {children}
            </code>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-starlight underline hover:text-starlight-soft"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-4 border-l-2 border-night-border pl-4 italic text-night-fg-muted">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-6 border-t border-night-border" />,
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
