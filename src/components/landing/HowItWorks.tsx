// Ollama: stays on the same paper-white canvas, no surface alternation.
// Steps are numbered minimal markers in monospace.
export function HowItWorks() {
  const steps = [
    { n: "01", t: "상품 선택", d: "오늘의 운세부터 프리미엄 종합 풀이까지" },
    { n: "02", t: "사주 입력", d: "생년월일 · 출생 시각 · 성별 · 고민" },
    { n: "03", t: "결제", d: "토스페이먼츠로 안전하게 결제" },
    { n: "04", t: "결과 확인", d: "AI가 작성한 맞춤 리포트 즉시 확인" },
  ];
  return (
    <section id="how-it-works" className="container py-20 border-t border-night-border">
      <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-center mb-12 text-night-fg">
        작동 방식
      </h2>
      <ol className="grid gap-10 md:grid-cols-4">
        {steps.map((s) => (
          <li key={s.n}>
            <p className="text-xs font-mono text-night-fg-muted mb-2">{s.n}</p>
            <p className="text-base font-semibold mb-1.5 text-night-fg">{s.t}</p>
            <p className="text-sm text-night-fg-soft leading-relaxed">{s.d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
