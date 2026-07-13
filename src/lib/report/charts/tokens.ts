// =====================================================
// 인생 애널리스트 리포트 — 차트 색상 토큰
// =====================================================
// 레퍼런스 matplotlib 스크립트(charts_daeun_ohaeng_yearly.py, charts_monthly.py)의
// 색상 정의를 그대로 이식. report-template.html의 CSS 변수와도 동일하게 맞춤.

export const NAVY = "#1A1A2E";
export const GOLD = "#C9A84C";
export const RED = "#D64541"; // 상승
export const BLUE = "#2E6DB4"; // 하락/주의
export const GRAY = "#8A8FA0";

/** report-template.html의 @font-face 이름과 동일하게 맞춤 (SVG 텍스트가 PDF에서 동일 폰트로 렌더되도록). */
export const CHART_FONT_FAMILY = "NotoKR, sans-serif";

/** 선형 스케일: value(dataMin~dataMax) → pixel(rangeMin~rangeMax). */
export function scaleLinear(
  value: number,
  domain: [number, number],
  range: [number, number],
): number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  if (d1 === d0) return r0;
  const t = (value - d0) / (d1 - d0);
  return r0 + t * (r1 - r0);
}

/** SVG 텍스트 특수문자 이스케이프 (한글/한자는 안전, &<> 정도만 방어). */
export function escapeSvgText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
