"use client";

// 화면 2 — 이름 입력 + 반응.
// sub-state: "input" → "reaction" (라우트 변경 없이 한 화면에서 전환).
// 알파 키잉 폐기 정책에 따라 모든 두리 솔리드 + ring으로 통일.
// input  : doori-curious 200px (호기심)
// reaction: doori-magic-solid 200px (반짝 별빛 ring으로 마법 효과)

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { getData, patchData } from "@/lib/onboarding-storage";

export default function NamePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"input" | "reaction">("input");
  const [name, setName] = useState("");

  // 새로고침/돌아오기 시 기존 이름 복원
  useEffect(() => {
    const d = getData();
    if (d.name) setName(d.name);
  }, []);

  function handleNext() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setName(trimmed);
    setPhase("reaction");
  }

  function handleConfirm() {
    patchData({ name: name.trim() });
    router.push("/onboarding/birth");
  }

  if (phase === "reaction") {
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
        <h1 className="text-2xl md:text-3xl font-semibold leading-snug">
          {name}님!
          <br />
          멋진 이름이네요 <span className="text-starlight">✨</span>
        </h1>
        <button
          type="button"
          onClick={handleConfirm}
          className="block w-full h-12 rounded-full bg-starlight text-night-primary text-base font-medium hover:bg-starlight-soft transition-colors"
        >
          고마워! 😊
        </button>
      </div>
    );
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
        그전에...
        <br />
        이름을 뭐라고 불러드릴까요?
      </h1>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="홍길동"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleNext();
          }
        }}
        className="w-full h-12 px-4 rounded-full border border-night-border bg-night-elevated text-night-fg text-base text-center placeholder:text-night-fg-muted focus-visible:outline-none focus-visible:border-starlight"
      />
      <button
        type="button"
        onClick={handleNext}
        disabled={!name.trim()}
        className="block w-full h-12 rounded-full bg-starlight text-night-primary text-base font-medium hover:bg-starlight-soft transition-colors disabled:opacity-40 disabled:hover:bg-starlight disabled:cursor-not-allowed"
      >
        다음
      </button>
    </div>
  );
}
