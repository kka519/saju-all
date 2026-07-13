import type { ScoredPeriod } from "../types";
import { NAVY, GOLD, BLUE, GRAY, CHART_FONT_FAMILY, scaleLinear, escapeSvgText } from "./tokens";

// =====================================================
// 월별 타이밍 바차트 (SVG)
// =====================================================
// charts_monthly.py 재구현. score>=70 GOLD(golden window), score<=45 BLUE(주의), 그 외 회색.

const W = 920;
const H = 280;
const PAD_L = 40;
const PAD_R = 20;
const PAD_T = 40;
const PAD_B = 50;
const SCORE_MIN = 35;
const SCORE_MAX = 76;
const GOLD_THRESHOLD = 70;
const CAUTION_THRESHOLD = 45;

export function renderWolunBarChart(periods: ScoredPeriod[]): string {
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const n = periods.length;
  const slot = plotW / n;
  const barW = slot * 0.62;

  const y = (score: number) => PAD_T + scaleLinear(score, [SCORE_MAX, SCORE_MIN], [0, plotH]);
  const neutralY = y(60);

  let bars = "";
  periods.forEach((p, i) => {
    const cx = PAD_L + slot * i + slot / 2;
    const color = p.score >= GOLD_THRESHOLD ? GOLD : p.score <= CAUTION_THRESHOLD ? BLUE : "#B8BCC9";
    const top = y(p.score);
    const barH = Math.max(y(SCORE_MIN) - top, 2);

    bars += `<rect x="${cx - barW / 2}" y="${top}" width="${barW}" height="${barH}" fill="${color}" rx="1.5" />`;
    bars += `<text x="${cx}" y="${top - 4}" font-size="8.5" fill="${NAVY}" text-anchor="middle" font-weight="bold" font-family="${CHART_FONT_FAMILY}">${p.score}</text>`;
    const labelLines = p.label.split("\n");
    bars += labelLines
      .map(
        (line, li) =>
          `<text x="${cx}" y="${H - PAD_B + 14 + li * 11}" font-size="8" fill="${GRAY}" text-anchor="middle" font-family="${CHART_FONT_FAMILY}">${escapeSvgText(line)}</text>`,
      )
      .join("");
  });

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <text x="${PAD_L}" y="16" font-size="12.5" fill="#1A1A2E" font-weight="bold" font-family="${CHART_FONT_FAMILY}">월별 타이밍 차트  (금색=골든 윈도우 · 파랑=주의 구간)</text>
  <line x1="${PAD_L}" y1="${neutralY}" x2="${W - PAD_R}" y2="${neutralY}" stroke="${GRAY}" stroke-width="1" stroke-dasharray="4 3" opacity="0.6" />
  ${bars}
</svg>`;
}
