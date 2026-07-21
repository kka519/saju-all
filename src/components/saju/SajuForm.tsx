"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { isValidLunarDate } from "@/lib/saju/lunar-validation";
import {
  getSajuInputCarryover,
  saveSajuInputCarryover,
  clearSajuInputCarryover,
} from "@/lib/saju-input-carryover";

type Props = {
  productId: string;
  productSlug: string;
  isLoggedIn: boolean;
  /** couple-match 등 상대방 정보가 필수인 상품일 때 true — "상대방 정보" 섹션을 렌더한다. */
  requiresPartner?: boolean;
  /**
   * 프리필 소스(지시문_사주입력_프리필_20260721.md §1) — 로그인 사용자의 저장된
   * 사주 정보(profiles). 없으면(비로그인 또는 아직 저장값 없는 신규 가입) 컴포넌트가
   * 마운트 시 세션 이월값(carryover)으로 폴백한다. 이번 지시 범위는 오늘의 운세
   * 상품뿐이라 호출부(products/[slug]/page.tsx)가 today-fortune일 때만 넘긴다.
   */
  initialValues?: {
    name?: string;
    birthDate?: string;
    birthTime?: string | null;
    timeUnknown?: boolean;
    gender?: "male" | "female";
    calendar?: "solar" | "lunar";
    isLeapMonth?: boolean;
  };
};

const CONCERN_OPTIONS = ["연애", "결혼", "직장", "재물", "건강", "학업", "이직", "사업"];

function range(start: number, end: number, step = 1): number[] {
  const out: number[] = [];
  if (step > 0) for (let i = start; i <= end; i += step) out.push(i);
  else for (let i = start; i >= end; i += step) out.push(i);
  return out;
}

const HOURS_12 = range(1, 12);
const MINUTES = range(0, 55, 5);

const TIME_SELECT_CLS =
  "h-10 px-3 rounded-md border border-hairline bg-canvas text-ink text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// 24시간 문자열("HH", 0~23) ↔ 오전/오후 + 1~12시 변환 — 표준 12시간제
// (오전 12시=00시/자정, 오후 12시=12시/정오). 자시 경계(23시/00시/01시 직전)
// UI→24시간 변환이 이 두 함수에 전부 걸려있다(지시문_사주입력_프리필_20260721.md §3).
function to24Hour(period: "AM" | "PM", hour12: number): string {
  const h24 = period === "AM" ? (hour12 === 12 ? 0 : hour12) : hour12 === 12 ? 12 : hour12 + 12;
  return String(h24).padStart(2, "0");
}
function from24Hour(hour24: number): { period: "AM" | "PM"; hour12: number } {
  const period: "AM" | "PM" = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { period, hour12 };
}

// 출생 시각 입력 — 본인/상대방이 동일 컴포넌트를 공유한다. 오전/오후 토글 +
// 1~12시 select로 통일(2026-07-21, 7/14 이월 미해결 건 — 네이티브 time input은
// 오전/오후 전환이 숨겨져 있어 입력 오류를 유발했다). 외부 계약(time: "HH:mm"
// 문자열)은 그대로라 orders/create 스키마·profiles.birth_time 컬럼은 무변경.
function BirthTimeField({
  idPrefix,
  time,
  onTimeChange,
  timeUnknown,
  onTimeUnknownChange,
}: {
  idPrefix: string;
  time: string;
  onTimeChange: (v: string) => void;
  timeUnknown: boolean;
  onTimeUnknownChange: (v: boolean) => void;
}) {
  const [hh, mm] = time ? time.split(":") : ["", ""];
  const hour24 = hh !== "" ? parseInt(hh, 10) : null;
  const derived = hour24 !== null && !Number.isNaN(hour24) ? from24Hour(hour24) : null;
  const period = derived?.period ?? null;
  const hour12 = derived?.hour12 ?? "";
  const minute = mm !== "" ? mm : "";

  // 셋 중 하나만 바뀌어도 나머지 둘의 현재 값과 합쳐 "HH:mm"을 다시 조립한다.
  // period가 아직 없는 상태로 시/분만 먼저 고르면 오전으로 기본 처리한다(흔한
  // 타임피커 관례 — 이후 오전/오후 버튼으로 언제든 바꿀 수 있어 데이터 무결성
  // 문제는 없다).
  function emit(nextPeriod: "AM" | "PM" | null, nextHour12: number | "", nextMinute: string) {
    if (nextHour12 === "" || nextMinute === "") {
      onTimeChange("");
      return;
    }
    const hh24 = to24Hour(nextPeriod ?? "AM", nextHour12);
    onTimeChange(`${hh24}:${nextMinute.padStart(2, "0")}`);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-birthHour`}>출생 시각</Label>
      <div className="grid grid-cols-2 gap-2">
        {(["AM", "PM"] as const).map((p) => (
          <button
            type="button"
            key={p}
            disabled={timeUnknown}
            onClick={() => emit(p, hour12 === "" ? 12 : hour12, minute || "00")}
            aria-pressed={period === p}
            className={`h-10 rounded-md border text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              period === p ? "border-starlight bg-starlight text-night-primary" : "border-hairline text-ink hover:border-starlight"
            }`}
          >
            {p === "AM" ? "오전" : "오후"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select
          id={`${idPrefix}-birthHour`}
          value={hour12}
          onChange={(e) => emit(period, e.target.value ? Number(e.target.value) : "", minute || "00")}
          disabled={timeUnknown}
          className={TIME_SELECT_CLS}
          aria-label="시"
        >
          <option value="">시</option>
          {HOURS_12.map((h) => (
            <option key={h} value={h}>{h}시</option>
          ))}
        </select>
        <select
          value={minute}
          onChange={(e) => emit(period, hour12 === "" ? 12 : hour12, e.target.value)}
          disabled={timeUnknown}
          className={TIME_SELECT_CLS}
          aria-label="분"
        >
          <option value="">분</option>
          {MINUTES.map((m) => (
            <option key={m} value={m}>{String(m).padStart(2, "0")}분</option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-night-fg-soft">
        <input
          type="checkbox"
          checked={timeUnknown}
          onChange={(e) => onTimeUnknownChange(e.target.checked)}
        />
        시 모름
      </label>
    </div>
  );
}

const CALENDAR_OPTIONS = [
  { text: "양력", calendar: "solar" as const, isLeapMonth: false },
  { text: "음력", calendar: "lunar" as const, isLeapMonth: false },
  { text: "음력 윤달", calendar: "lunar" as const, isLeapMonth: true },
];

// 달력 선택 — 본인/상대방이 동일 컴포넌트를 공유한다. 버튼 하나가 calendar+isLeapMonth
// 두 값을 함께 세팅한다("음력 윤달" = calendar:"lunar" + isLeapMonth:true).
function CalendarField({
  label,
  calendar,
  isLeapMonth,
  onChange,
}: {
  label: string;
  calendar: "solar" | "lunar";
  isLeapMonth: boolean;
  onChange: (calendar: "solar" | "lunar", isLeapMonth: boolean) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        {CALENDAR_OPTIONS.map((opt) => {
          const active = calendar === opt.calendar && isLeapMonth === opt.isLeapMonth;
          return (
            <button
              type="button"
              key={opt.text}
              onClick={() => onChange(opt.calendar, opt.isLeapMonth)}
              className={`flex-1 h-10 rounded-full border text-sm transition-colors ${active ? "border-starlight bg-starlight text-night-primary" : "border-night-border text-night-fg hover:border-starlight"}`}
            >
              {opt.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 음력(평달/윤달) 선택 시 결제 전 유효성 확인 — 없는 연월에 윤달을 선택하면 결제 후
// API 실패→mock 폴백→틀린 결과 발행으로 이어지므로 반드시 결제 전에 걸러낸다.
function validateLunarDate(dateStr: string, calendar: "solar" | "lunar", isLeapMonth: boolean): boolean {
  if (calendar !== "lunar") return true;
  const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
  return isValidLunarDate(y, m, d, isLeapMonth);
}

export function SajuForm({ productId, productSlug, isLoggedIn, requiresPartner = false, initialValues }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initialValues?.name ?? "");
  const [birthDate, setBirthDate] = useState(initialValues?.birthDate ?? "");
  const [birthTime, setBirthTime] = useState(initialValues?.birthTime ?? "");
  const [timeUnknown, setTimeUnknown] = useState(initialValues?.timeUnknown ?? false);
  const [gender, setGender] = useState<"male" | "female">(initialValues?.gender ?? "male");
  const [calendar, setCalendar] = useState<"solar" | "lunar">(initialValues?.calendar ?? "solar");
  const [isLeapMonth, setIsLeapMonth] = useState(initialValues?.isLeapMonth ?? false);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [prefilled, setPrefilled] = useState(!!initialValues?.birthDate);

  // 상대방 정보 — couple-match(requiresPartner) 전용.
  const [partnerName, setPartnerName] = useState("");
  const [partnerBirthDate, setPartnerBirthDate] = useState("");
  const [partnerBirthTime, setPartnerBirthTime] = useState("");
  const [partnerTimeUnknown, setPartnerTimeUnknown] = useState(false);
  const [partnerGender, setPartnerGender] = useState<"male" | "female">("male");
  const [partnerCalendar, setPartnerCalendar] = useState<"solar" | "lunar">("solar");
  const [partnerIsLeapMonth, setPartnerIsLeapMonth] = useState(false);

  // 프리필 폴백(§1 소스 우선순위 2) — 로그인 소스(profiles, initialValues)에 값이
  // 없을 때만(신규 가입 직후 등) 같은 세션의 무료 운세 입력값으로 채운다.
  useEffect(() => {
    if (initialValues?.birthDate) return;
    const carryover = getSajuInputCarryover();
    if (!carryover?.birthDate) return;
    if (carryover.name) setName(carryover.name);
    setBirthDate(carryover.birthDate);
    setBirthTime(carryover.birthTime ?? "");
    setTimeUnknown(carryover.timeUnknown);
    if (carryover.gender) setGender(carryover.gender);
    if (carryover.calendar) setCalendar(carryover.calendar);
    setIsLeapMonth(carryover.isLeapMonth);
    setPrefilled(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 비로그인 사용자가 로그인/가입하러 이동하기 직전 — 지금까지 입력한 값을
  // 이월 저장해 로그인 왕복(하드 네비게이션) 후에도 유실되지 않게 한다(§2).
  function saveCurrentInputAsCarryover() {
    if (!birthDate) return;
    saveSajuInputCarryover({
      name: name || undefined,
      birthDate,
      birthTime: timeUnknown ? null : birthTime || null,
      timeUnknown,
      gender,
      calendar,
      isLeapMonth,
    });
  }

  function toggleConcern(c: string) {
    setConcerns((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!birthDate) {
      toast.error("생년월일을 입력해 주세요");
      return;
    }
    // 상대방 데이터 없이 couple-match 결과 생성은 어떤 경로로도 불가능해야 한다 —
    // 이 클라 검증은 3중 방어(폼/서버/프롬프트 게이트) 중 첫 번째일 뿐, 실제 방어는
    // orders/create 서버 검증 + buildSajuPrompt 게이트가 한다.
    if (requiresPartner && !partnerBirthDate) {
      toast.error("상대방 생년월일을 입력해 주세요");
      return;
    }
    if (!validateLunarDate(birthDate, calendar, isLeapMonth)) {
      toast.error(
        isLeapMonth
          ? "선택하신 연월에는 윤달이 없어요. 평달인지 다시 확인해 주세요"
          : "생년월일을 다시 확인해 주세요",
      );
      return;
    }
    if (requiresPartner && partnerBirthDate && !validateLunarDate(partnerBirthDate, partnerCalendar, partnerIsLeapMonth)) {
      toast.error(
        partnerIsLeapMonth
          ? "상대방 연월에는 윤달이 없어요. 평달인지 다시 확인해 주세요"
          : "상대방 생년월일을 다시 확인해 주세요",
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          name,
          birthDate,
          birthTime: timeUnknown ? null : birthTime || null,
          timeUnknown,
          gender,
          calendar,
          isLeapMonth,
          concerns,
          ...(requiresPartner
            ? {
                partner: {
                  name: partnerName || undefined,
                  birthDate: partnerBirthDate,
                  birthTime: partnerTimeUnknown ? null : partnerBirthTime || null,
                  timeUnknown: partnerTimeUnknown,
                  gender: partnerGender,
                  calendar: partnerCalendar,
                  isLeapMonth: partnerIsLeapMonth,
                },
              }
            : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "주문 생성 실패");
      clearSajuInputCarryover();
      router.push(`/checkout/${json.orderId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류가 발생했습니다");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {prefilled && (
        <p className="text-xs text-night-fg-soft bg-night-elevated border border-night-border rounded-md px-3 py-2">
          아까 입력한 정보를 불러왔어요. 다르면 자유롭게 수정해 주세요.
        </p>
      )}
      <div className="space-y-5">
        {requiresPartner && (
          <h3 className="text-sm font-semibold text-night-fg">내 정보</h3>
        )}
        <div className="space-y-2">
          <Label htmlFor="name">이름 (선택)</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="birthDate">생년월일</Label>
            <Input id="birthDate" type="date" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </div>
          <BirthTimeField
            idPrefix="self"
            time={birthTime}
            onTimeChange={setBirthTime}
            timeUnknown={timeUnknown}
            onTimeUnknownChange={setTimeUnknown}
          />
        </div>

        <div className="space-y-2">
          <Label>성별</Label>
          <div className="flex gap-2">
            {(["male", "female"] as const).map((g) => (
              <button
                type="button"
                key={g}
                onClick={() => setGender(g)}
                className={`flex-1 h-10 rounded-full border text-sm transition-colors ${gender === g ? "border-starlight bg-starlight text-night-primary" : "border-night-border text-night-fg hover:border-starlight"}`}
              >
                {g === "male" ? "남성" : "여성"}
              </button>
            ))}
          </div>
        </div>
        <CalendarField
          label="달력"
          calendar={calendar}
          isLeapMonth={isLeapMonth}
          onChange={(c, leap) => {
            setCalendar(c);
            setIsLeapMonth(leap);
          }}
        />
      </div>

      {requiresPartner && (
        <div className="space-y-5 border-t border-night-border pt-6">
          <h3 className="text-sm font-semibold text-night-fg">상대방 정보</h3>
          <div className="space-y-2">
            <Label htmlFor="partnerName">상대방 이름 (선택)</Label>
            <Input
              id="partnerName"
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              placeholder="김철수"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="partnerBirthDate">상대방 생년월일</Label>
              <Input
                id="partnerBirthDate"
                type="date"
                required={requiresPartner}
                value={partnerBirthDate}
                onChange={(e) => setPartnerBirthDate(e.target.value)}
              />
            </div>
            <BirthTimeField
              idPrefix="partner"
              time={partnerBirthTime}
              onTimeChange={setPartnerBirthTime}
              timeUnknown={partnerTimeUnknown}
              onTimeUnknownChange={setPartnerTimeUnknown}
            />
          </div>

          <div className="space-y-2">
            <Label>상대방 성별</Label>
            <div className="flex gap-2">
              {(["male", "female"] as const).map((g) => (
                <button
                  type="button"
                  key={g}
                  onClick={() => setPartnerGender(g)}
                  className={`flex-1 h-10 rounded-full border text-sm transition-colors ${partnerGender === g ? "border-starlight bg-starlight text-night-primary" : "border-night-border text-night-fg hover:border-starlight"}`}
                >
                  {g === "male" ? "남성" : "여성"}
                </button>
              ))}
            </div>
          </div>
          <CalendarField
            label="상대방 달력"
            calendar={partnerCalendar}
            isLeapMonth={partnerIsLeapMonth}
            onChange={(c, leap) => {
              setPartnerCalendar(c);
              setPartnerIsLeapMonth(leap);
            }}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label>고민 (복수 선택)</Label>
        <div className="flex flex-wrap gap-2">
          {CONCERN_OPTIONS.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => toggleConcern(c)}
              className={`px-4 h-8 rounded-full border text-sm transition-colors ${concerns.includes(c) ? "border-starlight bg-starlight text-night-primary" : "border-night-border text-night-fg hover:border-starlight"}`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {isLoggedIn ? (
        <Button
          type="submit"
          size="lg"
          className="w-full bg-starlight text-night-primary hover:bg-starlight-soft"
          disabled={submitting}
        >
          {submitting ? "주문 생성 중..." : "결제하러 가기"}
        </Button>
      ) : (
        <div className="space-y-2">
          <Link
            href={`/login?redirect=${encodeURIComponent(`/products/${productSlug}`)}`}
            onClick={saveCurrentInputAsCarryover}
            className={cn(
              buttonVariants({ size: "lg" }),
              "w-full bg-starlight text-night-primary hover:bg-starlight-soft",
            )}
          >
            로그인하고 결제하기
          </Link>
          <p className="text-xs text-night-fg-soft text-center">
            결과는 로그인 후 <span className="text-starlight">마이페이지</span> 에서 확인할 수 있어요.
          </p>
        </div>
      )}
    </form>
  );
}
