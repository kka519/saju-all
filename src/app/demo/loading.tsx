// /demo는 2-A 단계에서 SSR/CSR 분리되어 페이지 자체가 ~1초 안에 응답.
// 콜드 dev/serverless cold start 동안의 streaming shell만 남김 — 1줄 단순.

export default function DemoLoading() {
  return (
    <div className="container py-12 max-w-3xl text-night-fg">
      <p className="text-sm text-night-fg-soft">사주를 펼치는 중...</p>
    </div>
  );
}
