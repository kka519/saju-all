"use client";

// 결제 직후 진행 화면 — mount 시 POST /generate 1회 호출(백그라운드 트리거) 후
// GET /status 를 3초 간격 폴링. done 되면 /reports/[id] 로 자동 이동.
// 로딩 UX는 SajuResult.tsx 패턴(두리 + 순환 메시지)을 진행률 바와 함께 확장.

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { REPORT_STAGE_MESSAGES } from "@/lib/loading-messages";

type StatusResponse = {
  status: "pending" | "generating" | "done" | "failed";
  stage: string | null;
  progressPct: number;
  errorMessage: string | null;
  attemptCount: number;
};

export default function ReportProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<StatusResponse | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const startedRef = useRef(false);

  const startGeneration = async () => {
    setStartError(null);
    try {
      const res = await fetch(`/api/reports/${id}/generate`, { method: "POST" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setStartError(json.error ?? "리포트 생성을 시작하지 못했어요.");
      }
    } catch {
      setStartError("네트워크 오류로 시작하지 못했어요.");
    }
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void startGeneration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/reports/${id}/status`);
        if (!res.ok || cancelled) return;
        const json: StatusResponse = await res.json();
        if (cancelled) return;
        setData(json);
        if (json.status === "done") {
          router.replace(`/reports/${id}`);
        }
      } catch {
        // 폴링 1회 실패는 무시 — 다음 tick 에서 재시도
      }
    };
    void poll();
    const t = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [id, router]);

  const failed = data?.status === "failed" || !!startError;
  const message = startError
    ?? (data?.errorMessage ||
      (data?.stage ? REPORT_STAGE_MESSAGES[data.stage] : undefined) ||
      "두리가 리포트 작성을 준비하고 있어요...");
  const progressPct = data?.progressPct ?? 1;

  return (
    <div className="container py-16 max-w-md">
      <div className="rounded-lg border border-night-border bg-night-secondary p-10 flex flex-col items-center text-center">
        <Image
          src={`/characters/doori/${failed ? "doori-sad" : "doori-magic-solid"}.png`}
          alt="두리"
          width={96}
          height={96}
          className="rounded-full ring-2 ring-starlight/40"
          priority
        />

        {!failed && (
          <>
            <div className="mt-6 w-full h-2 rounded-full bg-night-elevated overflow-hidden">
              <div
                className="h-full bg-starlight transition-all duration-500"
                style={{ width: `${Math.min(progressPct, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-night-fg-muted font-mono">{progressPct}%</p>
          </>
        )}

        <p className="mt-5 text-sm text-night-fg-soft" aria-live="polite">
          {message}
        </p>
        {!failed && (
          <p className="mt-2 text-xs text-night-fg-muted">
            20페이지 리포트 작성에 보통 1~3분이 걸려요. 페이지를 벗어나도 계속 만들어져요.
          </p>
        )}

        {failed && (
          <button
            type="button"
            onClick={() => void startGeneration()}
            className="mt-6 inline-flex h-10 items-center rounded-full bg-starlight px-5 text-sm font-medium text-night-primary hover:bg-starlight-soft transition-colors"
          >
            다시 시도
          </button>
        )}
      </div>
    </div>
  );
}
