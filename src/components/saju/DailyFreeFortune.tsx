"use client";

// 로그인 사용자의 "오늘의 무료 운세" — /free-fortune 페이지 본체.
// 저장된 생년월일이 있으면 즉시 자동 호출, 없으면 1회성 입력 폼을 먼저 보여준다.
// 하루 1회 제한(429, stage: "rate-limited")은 별도 안내 화면으로 분기.

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { SectionMarkdown } from "@/components/saju/SectionMarkdown";

type ApiResponse =
  | { ok: true; fortune: string }
  | { ok: false; stage: string; error: string };

type State = "form" | "loading" | "success" | "rate-limited" | "error";

const SELECT_CLS =
  "h-11 px-3 rounded-md border border-night-border bg-night-elevated text-night-fg text-base focus-visible:outline-none focus-visible:border-starlight";

function range(start: number, end: number, step = 1): number[] {
  const out: number[] = [];
  if (step > 0) for (let i = start; i <= end; i += step) out.push(i);
  else for (let i = start; i >= end; i += step) out.push(i);
  return out;
}

type BirthInfoPayload = {
  birthYear: string;
  birthMonth: string;
  birthDay: string;
  birthHour?: string;
  birthMinute?: string;
  calendarType: "양력" | "음력";
  gender: "male" | "female";
};

export function DailyFreeFortune({
  hasSavedBirthInfo,
  displayName,
}: {
  hasSavedBirthInfo: boolean;
  displayName: string | null;
}) {
  const [state, setState] = useState<State>(hasSavedBirthInfo ? "loading" : "form");
  const [fortune, setFortune] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // 입력 폼 상태(저장된 생년월일이 없을 때만 사용)
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [hourUnknown, setHourUnknown] = useState(false);
  const [calendar, setCalendar] = useState<"양력" | "음력">("양력");
  const [gender, setGender] = useState<"male" | "female">("female");

  const MAX_YEAR = new Date().getFullYear() + 1;
  const YEARS = range(MAX_YEAR, 1900, -1);
  const MONTHS = range(1, 12);
  const DAYS = range(1, 31);
  const HOURS = range(0, 23);
  const MINUTES = range(0, 55, 5);
  const canSubmit = !!(year && month && day);

  async function callApi(birthInfo?: BirthInfoPayload) {
    setState("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/saju/free-fortune", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(birthInfo ? { birthInfo, concerns: [] } : {}),
      });
      const json: ApiResponse = await res.json();
      if (!json.ok) {
        if (json.stage === "rate-limited") {
          setState("rate-limited");
          return;
        }
        if (json.stage === "no-saved-birth-info") {
          setState("form");
          return;
        }
        setErrorMsg(json.error || "알 수 없는 오류가 났어요.");
        setState("error");
        return;
      }
      setFortune(json.fortune);
      setState("success");
    } catch {
      setErrorMsg("별빛 신호가 끊겼어요. 인터넷을 확인하고 다시 시도해주세요.");
      setState("error");
    }
  }

  useEffect(() => {
    if (hasSavedBirthInfo) void callApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit() {
    if (!canSubmit) return;
    void callApi({
      birthYear: year,
      birthMonth: month,
      birthDay: day,
      ...(hourUnknown ? {} : { birthHour: hour || undefined, birthMinute: minute || undefined }),
      calendarType: calendar,
      gender,
    });
  }

  if (state === "loading") {
    return (
      <div className="space-y-6">
        <Image
          src="/characters/doori/doori-magic-solid.png"
          alt="두리"
          width={160}
          height={160}
          priority
          className="mx-auto rounded-full ring-1 ring-starlight/30"
        />
        <p className="text-sm text-night-fg-soft">두리가 오늘의 운세를 준비하고 있어요...</p>
      </div>
    );
  }

  if (state === "rate-limited") {
    return (
      <div className="space-y-6">
        <Image
          src="/characters/doori/doori-magic-solid.png"
          alt="두리"
          width={160}
          height={160}
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

  if (state === "error") {
    return (
      <div className="space-y-6">
        <p className="text-base font-semibold text-night-fg">두리가 잠시 별을 못 찾았어요.</p>
        {errorMsg ? <p className="text-xs text-night-fg-muted">{errorMsg}</p> : null}
        <button
          type="button"
          onClick={() => (hasSavedBirthInfo ? void callApi() : setState("form"))}
          className="block w-full h-12 rounded-full bg-starlight text-night-primary text-base font-medium hover:bg-starlight-soft transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="space-y-6">
        <Image
          src="/characters/doori/doori-magic-solid.png"
          alt="두리"
          width={160}
          height={160}
          className="mx-auto rounded-full ring-1 ring-starlight/30"
        />
        <h1 className="text-xl font-semibold text-night-fg">오늘의 무료 운세</h1>
        <div className="rounded-2xl border border-night-border bg-night-secondary p-5 text-left">
          <SectionMarkdown markdown={fortune} />
        </div>
        <Link
          href="/products"
          className="block w-full h-12 rounded-full bg-starlight text-night-primary text-base font-medium leading-[3rem] hover:bg-starlight-soft transition-colors"
        >
          더 깊은 풀이 보러 가기
        </Link>
      </div>
    );
  }

  // state === "form" — 저장된 생년월일이 없는 첫 방문
  return (
    <div className="space-y-8 text-left">
      <div className="text-center space-y-2">
        <Image
          src="/characters/doori/doori-curious.png"
          alt="두리"
          width={160}
          height={160}
          className="mx-auto rounded-full ring-1 ring-starlight/30"
        />
        <h1 className="text-xl font-semibold text-night-fg">
          {displayName ? `${displayName}님,` : ""} 처음이시네요!
        </h1>
        <p className="text-sm text-night-fg-soft">한 번만 입력하면 다음부턴 매일 바로 받아보실 수 있어요.</p>
      </div>

      <div className="space-y-2">
        <span className="block text-sm text-night-fg-soft">생년월일</span>
        <div className="grid grid-cols-3 gap-2">
          <select value={year} onChange={(e) => setYear(e.target.value)} className={SELECT_CLS} aria-label="년">
            <option value="">년</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select value={month} onChange={(e) => setMonth(e.target.value)} className={SELECT_CLS} aria-label="월">
            <option value="">월</option>
            {MONTHS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
          <select value={day} onChange={(e) => setDay(e.target.value)} className={SELECT_CLS} aria-label="일">
            <option value="">일</option>
            {DAYS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <span className="block text-sm text-night-fg-soft">출생 시간</span>
        <div className="grid grid-cols-2 gap-2">
          <select value={hour} onChange={(e) => setHour(e.target.value)} className={SELECT_CLS} disabled={hourUnknown} aria-label="시">
            <option value="">시</option>
            {HOURS.map((h) => (
              <option key={h} value={h}>{String(h).padStart(2, "0")}시</option>
            ))}
          </select>
          <select value={minute} onChange={(e) => setMinute(e.target.value)} className={SELECT_CLS} disabled={hourUnknown} aria-label="분">
            <option value="">분</option>
            {MINUTES.map((m) => (
              <option key={m} value={m}>{String(m).padStart(2, "0")}분</option>
            ))}
          </select>
        </div>
        <label className="mt-1 flex items-center justify-center gap-2 text-sm text-night-fg-soft">
          <input type="checkbox" checked={hourUnknown} onChange={(e) => setHourUnknown(e.target.checked)} className="h-4 w-4 accent-starlight" />
          시간 모름
        </label>
      </div>

      <div className="space-y-2">
        <span className="block text-sm text-night-fg-soft">달력</span>
        <div className="grid grid-cols-2 gap-2">
          {(["양력", "음력"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCalendar(c)}
              aria-pressed={calendar === c}
              className={`h-11 rounded-full border text-sm transition-colors ${
                calendar === c ? "border-starlight bg-starlight text-night-primary" : "border-night-border text-night-fg hover:border-starlight"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <span className="block text-sm text-night-fg-soft">성별</span>
        <div className="grid grid-cols-2 gap-2">
          {([["female", "여성"], ["male", "남성"]] as const).map(([g, label]) => (
            <button
              key={g}
              type="button"
              onClick={() => setGender(g)}
              aria-pressed={gender === g}
              className={`h-11 rounded-full border text-sm transition-colors ${
                gender === g ? "border-starlight bg-starlight text-night-primary" : "border-night-border text-night-fg hover:border-starlight"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="block w-full h-12 rounded-full bg-starlight text-night-primary text-base font-medium hover:bg-starlight-soft transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        오늘의 운세 받기
      </button>
    </div>
  );
}
