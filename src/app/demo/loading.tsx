// /demo SSR 응답이 luckyloveme API + LLM 호출 때문에 ~20초 걸림.
// Next.js streaming UI로 즉시 로딩 shell을 띄워서 "안 열림" 체감을 제거.

export default function DemoLoading() {
  return (
    <div className="container py-12 max-w-3xl text-night-fg">
      <header className="mb-8">
        <p className="text-xs font-mono text-night-fg-muted mb-2">DEMO</p>
        <h1 className="text-3xl font-semibold tracking-tight">명식 → 결과지 흐름 데모</h1>
        <p className="mt-2 text-sm text-night-fg-soft">
          DB 없이 명식 + LLM 해석이 어떻게 나오는지 확인하는 페이지입니다.
        </p>
      </header>

      <div className="rounded-lg border border-night-border bg-night-secondary p-8 text-center">
        <div className="inline-flex items-center gap-3">
          <span className="inline-block h-2 w-2 rounded-full bg-starlight animate-pulse" />
          <span className="inline-block h-2 w-2 rounded-full bg-starlight animate-pulse [animation-delay:200ms]" />
          <span className="inline-block h-2 w-2 rounded-full bg-starlight animate-pulse [animation-delay:400ms]" />
        </div>
        <p className="mt-5 text-sm text-night-fg-soft">
          두리가 만세력 + LLM을 부르고 있어요. 보통 20초 안에 와요.
        </p>
        <p className="mt-2 text-xs text-night-fg-muted">
          (luckyloveme 만세력 API + Gemini 해석 — 순차 호출)
        </p>
      </div>
    </div>
  );
}
