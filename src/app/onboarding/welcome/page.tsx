"use client";

// 화면 1 — 두리 인사 (대화형 첫 화면).
// doori-magic-solid 200px: 첫인상은 깨끗한 카와이 칩.

import Image from "next/image";
import Link from "next/link";

export default function WelcomePage() {
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
        매일매일 두리가
        <br />
        운세를 알려드릴게요!
      </h1>
      <Link
        href="/onboarding/name"
        className="block w-full h-12 rounded-full bg-starlight text-night-primary text-base font-medium leading-[3rem] hover:bg-starlight-soft transition-colors"
      >
        좋아! 시작할게
      </Link>
    </div>
  );
}
