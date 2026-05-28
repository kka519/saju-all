// =====================================================
// src/components/saju/ZiweiChart.tsx
// =====================================================
// 자미두수 명반 시각화 — react-iztro Iztrolabe 래퍼 (방향 A).
//
// 동작 원리:
//   - 입력값(생년월일/시진/성별/양음력)을 받아 react-iztro 가 내부에서 iztro 재계산.
//   - DB 의 saju_results.astrolabe(요약본)는 본 컴포넌트와 무관 — LLM 프롬프트/감사용.
//   - iztro@2.5.3(react-iztro 내장) ↔ 2.5.8(우리 ziwei.ts) 명반 100% 일치 검증 완료.
//
// 번들 격리:
//   - react-iztro(188 KB) + iztro@2.5.3(약 2 MB)는 결과 페이지에서만 로드.
//   - next/dynamic + ssr:false 로 SSR/초기 JS 번들 제외.
//
// 미디어:
//   - useState/useEffect 사용 → 'use client' 필수.

"use client";

import dynamic from "next/dynamic";
import { hourToTimeIndex } from "@/lib/saju/time-index";

// next/dynamic — Iztrolabe 만 클라이언트에서 lazy import.
// react-iztro 의 default export 가 아니라 named export 이므로 .then 으로 추출.
const Iztrolabe = dynamic(
  () => import("react-iztro").then((m) => ({ default: m.Iztrolabe })),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg border border-night-border bg-night-secondary p-6 text-center text-sm text-night-fg-soft">
        명반을 그리는 중이에요…
      </div>
    ),
  },
);

export type ZiweiChartProps = {
  /** "YYYY-MM-DD" */
  birthDate: string;
  /** "HH:mm" 또는 null (null이면 시 미상) */
  birthTime: string | null;
  timeUnknown: boolean;
  calendar: "solar" | "lunar";
  gender: "male" | "female";
};

export function ZiweiChart({
  birthDate,
  birthTime,
  timeUnknown,
  calendar,
  gender,
}: ZiweiChartProps) {
  // 시 미상 가드 — 자미두수는 시진 없이 그릴 수 없음.
  if (timeUnknown || !birthTime) {
    return (
      <div className="rounded-lg border border-night-border bg-night-secondary p-6 text-center text-sm text-night-fg-soft">
        출생 시간을 모르면 자미두수 명반을 그릴 수 없어요.
      </div>
    );
  }

  // "HH:mm" → 시진 인덱스 0~11
  const [hhStr, mmStr] = birthTime.split(":");
  const hour = Number(hhStr);
  const minute = Number(mmStr);
  let timeIndex: number;
  try {
    timeIndex = hourToTimeIndex(hour, minute);
  } catch {
    // 비정상 birth_time 포맷 — 명반 그릴 수 없음, 안전하게 메시지로 폴백
    return (
      <div className="rounded-lg border border-night-border bg-night-secondary p-6 text-center text-sm text-night-fg-soft">
        출생 시간 형식이 올바르지 않아 명반을 그릴 수 없어요.
      </div>
    );
  }

  // ko-KR 로케일 성별 표기 — react-iztro 내부 i18n 매칭용
  const koGender = gender === "male" ? "남성" : "여자";

  return (
    <Iztrolabe
      birthday={birthDate}
      birthTime={timeIndex}
      birthdayType={calendar}
      gender={koGender}
      lang="ko-KR"
      fixLeap
    />
  );
}
