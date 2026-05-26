// /onboarding/* 공통 — 대화형 화면 (한 화면 한 질문).
// 진행률 표시 없음 + 두리 중앙 + 모바일 우선.

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container max-w-md py-10 min-h-[calc(100vh-7rem)] flex flex-col items-center justify-center text-night-fg text-center">
      {children}
    </div>
  );
}
