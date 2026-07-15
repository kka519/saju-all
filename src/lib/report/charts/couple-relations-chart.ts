// =====================================================
// 커플 궁합 리포트 — 합충 관계도 (SVG)
// =====================================================
// 지시문_궁합PDF_비주얼3종_20260715.md §2 — 이 리포트의 대표 이미지.
// 본인 4기둥(상단, GOLD) vs 상대 4기둥(하단, PARTNER_BLUE)을 8개 한자 노드로
// 배치하고, computeCoupleRelationMatrix()가 코드로 계산한 관계만 선으로 잇는다.
// LLM은 이 관계 목록을 "[이 관계만 언급]" 블록으로 받아 해설만 한다 — 진실
// 원천은 100% 코드(관계 재계산·창작 금지).

import { NAVY, GOLD, RED, PARTNER_BLUE, GRAY, CHART_FONT_FAMILY, escapeSvgText } from "./tokens";
import type { CoupleRelationMatrix, PillarKey } from "../couple/relation-matrix";

const W = 840;
const H = 400;
const NODE_W = 84;
const NODE_H = 52;
const ROW_GAP = 180;
const TOP_Y = 70;
const BOTTOM_Y = TOP_Y + ROW_GAP;
const MARGIN_X = 90;
const PILLAR_LABEL: Record<PillarKey, string> = { year: "년주", month: "월주", day: "일주", hour: "시주" };
// 명식표(p3, 시-일-월-년 전통 배치)와 좌우 순서를 맞춘다 — 관계도만 다른 순서면 두 그림을
// 나란히 볼 때 어느 기둥끼리 연결됐는지 헷갈린다.
const DISPLAY_ORDER: readonly PillarKey[] = ["hour", "day", "month", "year"];

function nodeX(i: number): number {
  const usable = W - MARGIN_X * 2;
  return MARGIN_X + (usable / 3) * i;
}

// 관계 우선순위(선 스타일 결정) — 합이 가장 강한 신호, 그다음 충, 나머지는 보조선.
type LineStyle = { stroke: string; width: number; dash: string; opacity: number };
function styleFor(hasHap: boolean, hasChung: boolean): LineStyle {
  if (hasHap) return { stroke: GOLD, width: 2.4, dash: "0", opacity: 0.95 };
  if (hasChung) return { stroke: RED, width: 1.8, dash: "6 4", opacity: 0.9 };
  return { stroke: GRAY, width: 1, dash: "2 3", opacity: 0.55 };
}

function pillarNode(x: number, y: number, color: string, hanjaTop: string, hanjaBottom: string, label: string): string {
  return `
  <rect x="${x - NODE_W / 2}" y="${y - NODE_H / 2}" width="${NODE_W}" height="${NODE_H}" rx="6" fill="${NAVY}" stroke="${color}" stroke-width="1.6" />
  <text x="${x}" y="${y - 4}" font-size="17" fill="${color}" text-anchor="middle" font-weight="bold" font-family="${CHART_FONT_FAMILY}">${escapeSvgText(hanjaTop)}</text>
  <text x="${x}" y="${y + 16}" font-size="17" fill="${color}" text-anchor="middle" font-weight="bold" font-family="${CHART_FONT_FAMILY}">${escapeSvgText(hanjaBottom)}</text>
  <text x="${x}" y="${y + NODE_H / 2 + 16}" font-size="10" fill="${GRAY}" text-anchor="middle" font-family="${CHART_FONT_FAMILY}">${escapeSvgText(label)}</text>`;
}

export function renderCoupleRelationsChart(
  matrix: CoupleRelationMatrix,
  names: { self: string; partner: string },
): string {
  const selfPillars = matrix.selfView.pillars;
  const partnerPillars = matrix.partnerView.pillars;

  let nodes = "";
  const selfX: Record<PillarKey, number> = { year: 0, month: 0, day: 0, hour: 0 };
  const partnerX: Record<PillarKey, number> = { year: 0, month: 0, day: 0, hour: 0 };

  DISPLAY_ORDER.forEach((key, i) => {
    const x = nodeX(i);
    selfX[key] = x;
    const p = selfPillars[key];
    if (p) {
      nodes += pillarNode(x, TOP_Y, GOLD, p.cheonganHanja ?? p.cheongan, p.jijiHanja ?? p.jiji, PILLAR_LABEL[key]);
    } else {
      nodes += `<text x="${x}" y="${TOP_Y}" font-size="11" fill="${GRAY}" text-anchor="middle" font-family="${CHART_FONT_FAMILY}">시 미상</text>`;
    }
  });
  DISPLAY_ORDER.forEach((key, i) => {
    const x = nodeX(i);
    partnerX[key] = x;
    const p = partnerPillars[key];
    if (p) {
      nodes += pillarNode(x, BOTTOM_Y, PARTNER_BLUE, p.cheonganHanja ?? p.cheongan, p.jijiHanja ?? p.jiji, PILLAR_LABEL[key]);
    } else {
      nodes += `<text x="${x}" y="${BOTTOM_Y}" font-size="11" fill="${GRAY}" text-anchor="middle" font-family="${CHART_FONT_FAMILY}">시 미상</text>`;
    }
  });

  let lines = "";
  // 라벨(합·충만)은 먼저 전부 수집한 뒤 겹치지 않게 행을 배정 — 노드 사이 좁은 중앙대에
  // 여러 관계가 몰릴 때(예: 일주가 상대 3개 기둥과 동시에 얽힘) 텍스트가 겹치는 문제 방지.
  const pendingLabels: { midX: number; text: string; color: string; boxW: number }[] = [];

  for (const r of matrix.crossRelations) {
    const x1 = selfX[r.selfPillarKey];
    const x2 = partnerX[r.partnerPillarKey];
    if (x1 === undefined || x2 === undefined) continue;
    const hasHap = r.cheonganRelations.includes("합") || r.jijiRelations.includes("합") || r.jijiRelations.includes("삼합");
    const hasChung = r.cheonganRelations.includes("충") || r.jijiRelations.includes("충");
    const style = styleFor(hasHap, hasChung);

    const y1 = TOP_Y + NODE_H / 2;
    const y2 = BOTTOM_Y - NODE_H / 2;
    lines += `\n  <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${style.stroke}" stroke-width="${style.width}" stroke-dasharray="${style.dash}" opacity="${style.opacity}" />`;

    // 라벨 — 합·충만(강한 관계) 텍스트 표기, 파·형·해·삼합은 선만(가독성 우선).
    if (hasHap || hasChung) {
      const labels: string[] = [];
      const selfP = selfPillars[r.selfPillarKey];
      const partnerP = partnerPillars[r.partnerPillarKey];
      if (r.cheonganRelations.length > 0 && selfP && partnerP) {
        labels.push(`${selfP.cheonganHanja ?? selfP.cheongan}${partnerP.cheonganHanja ?? partnerP.cheongan}${r.cheonganRelations.join("·")}`);
      }
      if ((r.jijiRelations.includes("합") || r.jijiRelations.includes("충")) && selfP && partnerP) {
        const jr = r.jijiRelations.filter((t) => t === "합" || t === "충");
        labels.push(`${selfP.jijiHanja ?? selfP.jiji}${partnerP.jijiHanja ?? partnerP.jiji}${jr.join("·")}`);
      }
      const text = labels.join(" · ");
      // CJK 글리프는 라틴보다 넓어(약 1em) 문자 수 기준 폭 추정치를 넉넉히 잡는다.
      const boxW = text.length * 11 + 10;
      pendingLabels.push({ midX: (x1 + x2) / 2, text, color: style.stroke, boxW });
    }
  }

  // 좌→우 정렬 후 그리디 행 배정 — 같은 행에서 가로로 겹치면 다음 행으로.
  pendingLabels.sort((a, b) => a.midX - b.midX);
  const rowRightEdge: number[] = [];
  const ROW_H = 15;
  const ROW_START_Y = TOP_Y + NODE_H / 2 + 22;
  let labelsHtml = "";
  for (const lb of pendingLabels) {
    const left = lb.midX - lb.boxW / 2;
    const right = lb.midX + lb.boxW / 2;
    let row = rowRightEdge.findIndex((edge) => edge < left - 4);
    if (row === -1) {
      row = rowRightEdge.length;
      rowRightEdge.push(right);
    } else {
      rowRightEdge[row] = right;
    }
    const midY = ROW_START_Y + row * ROW_H;
    labelsHtml += `\n  <rect x="${left}" y="${midY - 10}" width="${lb.boxW}" height="14" rx="3" fill="${NAVY}" opacity="0.88" />`;
    labelsHtml += `\n  <text x="${lb.midX}" y="${midY}" font-size="9.5" fill="${lb.color}" text-anchor="middle" font-weight="bold" font-family="${CHART_FONT_FAMILY}">${escapeSvgText(lb.text)}</text>`;
  }
  lines += labelsHtml;

  const legend = `
  <g transform="translate(${MARGIN_X}, ${H - 34})">
    <line x1="0" y1="0" x2="26" y2="0" stroke="${GOLD}" stroke-width="2.4" />
    <text x="32" y="4" font-size="9.5" fill="${NAVY}" font-family="${CHART_FONT_FAMILY}">골드 실선 = 끌림·결합(합)</text>
    <line x1="230" y1="0" x2="256" y2="0" stroke="${RED}" stroke-width="1.8" stroke-dasharray="6 4" />
    <text x="262" y="4" font-size="9.5" fill="${NAVY}" font-family="${CHART_FONT_FAMILY}">붉은 점선 = 마찰 지점(충)</text>
    <line x1="470" y1="0" x2="496" y2="0" stroke="${GRAY}" stroke-width="1" stroke-dasharray="2 3" opacity="0.7" />
    <text x="502" y="4" font-size="9.5" fill="${NAVY}" font-family="${CHART_FONT_FAMILY}">회색 점선 = 파·형·해·삼합(보조)</text>
  </g>`;

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <text x="${MARGIN_X}" y="24" font-size="13" fill="${NAVY}" font-weight="bold" font-family="${CHART_FONT_FAMILY}">합충 관계도 — ${escapeSvgText(names.self)} × ${escapeSvgText(names.partner)}</text>
  <text x="${MARGIN_X}" y="${TOP_Y - NODE_H / 2 - 10}" font-size="10" fill="${GOLD}" font-weight="bold" font-family="${CHART_FONT_FAMILY}">${escapeSvgText(names.self)}</text>
  <text x="${MARGIN_X}" y="${BOTTOM_Y + NODE_H / 2 + 34}" font-size="10" fill="${PARTNER_BLUE}" font-weight="bold" font-family="${CHART_FONT_FAMILY}">${escapeSvgText(names.partner)}</text>
  ${lines}
  ${nodes}
  ${legend}
</svg>`;
}
