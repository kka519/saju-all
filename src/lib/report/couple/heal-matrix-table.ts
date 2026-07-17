// =====================================================
// 커플 궁합 리포트 — 병-치유 매트릭스 HTML 표 (p8)
// =====================================================
// section9.ts의 CoupleHealMatrix(코드 계산)를 report.hbs 스타일 표로 렌더.
// LLM 개입 없음 — 판정·해소 여부 모두 코드 값 그대로.

import type { CoupleHealMatrix, HealVerdict } from "./section9";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function row(who: string, v: HealVerdict): string {
  const resolved = v.resolvedByPillar !== null;
  const verdict = resolved
    ? `<span class="resolved">해소됨 — ${escapeHtml(v.resolvedByPillar!)}가 합으로 상쇄</span>`
    : `<span class="unresolved">미해소 — 스스로 관리 필요</span>`;
  return `<tr><td class="l">${escapeHtml(who)}</td><td class="l">${escapeHtml(v.item.pillarLabel)}(${escapeHtml(v.item.char)}, ${escapeHtml(v.item.role)})</td><td class="l">${verdict}</td></tr>`;
}

export function renderHealMatrixTable(matrix: CoupleHealMatrix, names: { self: string; partner: string }): string {
  const rows = [
    ...matrix.selfIllness.map((v) => row(names.self, v)),
    ...matrix.partnerIllness.map((v) => row(names.partner, v)),
  ];
  if (rows.length === 0) {
    return `<table class="healgrid"><tr><th>대상</th><th>자리</th><th>판정</th></tr><tr><td class="l" colspan="3">두 사람 모두 원국 4기둥에 기신·구신 글자가 뚜렷이 드러나지 않아, 이 매트릭스는 해당 사항이 없습니다.</td></tr></table>`;
  }
  return `<table class="healgrid"><tr><th style="width:16%">대상</th><th style="width:28%">병(病) 자리</th><th>해소 여부</th></tr>${rows.join("")}</table>`;
}

/** p8 하단 콜아웃 캡션 — N곳 중 M곳 해소를 코드가 직접 문장으로 요약(LLM 개입 없음). */
export function formatHealMatrixCaption(matrix: CoupleHealMatrix, names: { self: string; partner: string }): string {
  const selfTotal = matrix.selfIllness.length;
  const selfResolved = matrix.selfIllness.filter((v) => v.resolvedByPillar !== null).length;
  const partnerTotal = matrix.partnerIllness.length;
  const partnerResolved = matrix.partnerIllness.filter((v) => v.resolvedByPillar !== null).length;
  if (selfTotal === 0 && partnerTotal === 0) {
    return "두 사람 모두 명확한 병 글자가 없어 이 장치로는 우열을 가리기 어렵습니다 — 다른 장에서 다룬 교차 구조를 참고하십시오.";
  }
  return `${names.self}의 병 ${selfTotal}곳 중 ${selfResolved}곳, ${names.partner}의 병 ${partnerTotal}곳 중 ${partnerResolved}곳이 상대방을 통해 해소됩니다. 해소되지 않은 자리는 각자 스스로 관리해야 할 고유의 취약 지대로 남습니다.`;
}
