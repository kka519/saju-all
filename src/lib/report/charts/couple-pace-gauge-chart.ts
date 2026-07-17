// =====================================================
// 커플 궁합 리포트 — 예열-지속 온도 게이지 SVG (p14 케미스트리)
// =====================================================
// type-names.ts의 예열-지속(PACE_TYPES) 판정만 사용 — 3구간(다이얼형-파도형-
// 스위치형) 위에 본인/상대 마커를 코드가 계산해 배치한다. 케미스트리 페이지가
// LLM 프로즈만으로 절반을 못 채우는 문제(2026-07-17 실측)를 보강하는 경량 비주얼.

import { GOLD, PARTNER_BLUE, NAVY, GRAY, CHART_FONT_FAMILY, escapeSvgText } from "./tokens";
import type { PaceType } from "../couple/type-names";

const ZONE_X: Record<PaceType, number> = { 다이얼형: 60, 파도형: 300, 스위치형: 540 };

export function renderPaceGaugeSvg(
  selfPace: PaceType,
  partnerPace: PaceType,
  names: { self: string; partner: string },
): string {
  const w = 600;
  const h = 130;
  const trackY = 70;
  const selfX = ZONE_X[selfPace];
  const partnerX = ZONE_X[partnerPace];
  const sameZone = selfPace === partnerPace;
  const selfCy = sameZone ? trackY - 12 : trackY;
  const partnerCy = sameZone ? trackY + 12 : trackY;

  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" font-family="${CHART_FONT_FAMILY}">
  <defs>
    <linearGradient id="paceTrack" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${PARTNER_BLUE}" />
      <stop offset="50%" stop-color="${GRAY}" />
      <stop offset="100%" stop-color="${GOLD}" />
    </linearGradient>
  </defs>
  <rect x="30" y="${trackY - 4}" width="${w - 60}" height="8" rx="4" fill="url(#paceTrack)" opacity="0.35" />
  <text x="60" y="${trackY + 32}" text-anchor="middle" font-size="11" fill="${NAVY}" font-weight="bold">다이얼형</text>
  <text x="60" y="${trackY + 46}" text-anchor="middle" font-size="8.5" fill="${GRAY}">천천히 올라가고 오래 간다</text>
  <text x="300" y="${trackY + 32}" text-anchor="middle" font-size="11" fill="${NAVY}" font-weight="bold">파도형</text>
  <text x="300" y="${trackY + 46}" text-anchor="middle" font-size="8.5" fill="${GRAY}">컨디션 따라 오르내린다</text>
  <text x="540" y="${trackY + 32}" text-anchor="middle" font-size="11" fill="${NAVY}" font-weight="bold">스위치형</text>
  <text x="540" y="${trackY + 46}" text-anchor="middle" font-size="8.5" fill="${GRAY}">점화도 냉각도 빠르다</text>

  <circle cx="${selfX}" cy="${selfCy}" r="12" fill="#FBF6E9" stroke="${GOLD}" stroke-width="2" />
  <text x="${selfX}" y="${selfCy + 4}" text-anchor="middle" font-size="9" fill="#9A7B2D" font-weight="bold">본</text>
  <text x="${selfX}" y="${selfCy - 20}" text-anchor="middle" font-size="9.5" fill="#9A7B2D" font-weight="bold">${escapeSvgText(names.self)}</text>

  <circle cx="${partnerX}" cy="${partnerCy}" r="12" fill="#EEF0FA" stroke="${PARTNER_BLUE}" stroke-width="2" />
  <text x="${partnerX}" y="${partnerCy + 4}" text-anchor="middle" font-size="9" fill="#5A63A0" font-weight="bold">상</text>
  <text x="${partnerX}" y="${partnerCy - 20}" text-anchor="middle" font-size="9.5" fill="#5A63A0" font-weight="bold">${escapeSvgText(names.partner)}</text>
</svg>`;
}
