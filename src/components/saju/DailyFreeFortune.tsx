"use client";

// 로그인 사용자의 "오늘의 무료 운세" — /free-fortune 페이지 본체.
// 저장된 생년월일이 있으면 즉시 자동 호출, 없으면 1회성 입력 폼을 먼저 보여준다.
// 하루 1회 제한(429, stage: "rate-limited")은 별도 안내 화면으로 분기.

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { saveSajuInputCarryover } from "@/lib/saju-input-carryover";

// 잠금 티저 구조(지시문_무료운세_잠금티저_20260721.md §1) — 서버가 공개 블록은
// 실제 텍스트, 잠금 블록(locked.*)은 더미 placeholder로 이미 치환해 내려준다.
// 실제 흐름/포인트/내일 텍스트는 이 컴포넌트에 절대 도달하지 않는다.
type FreeFortuneLocked = {
  flowMorning: string;
  flowAfternoon: string;
  flowEvening: string;
  pointTake: string;
  pointAvoid: string;
  tomorrow: string;
};
type FreeFortuneData = {
  dayTone: "good" | "mixed" | "caution";
  headline: string;
  psychSnipe: string;
  weatherReason: string;
  goldenTimeLabel: string;
  locked: FreeFortuneLocked;
};
type ApiResponse =
  | { ok: true; fortune: FreeFortuneData }
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

// 잠금 블록 한 줄 — 라벨은 코드가 렌더(콜론 스타일), 서버가 이미 더미로 치환한
// placeholder를 블러 처리해 "내용이 있어 보이는" 티저 효과만 낸다. 실제 텍스트는
// 애초에 이 컴포넌트에 전달되지 않는다(서버에서 치환됨).
function LockedLine({ label, text }: { label?: string; text: string }) {
  return (
    <p className="text-sm text-night-fg-soft leading-relaxed" aria-label="유료 결제 후 확인 가능한 잠금 콘텐츠">
      {label ? <span className="font-semibold text-night-fg">{label} : </span> : null}
      <span aria-hidden="true" className="select-none blur-[4px]">{text}</span>
      <span className="ml-1 align-middle" aria-hidden="true">🔒</span>
    </p>
  );
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
  const [fortune, setFortune] = useState<FreeFortuneData | null>(null);
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
    // 폼이 길어서(생년월일+시간+달력+성별) 제출 시점에 스크롤이 아래로 내려가
    // 있는 경우가 많다 — 로딩/결과 화면은 페이지 최상단에 렌더되므로 매번
    // 상단으로 스크롤해 첫 화면이 빈 밤하늘로 보이지 않게 한다.
    window.scrollTo({ top: 0 });
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
          window.scrollTo({ top: 0 });
          return;
        }
        if (json.stage === "no-saved-birth-info") {
          setState("form");
          window.scrollTo({ top: 0 });
          return;
        }
        setErrorMsg(json.error || "알 수 없는 오류가 났어요.");
        setState("error");
        window.scrollTo({ top: 0 });
        return;
      }
      setFortune(json.fortune);
      setState("success");
      window.scrollTo({ top: 0 });
    } catch {
      setErrorMsg("별빛 신호가 끊겼어요. 인터넷을 확인하고 다시 시도해주세요.");
      setState("error");
      window.scrollTo({ top: 0 });
    }
  }

  useEffect(() => {
    if (hasSavedBirthInfo) void callApi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit() {
    if (!canSubmit) return;
    // 유료 결제 폼 프리필용 이월(지시문_사주입력_프리필_20260721.md §1②) —
    // 직접 타이핑한 값도 프로필 저장값과 동일하게 재사용될 수 있도록 세션에
    // 남긴다. 서버 저장은 하지 않음(sessionStorage만, saju-input-carryover.ts).
    saveSajuInputCarryover({
      birthDate: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
      birthTime: hourUnknown || !hour || !minute ? null : `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`,
      timeUnknown: hourUnknown,
      gender,
      calendar: calendar === "양력" ? "solar" : "lunar",
      isLeapMonth: false,
    });
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

  if (state === "success" && fortune) {
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

        {/* 공개 블록 — 헤드라인·심리 저격·날씨(오행 비유)·골든타임 시각 */}
        <div className="rounded-2xl border border-night-border bg-night-secondary p-5 text-left space-y-4">
          <p className="text-lg font-semibold leading-snug text-night-fg">{fortune.headline}</p>
          <p className="text-sm text-night-fg-soft leading-relaxed">{fortune.psychSnipe}</p>
          <p className="text-sm text-night-fg-soft leading-relaxed">{fortune.weatherReason}</p>
          <p className="inline-flex items-center rounded-full bg-starlight/15 px-3 py-1 text-xs font-semibold text-starlight">
            골든타임 : {fortune.goldenTimeLabel}
          </p>
        </div>

        {/* 잠금 블록 — 시간대 상세/포인트/내일 예고는 더미로 블러 처리 */}
        <div className="rounded-2xl border border-night-border bg-night-secondary p-5 text-left space-y-4">
          <p className="text-xs font-mono text-night-fg-muted">오늘의 흐름</p>
          <LockedLine label="오전" text={fortune.locked.flowMorning} />
          <LockedLine label="오후" text={fortune.locked.flowAfternoon} />
          <LockedLine label="저녁" text={fortune.locked.flowEvening} />

          <p className="text-xs font-mono text-night-fg-muted pt-2">오늘의 포인트</p>
          <LockedLine label="취할 것" text={fortune.locked.pointTake} />
          <LockedLine label="피할 것" text={fortune.locked.pointAvoid} />

          <p className="text-xs font-mono text-night-fg-muted pt-2">내일 예고</p>
          <LockedLine text={fortune.locked.tomorrow} />

          <div className="pt-2 border-t border-night-border/60 space-y-3">
            <p className="text-sm text-night-fg-soft">
              오전·오후·저녁 흐름과 오늘의 처방은 880원 풀이에서 열어보세요
            </p>
            <Link
              href="/products/today-fortune"
              className="block w-full h-12 rounded-full bg-starlight text-night-primary text-base font-medium leading-[3rem] text-center hover:bg-starlight-soft transition-colors"
            >
              더 깊은 풀이 열어보기
            </Link>
          </div>
        </div>
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
