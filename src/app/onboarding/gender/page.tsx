"use client";

// 화면 4 — 성별 선택.
// 초기값 null: 사용자가 명시적으로 둘 중 하나 선택해야 "다음" 활성.

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getData, patchData } from "@/lib/onboarding-storage";

export default function GenderPage() {
  const router = useRouter();
  const [name, setName] = useState<string | undefined>(undefined);
  const [gender, setGender] = useState<"male" | "female" | null>(null);

  useEffect(() => {
    const d = getData();
    setName(d.name);
    if (d.gender) setGender(d.gender);
  }, []);

  function handleNext() {
    if (!gender) return;
    patchData({ gender });
    router.push("/onboarding/concerns");
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
        성별이 어떻게 되세요?
      </h1>

      <div className="grid grid-cols-2 gap-3">
        {(["male", "female"] as const).map((g) => (
          <button
            type="button"
            key={g}
            onClick={() => setGender(g)}
            aria-pressed={gender === g}
            className={`h-12 rounded-full border text-base transition-colors ${
              gender === g
                ? "border-starlight bg-starlight text-night-primary"
                : "border-night-border text-night-fg hover:border-starlight"
            }`}
          >
            {g === "male" ? "남성" : "여성"}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={handleNext}
        disabled={!gender}
        className="block w-full h-12 rounded-full bg-starlight text-night-primary text-base font-medium hover:bg-starlight-soft transition-colors disabled:opacity-40 disabled:hover:bg-starlight disabled:cursor-not-allowed"
      >
        다음
      </button>
    </div>
  );
}
