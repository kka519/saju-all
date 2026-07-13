import type { ScoredPeriod } from "../types";
import { NAVY, GOLD, RED, BLUE, GRAY, CHART_FONT_FAMILY, scaleLinear, escapeSvgText } from "./tokens";

// =====================================================
// 연간 세운 라인차트 (SVG)
// =====================================================
// charts_daeun_ohaeng_yearly.py 의 "연간 전망" 라인차트 재구현.
// 레퍼런스 대조 반영: 타이틀 + y축 + x축 간지 병기.

const W = 840;
const H = 300;
const PAD_L = 58;
const PAD_R = 20;
const PAD_T = 40;
const PAD_B = 56;
const SCORE_MIN = 30;
const SCORE_MAX = 80;

export function renderSeunLineChart(periods: ScoredPeriod[]): string {
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const n = Math.max(periods.length - 1, 1);

  const x = (i: number) => PAD_L + (plotW / n) * i;
  const y = (score: number) => PAD_T + scaleLinear(score, [SCORE_MAX, SCORE_MIN], [0, plotH]);
  const neutralY = y(60);

  let axis = "";
  for (let v = 30; v <= 80; v += 10) {
    axis += `<text x="${PAD_L - 8}" y="${y(v) + 3}" font-size="9" fill="${GRAY}" text-anchor="end" font-family="${CHART_FONT_FAMILY}">${v}</text>`;
  }
  axis += `<line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${H - PAD_B}" stroke="${GRAY}" stroke-width="0.8" />`;

  const points = periods.map((p, i) => `${x(i)},${y(p.score)}`).join(" ");

  const dots = periods
    .map((p, i) => {
      const cx = x(i);
      const cy = y(p.score);
      const dotColor = p.direction === "down" ? BLUE : p.direction === "up" ? RED : GRAY;
      const yearLabel = p.label.replace("년", "");
      return `
    <circle cx="${cx}" cy="${cy}" r="4.5" fill="${GOLD}" stroke="${dotColor}" stroke-width="1.8" />
    <text x="${cx}" y="${cy - 10}" font-size="10" fill="${NAVY}" text-anchor="middle" font-weight="bold" font-family="${CHART_FONT_FAMILY}">${p.score}</text>
    <text x="${cx}" y="${H - PAD_B + 16}" font-size="9.5" fill="${NAVY}" text-anchor="middle" font-family="${CHART_FONT_FAMILY}">${escapeSvgText(yearLabel)}</text>
    <text x="${cx}" y="${H - PAD_B + 29}" font-size="9" fill="${GRAY}" text-anchor="middle" font-family="${CHART_FONT_FAMILY}">${escapeSvgText(p.ganji)}</text>`;
    })
    .join("");

  const firstYear = periods[0]?.label.replace("년", "") ?? "";
  const lastYear = periods[periods.length - 1]?.label.replace("년", "") ?? "";

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <text x="${PAD_L}" y="18" font-size="12.5" fill="${NAVY}" font-weight="bold" font-family="${CHART_FONT_FAMILY}">연간 세운 전망 ${firstYear}E~${lastYear}E</text>
  ${axis}
  <line x1="${PAD_L}" y1="${neutralY}" x2="${W - PAD_R}" y2="${neutralY}" stroke="${GRAY}" stroke-width="1" stroke-dasharray="4 3" opacity="0.7" />
  <text x="${W - PAD_R}" y="${neutralY - 4}" font-size="9" fill="${GRAY}" text-anchor="end" font-family="${CHART_FONT_FAMILY}">중립선 60pt</text>
  <polyline points="${points}" fill="none" stroke="${NAVY}" stroke-width="2" />
  ${dots}
</svg>`;
}
