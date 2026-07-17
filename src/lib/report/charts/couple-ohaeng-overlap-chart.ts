// =====================================================
// 커플 궁합 리포트 — 오행 교집합 다이어그램 SVG (p8 시너지 상세)
// =====================================================
// 각자 ohaengCount(코드 계산, formatOhaengDistribution과 동일 원본)를 5원소
// 막대로 나란히 비교하고, 두 사람 모두 2개 이상 가진 원소를 "교집합"으로
// 표시한다. 시너지 페이지가 LLM 프로즈(500~700자) 하나만으로 절반을 못 채우는
// 문제(2026-07-17 실측 44%)를 보강하는 경량 비주얼 — 판정 기준(2개 이상=우세)은
// 마케팅 목적상 근사치, 새 사실을 만들어내지 않고 이미 계산된 글자 수만 재구성.

import { GOLD, PARTNER_BLUE, NAVY, CHART_FONT_FAMILY, escapeSvgText } from "./tokens";
import type { MyeongsikViewModel } from "@/lib/saju/build-myeongsik-view";
import type { Oheng } from "@/lib/saju/derived";

const OHAENG_ORDER: Oheng[] = ["목", "화", "토", "금", "수"];
const OVERLAP_THRESHOLD = 2;

export function computeOhaengOverlap(selfView: MyeongsikViewModel, partnerView: MyeongsikViewModel): Oheng[] {
  const s = selfView.ohaengCount as Record<Oheng, number>;
  const p = partnerView.ohaengCount as Record<Oheng, number>;
  return OHAENG_ORDER.filter((o) => (s[o] ?? 0) >= OVERLAP_THRESHOLD && (p[o] ?? 0) >= OVERLAP_THRESHOLD);
}

export function renderOhaengOverlapChart(
  selfView: MyeongsikViewModel,
  partnerView: MyeongsikViewModel,
  names: { self: string; partner: string },
): string {
  const s = selfView.ohaengCount as Record<Oheng, number>;
  const p = partnerView.ohaengCount as Record<Oheng, number>;
  const maxCount = Math.max(1, ...OHAENG_ORDER.map((o) => Math.max(s[o] ?? 0, p[o] ?? 0)));
  const overlap = computeOhaengOverlap(selfView, partnerView);

  const barMaxH = 70;
  const colW = 100;
  const w = colW * 5 + 40;
  const h = 150;
  const baseY = 110;

  const cols = OHAENG_ORDER.map((o, i) => {
    const cx = 40 + colW * i + colW / 2;
    const sH = ((s[o] ?? 0) / maxCount) * barMaxH;
    const pH = ((p[o] ?? 0) / maxCount) * barMaxH;
    const isOverlap = overlap.includes(o);
    return `
  <rect x="${cx - 24}" y="${baseY - sH}" width="18" height="${sH}" fill="${GOLD}" rx="1.5" />
  <rect x="${cx + 6}" y="${baseY - pH}" width="18" height="${pH}" fill="${PARTNER_BLUE}" rx="1.5" />
  <text x="${cx}" y="${baseY + 18}" text-anchor="middle" font-size="12" font-weight="bold" fill="${NAVY}">${o}</text>
  ${isOverlap ? `<rect x="${cx - 30}" y="${baseY - Math.max(sH, pH) - 14}" width="60" height="12" rx="6" fill="#FBF6E9" stroke="${GOLD}" stroke-width="0.75" /><text x="${cx}" y="${baseY - Math.max(sH, pH) - 5}" text-anchor="middle" font-size="7.5" fill="#9A7B2D" font-weight="bold">교집합</text>` : ""}`;
  }).join("");

  const legend = `
  <rect x="${w - 170}" y="8" width="10" height="10" fill="${GOLD}" /><text x="${w - 156}" y="17" font-size="9" fill="${NAVY}">${escapeSvgText(names.self)}</text>
  <rect x="${w - 90}" y="8" width="10" height="10" fill="${PARTNER_BLUE}" /><text x="${w - 76}" y="17" font-size="9" fill="${NAVY}">${escapeSvgText(names.partner)}</text>`;

  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" font-family="${CHART_FONT_FAMILY}">
  <line x1="30" y1="${baseY}" x2="${w - 10}" y2="${baseY}" stroke="#ddd" stroke-width="1" />
  ${legend}
  ${cols}
</svg>`;
}

export function formatOhaengOverlapNote(overlap: Oheng[], names: { self: string; partner: string }): string {
  if (overlap.length === 0) {
    return `두 사람이 공통으로 2개 이상 가진 오행은 없다 — 겹치기보다 서로 없는 기운을 채워주는 보완 구조에 가깝다.`;
  }
  return `${names.self}과 ${names.partner} 모두 ${overlap.join("·")} 기운을 2개 이상 갖고 있다 — 이 지점에서는 취향·생활 리듬이 자연스럽게 겹친다.`;
}
