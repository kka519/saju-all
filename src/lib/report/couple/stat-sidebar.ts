// =====================================================
// 커플 궁합 리포트 — 페이지 사이드바 스탯카드 (골격 재설계)
// =====================================================
// "본문 + 사이드바" 골격의 사이드바를 렌더. 값은 전부 이미 컨텍스트에 계산되어
// 있는 값(관계 유형·유형명·세운 하이라이트 등)을 재구성한 것뿐 — 새 계산 없음.

export type StatItem = { label: string; value: string; who?: "self" | "partner" };

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function renderStatSidebar(items: StatItem[]): string {
  return `<div class="sidebar-col">${items
    .map(
      (it) =>
        `<div class="statcard${it.who === "partner" ? " partner" : ""}"><div class="label">${escapeHtml(it.label)}</div><div class="value">${escapeHtml(it.value)}</div></div>`,
    )
    .join("")}</div>`;
}
