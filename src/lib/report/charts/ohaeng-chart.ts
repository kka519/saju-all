import type { Oheng } from "@/lib/saju/derived";
import { NAVY, CHART_FONT_FAMILY, scaleLinear } from "./tokens";

// =====================================================
// 오행 포트폴리오 가로바 차트 (SVG)
// =====================================================
// charts_daeun_ohaeng_yearly.py 의 오행 포트폴리오 차트를 재구현.

const OHENG_COLOR: Record<Oheng, string> = {
  화: "#C0574F",
  토: "#A08A5C",
  수: "#4A7BA6",
  금: NAVY,
  목: "#5E8C61",
};
const OHENG_LABEL: Record<Oheng, string> = {
  목: "목(木) 일간·비겁",
  화: "화(火) 식상",
  토: "토(土) 재성",
  금: "금(金) 관성",
  수: "수(水) 인성",
};
// 표시 순서(위→아래): 화 토 수 금 목 (레퍼런스 차트 순서 유지)
const ORDER: Oheng[] = ["화", "토", "수", "금", "목"];

const W = 840;
const H = 280;
const PAD_L = 190;
const PAD_R = 70;
const PAD_T = 36;
const PAD_B = 20;

export function renderOhaengPortfolioChart(ohaengCount: Record<Oheng, number>): string {
  const total = ORDER.reduce((s, k) => s + (ohaengCount[k] ?? 0), 0) || 1;
  const plotW = W - PAD_L - PAD_R;
  const rowH = (H - PAD_T - PAD_B) / ORDER.length;

  const rows = ORDER.map((k, i) => {
    const count = ohaengCount[k] ?? 0;
    const pct = (count / total) * 100;
    const barW = scaleLinear(pct, [0, 100], [0, plotW]);
    const cy = PAD_T + rowH * i + rowH / 2;
    const barH = rowH * 0.62;

    return `
    <text x="${PAD_L - 8}" y="${cy + 4}" font-size="10.5" fill="${NAVY}" text-anchor="end" font-family="${CHART_FONT_FAMILY}">${OHENG_LABEL[k]}</text>
    <rect x="${PAD_L}" y="${cy - barH / 2}" width="${Math.max(barW, 2)}" height="${barH}" fill="${OHENG_COLOR[k]}" rx="2" />
    <text x="${PAD_L + barW + 8}" y="${cy + 4}" font-size="10" fill="${count === 0 ? "#C0574F" : "#333"}" font-weight="${count === 0 ? "bold" : "normal"}" font-family="${CHART_FONT_FAMILY}">${count === 0 ? `일간 단신 — ${k} 0개` : `${pct.toFixed(1)}%`}</text>`;
  }).join("");

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <text x="16" y="18" font-size="12.5" fill="${NAVY}" font-weight="bold" font-family="${CHART_FONT_FAMILY}">오행 포트폴리오 구성 (팔자 8자 기준)</text>${rows}
</svg>`;
}
