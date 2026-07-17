"use client";

// 화면 6 — 무료 운세 미리보기 (호기심 자극 + 가입 유도).
// 상태: checking → loading → success | error
// 캐싱: getData().freeFortune 있으면 재호출 X.
// 진입 검증: birthInfo/concerns 없으면 /onboarding/welcome 으로 리다이렉트.

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SectionMarkdown } from "@/components/saju/SectionMarkdown";
import {
  getData,
  patchData,
  type OnboardingData,
} from "@/lib/onboarding-storage";
import { SAJU_LOADING_MESSAGES } from "@/lib/loading-messages";
import type { BirthInfo } from "@/lib/saju/saju-api";

type ApiSuccess = { ok: true; fortune: string; meta?: { provider: string; model: string } };
type ApiError = { ok: false; stage: string; error: string; detail?: unknown };
type ApiResponse = ApiSuccess | ApiError;

type State = "checking" | "loading" | "success" | "error" | "rate-limited";

function isReady(d: OnboardingData): boolean {
  return !!(
    d.birthYear &&
    d.birthMonth &&
    d.birthDay &&
    d.concerns &&
    d.concerns.length > 0
  );
}

// onboarding flat data → BirthInfo (saju API 형식). 누락 필드는 합리적 default.
function toBirthInfo(d: OnboardingData): BirthInfo {
  return {
    birthYear: d.birthYear!,
    birthMonth: d.birthMonth!,
    birthDay: d.birthDay!,
    ...(d.hourUnknown
      ? {}
      : {
          birthHour: d.birthHour ?? "12",
          birthMinute: d.birthMinute ?? "0",
        }),
    calendarType: d.calendar === "lunar" ? "음력" : "양력",
    gender: d.gender ?? "male",
  };
}

export default function PreviewPage() {
  const router = useRouter();
  const [state, setState] = useState<State>("checking");
  const [fortune, setFortune] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [msgIndex, setMsgIndex] = useState(0);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const d = getData();

    // 진입 검증
    if (!isReady(d)) {
      router.replace("/onboarding/welcome");
      return;
    }

    // 캐시 hit
    if (d.freeFortune) {
      setFortune(d.freeFortune);
      setState("success");
      return;
    }

    // 첫 호출
    const ctrl = new AbortController();
    setState("loading");
    setMsgIndex(0);

    fetch("/api/saju/free-fortune", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        birthInfo: toBirthInfo(d),
        concerns: d.concerns,
        name: d.name,
      }),
      signal: ctrl.signal,
    })
      .then(async (res) => {
        const json: ApiResponse = await res.json();
        if (!json.ok) {
          if (json.stage === "rate-limited") {
            setState("rate-limited");
            return;
          }
          setErrorMsg(json.error || "알 수 없는 오류가 났어요.");
          setState("error");
          return;
        }
        patchData({ freeFortune: json.fortune });
        setFortune(json.fortune);
        setState("success");
      })
      .catch((err: unknown) => {
        if ((err as { name?: string })?.name === "AbortError") return;
        setErrorMsg("별빛 신호가 끊겼어요. 인터넷을 확인하고 다시 시도해주세요.");
        setState("error");
      });

    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // 로딩 메시지 4초 순환
  useEffect(() => {
    if (state !== "loading") return;
    const t = setInterval(() => {
      setMsgIndex((i) => (i + 1) % SAJU_LOADING_MESSAGES.length);
    }, 4000);
    return () => clearInterval(t);
  }, [state]);

  if (state === "checking") {
    return <p className="text-sm text-night-fg-muted">확인 중...</p>;
  }

  if (state === "loading") {
    return (
      <div className="w-full space-y-8">
        <Image
          src="/characters/doori/doori-magic-solid.png"
          alt="두리"
          width={200}
          height={200}
          priority
          className="mx-auto rounded-full ring-1 ring-starlight/30"
        />
        <div className="inline-flex items-center gap-2 mx-auto">
          <span className="h-2 w-2 rounded-full bg-starlight animate-pulse" />
          <span className="h-2 w-2 rounded-full bg-starlight animate-pulse [animation-delay:200ms]" />
          <span className="h-2 w-2 rounded-full bg-starlight animate-pulse [animation-delay:400ms]" />
        </div>
        <p
          key={msgIndex}
          className="text-base text-night-fg-soft transition-opacity duration-500"
          aria-live="polite"
        >
          {SAJU_LOADING_MESSAGES[msgIndex]}
        </p>
        <p className="text-xs text-night-fg-muted">
          만세력 + 운세 생성에 보통 15~30초가 걸려요.
        </p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="w-full space-y-8">
        <Image
          src="/characters/doori/doori-sad.png"
          alt="두리(슬픔)"
          width={96}
          height={96}
          className="mx-auto rounded-full ring-2 ring-night-border"
        />
        <p className="text-base font-semibold text-night-fg">
          두리가 잠시 별을 못 찾았어요. 다시 시도해주세요.
        </p>
        {errorMsg ? (
          <p className="text-xs text-night-fg-muted">{errorMsg}</p>
        ) : null}
        <button
          type="button"
          onClick={() => setAttempt((a) => a + 1)}
          className="block w-full h-12 rounded-full bg-starlight text-night-primary text-base font-medium hover:bg-starlight-soft transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (state === "rate-limited") {
    return (
      <div className="w-full space-y-8">
        <Image
          src="/characters/doori/doori-magic-solid.png"
          alt="두리"
          width={200}
          height={200}
          className="mx-auto rounded-full ring-1 ring-starlight/30"
        />
        <p className="text-base font-semibold text-night-fg">
          오늘의 무료 운세는 이미 받으셨어요.
          <br />내일 다시 만나요 🌙
        </p>
        <p className="text-sm text-night-fg-soft">더 깊은 풀이가 궁금하다면 유료 상품도 만나보세요.</p>
        <Link
          href="/products"
          className="block w-full h-12 rounded-full bg-starlight text-night-primary text-base font-medium leading-[3rem] hover:bg-starlight-soft transition-colors"
        >
          상품 보러 가기
        </Link>
      </div>
    );
  }

  // success
  return (
    <div className="w-full space-y-8">
      <Image
        src="/characters/doori/doori-magic-solid.png"
        alt="두리"
        width={200}
        height={200}
        priority
        className="mx-auto rounded-full ring-1 ring-starlight/30"
      />

      <div className="rounded-2xl border border-night-border bg-night-secondary p-5 md:p-6 text-left">
        <SectionMarkdown markdown={fortune} />
      </div>

      <Link
        href="/onboarding/signup"
        className="block w-full h-12 rounded-full bg-starlight text-night-primary text-base font-medium leading-[3rem] hover:bg-starlight-soft transition-colors"
      >
        잠깐! 더 놀라운 게 있어요 (가입 무료) →
      </Link>
    </div>
  );
}
