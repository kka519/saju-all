"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Props = {
  productId: string;
  productSlug: string;
  isLoggedIn: boolean;
};

const CONCERN_OPTIONS = ["연애", "결혼", "직장", "재물", "건강", "학업", "이직", "사업"];

export function SajuForm({ productId, productSlug, isLoggedIn }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [gender, setGender] = useState<"male" | "female">("male");
  const [calendar, setCalendar] = useState<"solar" | "lunar">("solar");
  const [concerns, setConcerns] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function toggleConcern(c: string) {
    setConcerns((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!birthDate) {
      toast.error("생년월일을 입력해 주세요");
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
          concerns,
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
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">이름 (선택)</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="birthDate">생년월일</Label>
          <Input id="birthDate" type="date" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="birthTime">출생 시각</Label>
          <Input
            id="birthTime"
            type="time"
            value={birthTime}
            onChange={(e) => setBirthTime(e.target.value)}
            disabled={timeUnknown}
          />
          <label className="flex items-center gap-2 text-sm text-night-fg-soft">
            <input type="checkbox" checked={timeUnknown} onChange={(e) => setTimeUnknown(e.target.checked)} />
            시 모름
          </label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
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
        <div className="space-y-2">
          <Label>달력</Label>
          <div className="flex gap-2">
            {(["solar", "lunar"] as const).map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => setCalendar(c)}
                className={`flex-1 h-10 rounded-full border text-sm transition-colors ${calendar === c ? "border-starlight bg-starlight text-night-primary" : "border-night-border text-night-fg hover:border-starlight"}`}
              >
                {c === "solar" ? "양력" : "음력"}
              </button>
            ))}
          </div>
        </div>
      </div>

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
