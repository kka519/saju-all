"use client";

// 화면 3 — 생년월일 + 출생 시간.
// 3 select(년/월/일) + 2 select(시/분) + 시간 모름 체크박스.
// 연도 내림차순 (2026 → 1900). 분은 5분 단위(0~55).

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getData, patchData } from "@/lib/onboarding-storage";

function range(start: number, end: number, step = 1): number[] {
  const out: number[] = [];
  if (step > 0) for (let i = start; i <= end; i += step) out.push(i);
  else for (let i = start; i >= end; i += step) out.push(i);
  return out;
}

const SELECT_CLS =
  "h-11 px-3 rounded-md border border-night-border bg-night-elevated text-night-fg text-base focus-visible:outline-none focus-visible:border-starlight";

export default function BirthPage() {
  const router = useRouter();
  const [name, setName] = useState<string | undefined>(undefined);
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [hour, setHour] = useState("");
  const [minute, setMinute] = useState("");
  const [hourUnknown, setHourUnknown] = useState(false);

  // 임신 중 부모가 미리 사주를 보고 싶을 수 있으니 다음 해(현재년+1)까지 허용.
  const MAX_YEAR = useMemo(() => new Date().getFullYear() + 1, []);
  const YEARS = useMemo(() => range(MAX_YEAR, 1900, -1), [MAX_YEAR]);
  const MONTHS = useMemo(() => range(1, 12), []);
  const DAYS = useMemo(() => range(1, 31), []);
  const HOURS = useMemo(() => range(0, 23), []);
  const MINUTES = useMemo(() => range(0, 55, 5), []);

  // 기존 데이터 복원
  useEffect(() => {
    const d = getData();
    setName(d.name);
    if (d.birthYear) setYear(d.birthYear);
    if (d.birthMonth) setMonth(d.birthMonth);
    if (d.birthDay) setDay(d.birthDay);
    if (d.birthHour) setHour(d.birthHour);
    if (d.birthMinute) setMinute(d.birthMinute);
    if (d.hourUnknown) setHourUnknown(d.hourUnknown);
  }, []);

  const canProceed = !!(year && month && day);

  function handleNext() {
    if (!canProceed) return;
    patchData({
      birthYear: year,
      birthMonth: month,
      birthDay: day,
      birthHour: hourUnknown ? undefined : hour || undefined,
      birthMinute: hourUnknown ? undefined : minute || undefined,
      hourUnknown,
    });
    router.push("/onboarding/gender");
  }

  return (
    <div className="w-full space-y-8">
      <Image
        src="/characters/doori/doori-curious.png"
        alt="두리"
        width={200}
        height={200}
        priority
        className="mx-auto rounded-full ring-1 ring-starlight/30"
      />
      <h1 className="text-2xl md:text-3xl font-semibold leading-snug">
        {name ? `${name}님,` : ""}
        {name ? <br /> : null}
        언제 태어나셨어요?
      </h1>

      <div className="space-y-4 text-left">
        {/* 생년월일 */}
        <div className="space-y-2">
          <span className="block text-sm text-night-fg-soft">생년월일</span>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className={SELECT_CLS}
              aria-label="년"
            >
              <option value="">년</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className={SELECT_CLS}
              aria-label="월"
            >
              <option value="">월</option>
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className={SELECT_CLS}
              aria-label="일"
            >
              <option value="">일</option>
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 출생 시간 */}
        <div className="space-y-2">
          <span className="block text-sm text-night-fg-soft">출생 시간</span>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={hour}
              onChange={(e) => setHour(e.target.value)}
              className={SELECT_CLS}
              disabled={hourUnknown}
              aria-label="시"
            >
              <option value="">시</option>
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}시
                </option>
              ))}
            </select>
            <select
              value={minute}
              onChange={(e) => setMinute(e.target.value)}
              className={SELECT_CLS}
              disabled={hourUnknown}
              aria-label="분"
            >
              <option value="">분</option>
              {MINUTES.map((m) => (
                <option key={m} value={m}>
                  {String(m).padStart(2, "0")}분
                </option>
              ))}
            </select>
          </div>
          <label className="mt-1 flex items-center justify-center gap-2 text-sm text-night-fg-soft">
            <input
              type="checkbox"
              checked={hourUnknown}
              onChange={(e) => setHourUnknown(e.target.checked)}
              className="h-4 w-4 accent-starlight"
            />
            시간 모름
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={handleNext}
        disabled={!canProceed}
        className="block w-full h-12 rounded-full bg-starlight text-night-primary text-base font-medium hover:bg-starlight-soft transition-colors disabled:opacity-40 disabled:hover:bg-starlight disabled:cursor-not-allowed"
      >
        다음
      </button>
    </div>
  );
}
