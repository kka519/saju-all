"use client";

// 별빛 밤 배경 — PRD §8.1 "별빛 = 파스텔 핑크/라벤더, 다크 배경에서 빛남"
// 40개 별이 2~4초 주기로 깜빡이고, 30초마다 유성이 한 번 흘러내림.
// SSR 시 Math.random hydration mismatch 회피를 위해 client mount 후 생성.

import { useEffect, useState } from "react";

type Star = {
  x: number;        // % from left
  y: number;        // % from top
  size: number;     // px
  opacity: number;  // base opacity (0.3~0.8)
  delay: number;    // s
  duration: number; // s
};

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
          className="absolute rounded-full bg-white animate-twinkle"
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
