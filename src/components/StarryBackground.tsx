"use client";

// 별빛 밤 배경 — PRD §8.1 "별빛 = 파스텔 핑크/라벤더, 다크 배경에서 빛남"
// 40개 별이 2~4초 주기로 깜빡이고, 30초마다 유성이 한 번 흘러내림.
// SSR 시 Math.random hydration mismatch 회피를 위해 client mount 후 생성.
//
// 5-B.2c 보강: 별 색 mixed (흰 70% + starlight 15% + starlight-soft 15%).
//   - 두리 톤(따뜻·차분) 정체성 강화 — 흰 일색이 아닌 따뜻한 금 톤 일부 섞임.
//   - 새 토큰/알파 도입 0 — starlight family 는 헤더/일주 ring 등 기존 사용 토큰.
//   - Tailwind JIT 정적 인식 위해 풀스트링 클래스를 array literal 에 박음.
//   - prefers-reduced-motion 가드는 globals.css 의 .animate-twinkle 룰에서 그대로 동작.

import { useEffect, useState } from "react";

type Star = {
  x: number;        // % from left
  y: number;        // % from top
  size: number;     // px
  opacity: number;  // base opacity (0.3~0.8)
  delay: number;    // s
  duration: number; // s
  colorCls: string; // Tailwind bg 클래스 (풀스트링 — JIT 정적 인식)
};

// 별 색 가중치 — 누적 0.70 / 0.85 / 1.00.
// 풀스트링 명시: bg-white / bg-starlight / bg-starlight-soft 모두 JIT 가 정적 인식.
const STAR_COLORS: ReadonlyArray<readonly [string, number]> = [
  ["bg-white", 0.7],
  ["bg-starlight", 0.15],
  ["bg-starlight-soft", 0.15],
];

function pickStarColor(): string {
  const r = Math.random();
  let acc = 0;
  for (const [cls, w] of STAR_COLORS) {
    acc += w;
    if (r < acc) return cls;
  }
  return "bg-white"; // fallback (수치 정확성 보장 — float 누적 오차 대비)
}

export function StarryBackground() {
  const [stars, setStars] = useState<Star[]>([]);

  useEffect(() => {
    const count = 40;
    setStars(
      Array.from({ length: count }, () => ({
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() < 0.7 ? 1 : 2,
        opacity: 0.3 + Math.random() * 0.5,
        delay: Math.random() * 4,
        duration: 2 + Math.random() * 2,
        colorCls: pickStarColor(),
      })),
    );
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {stars.map((s, i) => (
        <span
          key={i}
          className={`absolute rounded-full animate-twinkle ${s.colorCls}`}
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            opacity: s.opacity,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
            willChange: "opacity",
          }}
        />
      ))}
      <span className="meteor" />
    </div>
  );
}
