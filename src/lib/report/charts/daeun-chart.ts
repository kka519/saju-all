import type { ScoredPeriod } from "../types";
import { NAVY, GOLD, RED, BLUE, GRAY, CHART_FONT_FAMILY, scaleLinear, escapeSvgText } from "./tokens";

// =====================================================
// 대운 10년 주기 캔들차트 (SVG)
// =====================================================
// charts_daeun_ohaeng_yearly.py 의 캔들차트를 서버사이드 SVG 로 재구현.
// 막대: [이전 점수, 현재 점수] 구간, 상승=RED, 하락=BLUE, 현재 대운=GOLD 배경 강조.
// 레퍼런스 PDF 대조 반영: 차트 타이틀 + y축 눈금/라벨 + x축 간지 병기 + 현재 구간 주석.

const W = 920;
const H = 400;
const PAD_L = 64;
const PAD_R = 20;
const PAD_T = 46;
const PAD_B = 64;
const SCORE_MIN = 25;
const SCORE_MAX = 90;

export function renderDaeunCandleChart(periods: ScoredPeriod[]): string {
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const n = periods.length;
  const slot = plotW / n;
  const barW = slot * 0.44;

  const y = (score: number) => PAD_T + scaleLinear(score, [SCORE_MAX, SCORE_MIN], [0, plotH]);
  const x = (i: number) => PAD_L + slot * i + slot / 2;

  const neutralY = y(60);

  // y축 눈금 (30~90, 10 간격)
  let axis = "";
  for (let v = 30; v <= 90; v += 10) {
    axis += `<text x="${PAD_L - 8}" y="${y(v) + 3}" font-size="9" fill="${GRAY}" text-anchor="end" font-family="${CHART_FONT_FAMILY}">${v}</text>`;
    axis += `<line x1="${PAD_L - 4}" y1="${y(v)}" x2="${PAD_L}" y2="${y(v)}" stroke="${GRAY}" stroke-width="0.8" />`;
  }
  axis += `<line x1="${PAD_L}" y1="${PAD_T}" x2="${PAD_L}" y2="${H - PAD_B}" stroke="${GRAY}" stroke-width="0.8" />`;
  axis += `<text x="18" y="${PAD_T + plotH / 2}" font-size="10" fill="#555" text-anchor="middle" font-family="${CHART_FONT_FAMILY}" transform="rotate(-90 18 ${PAD_T + plotH / 2})">운세지수 (pt)</text>`;

  let bars = "";
  let prev = 55; // 첫 막대 기준선 (스펙 레퍼런스와 동일하게 55에서 시작)
  periods.forEach((p, i) => {
    const cx = x(i);
    const isCurrent = p.isCurrent;
    const color = p.direction === "down" ? BLUE : RED;
    const yTop = y(Math.max(prev, p.score));
    const yBot = y(Math.min(prev, p.score));
    const barH = Math.max(yBot - yTop, 3);

    if (isCurrent) {
      bars += `<rect x="${cx - slot / 2}" y="${PAD_T}" width="${slot}" height="${plotH}" fill="${GOLD}" opacity="0.13" />`;
      if (p.direction !== "down") {
        bars += `<text x="${cx}" y="${PAD_T + 14}" font-size="10" fill="#9A7B2D" text-anchor="middle" font-weight="bold" font-family="${CHART_FONT_FAMILY}">상승 전환</text>`;
      } else {
        bars += `<text x="${cx}" y="${PAD_T + 14}" font-size="10" fill="#9A7B2D" text-anchor="middle" font-weight="bold" font-family="${CHART_FONT_FAMILY}">현재 진입</text>`;
      }
    }
    bars += `<rect x="${cx - barW / 2}" y="${yTop}" width="${barW}" height="${barH}" fill="${color}" rx="1.5" />`;
    bars += `<line x1="${cx}" y1="${y(Math.min(Math.max(prev, p.score) + 4, SCORE_MAX))}" x2="${cx}" y2="${y(Math.max(Math.min(prev, p.score) - 4, SCORE_MIN))}" stroke="${color}" stroke-width="1.2" />`;

    // x축 라벨: 나이 구간 + 간지 (+현재)
    const labelLines = [p.label, p.ganji + (p.isCurrent ? " (현재)" : "")];
    bars += labelLines
      .map(
        (line, li) =>
          `<text x="${cx}" y="${H - PAD_B + 16 + li * 13}" font-size="10" fill="${p.isCurrent && li === 1 ? "#9A7B2D" : NAVY}" text-anchor="middle" ${p.isCurrent ? 'font-weight="bold"' : ""} font-family="${CHART_FONT_FAMILY}">${escapeSvgText(line)}</text>`,
      )
      .join("");
    bars += `<text x="${cx}" y="${yTop - 6}" font-size="9" fill="${isCurrent ? "#9A7B2D" : NAVY}" text-anchor="middle" font-weight="bold" font-family="${CHART_FONT_FAMILY}">${p.score}</text>`;

    prev = p.score;
  });

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <text x="${PAD_L}" y="20" font-size="13" fill="${NAVY}" font-weight="bold" font-family="${CHART_FONT_FAMILY}">대운 10년 주기 사이클 차트 (전 생애)</text>
  ${axis}
  <line x1="${PAD_L}" y1="${neutralY}" x2="${W - PAD_R}" y2="${neutralY}" stroke="${GRAY}" stroke-width="1" stroke-dasharray="4 3" opacity="0.7" />
  <text x="${W - PAD_R}" y="${neutralY - 4}" font-size="9" fill="${GRAY}" text-anchor="end" font-family="${CHART_FONT_FAMILY}">중립선 60pt</text>
  ${bars}
</svg>`;
}
