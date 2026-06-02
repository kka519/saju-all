// =====================================================
// src/app/results/[resultId]/layout.tsx
// =====================================================
// 5-B.2a — 결과지 경로 다크 wrapper.
// 전역 body 는 라이트(paper-white) 기본 유지. results 경로만 night 팔레트로 격리.
// 5-B.2b 에서 별빛 배경 / 유성을 이 wrapper 안에 추가 예정.

export default function ResultsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-night-primary text-night-fg">
      {children}
    </div>
  );
}
