// =====================================================
// 커플 궁합 리포트 — 화해 시계 Do/Don&#39;t 카드 (p12~13)
// =====================================================
// type-names.ts의 회복 시계(CLOCK_TYPES) 판정만 사용 — 이 카드는 LLM 개입 없이
// 코드가 유형별 고정 Do/Don't 목록을 뽑아 렌더한다("계산은 코드가" 원칙, 유형별
// 정의는 이미 type-names.ts CLOCK_DEF·prompts.ts 중성 행동 뱅크에 있는 값의 재구성).
// P12/P13(riskManagementSelf/Partner)이 400~550자 LLM 필드 하나만으로는 페이지의
// 절반도 못 채우는 문제(2026-07-17 실측 채움률 23~28%)를 보강한다.

import type { ClockType } from "./type-names";

const CARD_BY_CLOCK: Record<ClockType, { do: string[]; dont: string[] }> = {
  "반나절 시계": {
    do: [
      "감정이 가라앉으면 그 자리에서 바로 짧게 결론 짓기",
      "다툰 지 6시간 안에 먼저 인사 건네기",
      "평소 루틴을 곧장 복구해 정상으로 돌아왔다는 신호 주기",
    ],
    dont: [
      "결론 없이 어색한 침묵을 하루 이상 끌기",
      "이미 정리된 감정을 다시 꺼내 재점화하기",
    ],
  },
  "하루반 시계": {
    do: [
      "다툰 지 24~36시간은 설득보다 평소 루틴 먼저 복구하기",
      "그 시간 동안 짧은 메시지 먼저 보내 여지를 열어두기",
      "산책 제안 등 말 없이도 통하는 행동으로 다가가기",
    ],
    dont: [
      "정리할 시간을 주지 않고 바로 대화로 결론 내려 하기",
      "왜 아직 안 풀렸냐고 다그치기",
    ],
  },
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** who: "self" | "partner" — 뱃지 색상 클래스에 맞춤. */
export function renderReconciliationCard(clock: ClockType, name: string, who: "self" | "partner"): string {
  const card = CARD_BY_CLOCK[clock];
  const rows = Math.max(card.do.length, card.dont.length);
  let body = "";
  for (let i = 0; i < rows; i++) {
    const d = card.do[i] ? `<span class="tag t-ok">DO</span> ${escapeHtml(card.do[i])}` : "";
    const x = card.dont[i] ? `<span class="tag t-warn">DON'T</span> ${escapeHtml(card.dont[i])}` : "";
    body += `<tr><td class="l">${d}</td><td class="l">${x}</td></tr>`;
  }
  return `<div class="sec">${escapeHtml(name)}의 화해 시계 사용법 — 코드 계산(${escapeHtml(clock)})</div>
<table class="healgrid"><tr><th style="width:50%">이렇게 하기</th><th>이건 피하기</th></tr>${body}</table>`;
}
