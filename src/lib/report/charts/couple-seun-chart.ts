// =====================================================
// 커플 궁합 리포트 — 2인 세운 교차 곡선 (SVG)
// =====================================================
// 지시문_궁합PDF_비주얼3종_20260715.md §3 — 골드=본인, PARTNER_BLUE=상대 오버레이.
// 수치는 100% computeCoupleSeunSeries()가 계산한 값을 그대로 사용(LLM 생성 금지).

import { NAVY, GOLD, PARTNER_BLUE, GRAY, CHART_FONT_FAMILY, scaleLinear, escapeSvgText } from "./tokens";
import type { CoupleSeunSeries } from "../couple/couple-seun-data";

const W = 840;
const H = 320;
const PAD_L = 50;
const PAD_R = 24;
const PAD_T = 40;
const PAD_B = 56;

export function renderCoupleSeunChart(
  series: CoupleSeunSeries,
  names: { self: string; partner: string },
): string {
  if (series.years.length === 0) {
    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <text x="${W / 2}" y="${H / 2}" font-size="12" fill="${GRAY}" text-anchor="middle" font-family="${CHART_FONT_FAMILY}">세운 데이터 없음</text>
</svg>`;
  }

  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const n = series.years.length;
  const allScores = [...series.self.map((p) => p.score), ...series.partner.map((p) => p.score)];
  const scoreMin = Math.min(-20, Math.floor(Math.min(...allScores) / 10) * 10);
  const scoreMax = Math.max(20, Math.ceil(Math.max(...allScores) / 10) * 10);

  const x = (i: number) => PAD_L + (n > 1 ? (plotW / (n - 1)) * i : plotW / 2);
  const y = (score: number) => PAD_T + scaleLinear(score, [scoreMax, scoreMin], [0, plotH]);
  const zeroY = y(0);

  let axis = "";
  const step = (scoreMax - scoreMin) / 4;
  for (let v = scoreMin; v <= scoreMax + 0.01; v += step) {
    const rv = Math.round(v);
    axis += `<text x="${PAD_L - 8}" y="${y(rv) + 3}" font-size="9" fill="${GRAY}" text-anchor="end" font-family="${CHART_FONT_FAMILY}">${rv}</text>`;
  }
  axis += `<line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${H - PAD_B}" stroke="${GRAY}" stroke-width="0.8" />`;

  // 동반 상승/최소 온도차 하이라이트 밴드.
  let highlightBand = "";
  const hIdx = series.highlightYear !== null ? series.years.indexOf(series.highlightYear) : -1;
  if (hIdx >= 0) {
    const bx = x(hIdx);
    const bandW = n > 1 ? plotW / (n - 1) : 60;
    highlightBand = `
  <rect x="${bx - bandW / 2}" y="${PAD_T}" width="${bandW}" height="${plotH}" fill="${GOLD}" opacity="0.12" />
  <text x="${bx}" y="${PAD_T - 6}" font-size="9" fill="${GOLD}" text-anchor="middle" font-weight="bold" font-family="${CHART_FONT_FAMILY}">${escapeSvgText(series.highlightReason ?? "")} ★</text>`;
  }

  const buildSeries = (points: CoupleSeunSeries["self"], color: string, label: string) => {
    const linePoints = points.map((p, i) => `${x(i)},${y(p.score)}`).join(" ");
    const dots = points
      .map((p, i) => {
        const cx = x(i);
        const cy = y(p.score);
        const isHighlight = series.highlightYear === p.year;
        return `
    <circle cx="${cx}" cy="${cy}" r="${isHighlight ? 6 : 4}" fill="${color}" stroke="${NAVY}" stroke-width="1.2" ${
      isHighlight ? `opacity="1"` : `opacity="0.9"`
    } />
    <text x="${cx}" y="${cy - 10}" font-size="9.5" fill="${color}" text-anchor="middle" font-weight="bold" font-family="${CHART_FONT_FAMILY}">${p.score >= 0 ? "+" : ""}${p.score}</text>`;
      })
      .join("");
    return { linePoints, dots, color, label };
  };

  const selfSeries = buildSeries(series.self, GOLD, names.self);
  const partnerSeries = buildSeries(series.partner, PARTNER_BLUE, names.partner);

  const xLabels = series.years
    .map((yr, i) => {
      const cx = x(i);
      const ganji = series.self[i]?.ganji ?? "";
      return `
    <text x="${cx}" y="${H - PAD_B + 16}" font-size="9.5" fill="${NAVY}" text-anchor="middle" font-family="${CHART_FONT_FAMILY}">${yr}</text>
    <text x="${cx}" y="${H - PAD_B + 29}" font-size="9" fill="${GRAY}" text-anchor="middle" font-family="${CHART_FONT_FAMILY}">${escapeSvgText(ganji)}</text>`;
    })
    .join("");

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <text x="${PAD_L}" y="18" font-size="12.5" fill="${NAVY}" font-weight="bold" font-family="${CHART_FONT_FAMILY}">2인 세운 교차 — ${escapeSvgText(names.self)}(골드) × ${escapeSvgText(names.partner)}(블루)</text>
  ${highlightBand}
  ${axis}
  <line x1="${PAD_L}" y1="${zeroY}" x2="${W - PAD_R}" y2="${zeroY}" stroke="${GRAY}" stroke-width="1" stroke-dasharray="4 3" opacity="0.7" />
  <text x="${W - PAD_R}" y="${zeroY - 4}" font-size="9" fill="${GRAY}" text-anchor="end" font-family="${CHART_FONT_FAMILY}">중립선 0</text>
  <polyline points="${selfSeries.linePoints}" fill="none" stroke="${GOLD}" stroke-width="2.2" />
  <polyline points="${partnerSeries.linePoints}" fill="none" stroke="${PARTNER_BLUE}" stroke-width="2.2" stroke-dasharray="5 3" />
  ${selfSeries.dots}
  ${partnerSeries.dots}
  ${xLabels}
  <g transform="translate(${PAD_L}, ${18})">
    <line x1="440" y1="-4" x2="466" y2="-4" stroke="${GOLD}" stroke-width="2.2" />
    <text x="472" y="0" font-size="9.5" fill="${NAVY}" font-family="${CHART_FONT_FAMILY}">${escapeSvgText(names.self)}</text>
    <line x1="560" y1="-4" x2="586" y2="-4" stroke="${PARTNER_BLUE}" stroke-width="2.2" stroke-dasharray="5 3" />
    <text x="592" y="0" font-size="9.5" fill="${NAVY}" font-family="${CHART_FONT_FAMILY}">${escapeSvgText(names.partner)}</text>
  </g>
</svg>`;
}
