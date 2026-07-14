// =====================================================
// 신살·귀인 공시 분류 — "우호 공시" / "주의 공시" 매핑 테이블
// =====================================================
// docs/report-reference/IMPLEMENTATION_SPEC.md 원본 설계(28행: "신살 → 호재공시/
// 변동성공시 분류 매핑 테이블")를 코드로 복원. 신살 이름을 보고 좋다/나쁘다를
// 판단하는 것은 LLM마다 흔들릴 수 있는 영역이라 "계산은 코드가, 해석만 AI가"
// 원칙에 따라 분류는 결정론적 룰로 고정하고, LLM은 선정된 항목의 해설 문장만 쓴다.

import type { ReportData } from "./normalize";

export type ClassifiedItem = { item: string; position: string };

/** 전통적으로 호재성으로 다뤄지는 신살. 미분류 신살은 기본 caution(과대포장 리스크 방지). */
const FAVORABLE_SINSAL_NAMES = new Set([
  "천의성",
  "관귀학관",
  "문창귀인",
  "장성살",
  "반안살",
  "금여",
  "암록",
]);

export function classifyDisclosures(data: ReportData): {
  favorable: ClassifiedItem[];
  caution: ClassifiedItem[];
} {
  const favorable: ClassifiedItem[] = [];
  const caution: ClassifiedItem[] = [];

  for (const g of data.view.guiins ?? []) {
    favorable.push({ item: g.name, position: g.position });
  }

  for (const s of data.view.sinsals ?? []) {
    const bucket = FAVORABLE_SINSAL_NAMES.has(s.name) ? favorable : caution;
    bucket.push({ item: s.name, position: s.position });
  }

  for (const h of data.view.hapchung ?? []) {
    caution.push({
      item: `${h.source}${h.target} ${h.type}`,
      position: `${h.sourcePosition}-${h.targetPosition}`,
    });
  }

  if (data.gongmang.length) {
    caution.push({ item: "공망", position: data.gongmang.join("·") });
  }

  return { favorable, caution };
}
