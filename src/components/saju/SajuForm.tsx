"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { isValidLunarDate } from "@/lib/saju/lunar-validation";

type Props = {
  productId: string;
  productSlug: string;
  isLoggedIn: boolean;
  /** couple-match 등 상대방 정보가 필수인 상품일 때 true — "상대방 정보" 섹션을 렌더한다. */
  requiresPartner?: boolean;
};

const CONCERN_OPTIONS = ["연애", "결혼", "직장", "재물", "건강", "학업", "이직", "사업"];

// 출생 시각 입력 — 본인/상대방이 동일 컴포넌트를 공유한다. 오전/오후 토글 교체(별도
// 지시문)가 진행되면 이 컴포넌트 하나만 바꾸면 양쪽에 한 번에 적용된다.
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
  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-birthTime`}>출생 시각</Label>
      <Input
        id={`${idPrefix}-birthTime`}
        type="time"
        value={time}
        onChange={(e) => onTimeChange(e.target.value)}
        disabled={timeUnknown}
      />
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

export function SajuForm({ productId, productSlug, isLoggedIn, requiresPartner = false }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [gender, setGender] = useState<"male" | "female">("male");
  const [calendar, setCalendar] = useState<"solar" | "lunar">("solar");
  const [isLeapMonth, setIsLeapMonth] = useState(false);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // 상대방 정보 — couple-match(requiresPartner) 전용.
  const [partnerName, setPartnerName] = useState("");
  const [partnerBirthDate, setPartnerBirthDate] = useState("");
  const [partnerBirthTime, setPartnerBirthTime] = useState("");
  const [partnerTimeUnknown, setPartnerTimeUnknown] = useState(false);
  const [partnerGender, setPartnerGender] = useState<"male" | "female">("male");
  const [partnerCalendar, setPartnerCalendar] = useState<"solar" | "lunar">("solar");
  const [partnerIsLeapMonth, setPartnerIsLeapMonth] = useState(false);

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
      router.push(`/checkout/${json.orderId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "오류가 발생했습니다");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
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
