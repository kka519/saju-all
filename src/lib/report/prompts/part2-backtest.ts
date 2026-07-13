// =====================================================
// PART II — 백테스트 (p.8~9)
// =====================================================

import { ANALYST_SYSTEM_PROMPT } from "./system";
import { formatReportDataContext } from "./format-data-context";
import { clampArray, stripBold } from "./clamp";
import type { ReportData } from "../normalize";

export type ReportPart2Sections = {
  backtest: string[]; // 지난 대운 3구간 연대기, 각 max 380자
  checklist: string[]; // 채점 문항 10개(구조6+시기4), 각 max 70자
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function parseReportPart2Sections(obj: unknown): ReportPart2Sections | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  if (!Array.isArray(o.backtest) || o.backtest.length < 2 || !o.backtest.every(isNonEmptyString)) return null;
  if (!Array.isArray(o.checklist) || o.checklist.length < 8 || !o.checklist.every(isNonEmptyString)) return null;
  return {
    backtest: clampArray(o.backtest as string[], 400),
    // checklist 는 템플릿에서 plain 렌더 — ** 마커가 리터럴 노출되므로 제거.
    checklist: clampArray(o.checklist as string[], 80).map(stripBold),
  };
}

const INSTRUCTION = `
[이번 호출 범위 — PART II 백테스트 (p.8~9)]

- backtest: [대운 전체 사이클] 중 이미 지나간 대운 중 최근 3개 구간을 골라, 그 시기 명식 데이터
  (십성/신살/12운성/지수)만 근거로 "이 시기엔 이런 경향이 있었을 것"이라는 구조 해석을 서술.
  개인 정보(실제로 무슨 일이 있었는지)는 모른다는 전제 — "~했을 가능성이 높다" 화법.
  각 항목 300~380자 (①②③ 번호로 경향 3~5개를 나열하는 밀도 있는 서술). 항목 수만큼
  배열로 (지나간 대운이 3개 미만이면 있는 만큼만).
- checklist: 체감 검증 채점표 10문항. 앞 6개는 "구조 검증"(명식 자체의 반복 패턴 — 위 backtest와
  성격 다르게, 원국 자체의 기질적 특징), 뒤 4개는 "시기 검증"(backtest에서 다룬 대운 구간별
  특징 재확인, "[26~35세] ~" 형식으로 나이 구간 표기). 각 문항 45~70자. 사용자가 "맞음/아님"으로
  체크할 수 있는 구체적 서술문이어야 한다 (질문형 X, 서술문 O).

[핵심 규칙]
- 모든 수치·간지는 데이터 블록에서 그대로 인용.
- 확정 사실처럼 말하지 말 것 — 구조 해석/경향 서술 유지.
- 분량 범위의 상단 80~100%를 채울 것.
`;

const SCHEMA_INSTRUCTION = `
[출력 형식]
{
  "backtest": ["...", "...", "..."],
  "checklist": ["...", ... 10개]
}
코드블록 마커 없이 순수 JSON 객체 하나만. JSON 외 텍스트 금지.
`;

export function buildReportPart2Prompt(data: ReportData): { system: string; user: string } {
  const context = formatReportDataContext(data);
  const user = `[확정 데이터]
${context}

${INSTRUCTION}
${SCHEMA_INSTRUCTION}`;
  return { system: ANALYST_SYSTEM_PROMPT, user };
}
