// =====================================================
// 커플 궁합 리포트 — 끌림의 숨은 장치 HTML 표 (p7)
// =====================================================
// section9.ts의 AttractionDevices(코드 계산)를 report.hbs 스타일 표로 렌더.
// 천을귀인 교차 + 공망 교차 — 둘 다 원어 대신 번역어로 표기(term-guard 원칙과
// 일관되게, 이 표는 LLM 산출물이 아니지만 톤을 맞춘다).

import type { AttractionDevices } from "./section9";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderAttractionDevicesTable(devices: AttractionDevices, names: { self: string; partner: string }): string {
  const rows: string[] = [];
  if (devices.selfGuiinInPartner.length > 0) {
    const pos = devices.selfGuiinInPartner.map((g) => g.foundInPillar).join("·");
    rows.push(`<tr><td class="l">귀한 도움을 부르는 기운 교차</td><td class="l">${escapeHtml(names.partner)}의 ${escapeHtml(pos)}에 ${escapeHtml(names.self)}의 해당 지지가 있음 — 설명이 잘 안 되는 끌림의 근거</td></tr>`);
  }
  if (devices.partnerGuiinInSelf.length > 0) {
    const pos = devices.partnerGuiinInSelf.map((g) => g.foundInPillar).join("·");
    rows.push(`<tr><td class="l">귀한 도움을 부르는 기운 교차</td><td class="l">${escapeHtml(names.self)}의 ${escapeHtml(pos)}에 ${escapeHtml(names.partner)}의 해당 지지가 있음 — 동일하게 작용</td></tr>`);
  }
  if (devices.sharedGongmang.length > 0) {
    rows.push(`<tr><td class="l">기운이 비어 있는 자리 교차</td><td class="l">두 사람의 해당 지지가 같음(${escapeHtml(devices.sharedGongmang.join("·"))}) — 묘한 동질감의 근거</td></tr>`);
  }
  if (rows.length === 0) {
    return `<table class="healgrid"><tr><th style="width:30%">장치</th><th>내용</th></tr><tr><td class="l" colspan="2">코드로 계산되는 숨은 장치(귀인·공망 교차)가 이번 조합에서는 발견되지 않았습니다 — 끌림의 근거는 본문의 천간합·오행 보완 구조가 중심입니다.</td></tr></table>`;
  }
  return `<table class="healgrid"><tr><th style="width:30%">장치</th><th>내용</th></tr>${rows.join("")}</table>`;
}
