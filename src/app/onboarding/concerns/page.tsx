"use client";

// 화면 5 — 관심사 복수 선택.
// 8개 pill 2열 그리드. 최소 1개 선택해야 "다음" 활성.

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getData, patchData } from "@/lib/onboarding-storage";

const OPTIONS = [
  "연애",
  "결혼",
  "직장",
  "재물",
  "건강",
  "학업",
  "이직",
  "사업",
] as const;

export default function ConcernsPage() {
  const router = useRouter();
  const [name, setName] = useState<string | undefined>(undefined);
  const [concerns, setConcerns] = useState<string[]>([]);

  useEffect(() => {
    const d = getData();
    setName(d.name);
    if (d.concerns && d.concerns.length > 0) setConcerns(d.concerns);
  }, []);

  function toggle(c: string) {
    setConcerns((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  function handleNext() {
    if (concerns.length === 0) return;
    patchData({ concerns });
    router.push("/onboarding/preview");
  }

  return (
    <div className="w-full space-y-8">
      <Image
        src="/characters/doori/doori-saju.png"
        alt="두리"
        width={200}
        height={200}
        priority
        className="mx-auto rounded-full ring-1 ring-starlight/30"
      />

      <div>
        <h1 className="text-2xl md:text-3xl font-semibold leading-snug">
          {name ? `${name}님,` : ""}
          {name ? <br /> : null}
          어떤 이야기가 듣고 싶어요?
        </h1>
        <p className="mt-2 text-xs text-night-fg-muted">복수 선택 가능</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {OPTIONS.map((c) => {
          const selected = concerns.includes(c);
          return (
            <button
              type="button"
              key={c}
              onClick={() => toggle(c)}
              aria-pressed={selected}
              className={`h-11 rounded-full border text-sm transition-colors ${
                selected
                  ? "border-starlight bg-starlight text-night-primary"
                  : "border-night-border text-night-fg hover:border-starlight"
              }`}
            >
              {c}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleNext}
        disabled={concerns.length === 0}
        className="block w-full h-12 rounded-full bg-starlight text-night-primary text-base font-medium hover:bg-starlight-soft transition-colors disabled:opacity-40 disabled:hover:bg-starlight disabled:cursor-not-allowed"
      >
        다음
      </button>
    </div>
  );
}
