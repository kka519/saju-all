"use client";

// /demo 등 결과지에서 사용하는 client 컴포넌트.
// mount 즉시 POST /api/saju/interpret 호출 → 로딩/에러/성공 3상태.
// SSR과 분리되어 페이지 자체는 빠르게 응답하고, 무거운 API+LLM은 client에서.

import { useEffect, useState } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MyeongsikTable } from "@/components/saju/MyeongsikTable";
import type { BirthInfo, SimpleMyeongsik } from "@/lib/saju/saju-api";
import { dooriCardSrc, getResultDoori, type ResultSection } from "@/lib/saju/doori";

type Sections = {
  greeting: string;
  saju: string;
  coreReading: string;
  advice: string;
  closing: string;
};

type ApiResponse =
  | {
      ok: true;
      sections: Sections;
      myeongsik: SimpleMyeongsik;
      meta: { provider: string; model: string; elapsedApi: number; elapsedLlm: number; parseError?: boolean };
    }
  | {
      ok: false;
      stage: string;
      error: string;
      detail?: unknown;
    };

const LOADING_MESSAGES = [
  "두리가 만세력을 펼치고 있어요...",
  "별빛을 모으는 중이에요...",
  "그대의 사주를 두리가 살짝 들여다보고 있어요...",
  "13년 명리학을 두리가 짚어보고 있어요...",
  "별빛 사이로 그대 사주가 떠오르고 있어요...",
  "두리가 명리학 책장을 넘기는 중이에요...",
  "잠깐만요, 두리가 한 번 더 살펴볼게요...",
  "그대 일주를 두리가 가만히 매만지는 중이에요...",
  "오행이 어떻게 어우러지는지 두리가 보고 있어요...",
  "조금만 더 기다려 주세요, 곧 풀어드릴게요...",
];

const SECTION_META: { key: keyof Sections & ResultSection; label: string }[] = [
  { key: "greeting", label: "두리의 인사" },
  { key: "saju", label: "사주 원국 요약" },
  { key: "coreReading", label: "핵심 풀이" },
  { key: "advice", label: "오늘의 조언" },
  { key: "closing", label: "두리의 마무리" },
];

type Props = {
  birthInfo: BirthInfo;
  slug?: string;
  productName?: string;
  concerns?: string[];
};

export function SajuResult({
  birthInfo,
  slug = "basic-saju",
  productName = "기본 사주",
  concerns = [],
}: Props) {
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [msgIndex, setMsgIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);

  // fetch 실행 — attempt 바뀔 때마다 재시도. birthInfo는 페이지 생애주기 동안 안정적이라 dep에서 제외.
  useEffect(() => {
    const ctrl = new AbortController();
    setState("loading");
    setMsgIndex(0);

    fetch("/api/saju/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birthInfo, slug, productName, concerns }),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        const json: ApiResponse = await res.json();
        setData(json);
        setState(json.ok ? "success" : "error");
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === "AbortError") return;
        setData({
          ok: false,
          stage: "network-error",
          error: "별빛 신호가 끊겼어요. 인터넷을 확인하고 다시 시도해 주세요.",
        });
        setState("error");
      });

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // 로딩 중 메시지 4초마다 순환
  useEffect(() => {
    if (state !== "loading") return;
    const t = setInterval(() => {
      setMsgIndex((i) => (i + 1) % LOADING_MESSAGES.length);
    }, 4000);
    return () => clearInterval(t);
  }, [state]);

  if (state === "loading") {
    return (
      <div className="mt-10 rounded-lg border border-night-border bg-night-secondary p-10 text-center">
        <div className="inline-block">
          <Image
            src="/characters/doori/doori-magic-solid.png"
            alt="두리"
            width={96}
            height={96}
            className="rounded-full ring-2 ring-starlight/40"
            priority
          />
        </div>
        <div className="mt-6 inline-flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-starlight animate-pulse" />
          <span className="inline-block h-2 w-2 rounded-full bg-starlight animate-pulse [animation-delay:200ms]" />
          <span className="inline-block h-2 w-2 rounded-full bg-starlight animate-pulse [animation-delay:400ms]" />
        </div>
        <p
          key={msgIndex}
          className="mt-5 text-sm text-night-fg-soft transition-opacity duration-500"
          aria-live="polite"
        >
          {LOADING_MESSAGES[msgIndex]}
        </p>
        <p className="mt-2 text-xs text-night-fg-muted">
          만세력 + 풀이 생성에 보통 20~30초가 걸려요.
        </p>
      </div>
    );
  }

  if (state === "error" || (data && !data.ok)) {
    const err = data && !data.ok ? data : null;
    return (
      <div className="mt-10 rounded-lg border border-night-border bg-night-secondary p-10 text-center">
        <Image
          src="/characters/doori/doori-sad.png"
          alt="두리(슬픔)"
          width={96}
          height={96}
          className="mx-auto rounded-full ring-2 ring-night-border"
        />
        <p className="mt-6 text-base font-semibold text-night-fg">
          {err?.error ?? "알 수 없는 오류가 났어요."}
        </p>
        {err?.detail ? (
          <p className="mt-2 text-xs text-night-fg-muted">
            (디버그: {typeof err.detail === "string" ? err.detail : JSON.stringify(err.detail)})
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setAttempt((a) => a + 1)}
          className="mt-6 inline-flex h-10 items-center rounded-full bg-starlight px-5 text-sm font-medium text-night-primary hover:bg-starlight-soft transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  // success
  if (!data || !data.ok) return null;
  const { sections, myeongsik, meta } = data;

  return (
    <div className="mt-10 space-y-6">
      {/* 메타 배지 */}
      <div className="flex flex-wrap gap-2 text-xs font-mono">
        <span className="inline-flex items-center gap-1.5 px-3 h-7 rounded-full border border-starlight/40 text-starlight">
          <span className="h-1.5 w-1.5 rounded-full bg-starlight" />
          {meta.provider}/{meta.model}
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 h-7 rounded-full border border-night-border text-night-fg-soft">
          명식 {meta.elapsedApi}ms · 풀이 {meta.elapsedLlm}ms
        </span>
        {meta.parseError ? (
          <span className="inline-flex items-center px-3 h-7 rounded-full border border-rose-400/40 text-rose-300">
            JSON 파싱 폴백 (raw text 노출 중)
          </span>
        ) : null}
      </div>

      {/* 도입 한마디 — 명식 표 부담 완화 (입문자 배려) */}
      <div className="rounded-2xl border border-night-border bg-night-secondary p-5 md:p-6 flex items-center gap-4">
        <Image
          src="/characters/doori/doori-magic-solid.png"
          alt="두리"
          width={56}
          height={56}
          className="shrink-0 rounded-full ring-1 ring-starlight/30"
        />
        <p className="text-sm md:text-base text-night-fg-soft leading-relaxed">
          두리가 그대의 사주를 살짝 펼쳐봤어요 <span className="text-starlight">✨</span>
          <br />
          아래 명식부터 차근차근 풀어드릴게요.
        </p>
      </div>

      {/* 명식 표 */}
      <section>
        <h2 className="text-xs font-mono uppercase tracking-wider text-night-fg-muted mb-3">
          사주 명식
        </h2>
        <MyeongsikTable myeongsik={myeongsik} />
      </section>

      {/* 5섹션 카드 — 섹션별 두리 등장 */}
      {SECTION_META.map(({ key, label }) => {
        const body = sections[key];
        if (!body) return null;
        const dooriSrc = dooriCardSrc(getResultDoori(key, slug));
        return (
          <section
            key={key}
            className="rounded-2xl border border-night-border bg-night-secondary p-6 md:p-7"
          >
            <header className="flex items-center gap-4 mb-5">
              {/* 두리 원형 칩 — 80px outer, 64px 두리(솔리드 PNG를 rounded-full로 원형 클립) */}
              <div className="relative h-20 w-20 shrink-0 rounded-full bg-night-elevated ring-1 ring-starlight/20 flex items-center justify-center overflow-hidden">
                <Image
                  src={dooriSrc}
                  alt="두리"
                  width={64}
                  height={64}
                  className="rounded-full object-contain"
                />
              </div>
              <h2 className="text-xl md:text-2xl font-semibold text-night-fg">{label}</h2>
            </header>
            <SectionMarkdown markdown={body} />
          </section>
        );
      })}
    </div>
  );
}

// 다크 톤 friendly markdown 렌더 — prose-saju(라이트용)와 분리.
// arbitrary variant 의존 없이 ReactMarkdown components prop 으로 명시적 스타일.
// 2-B 에서 prose-saju 다크 변종 도입 후 통합 예정.
function SectionMarkdown({ markdown }: { markdown: string }) {
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
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
