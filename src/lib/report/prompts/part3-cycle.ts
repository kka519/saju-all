// =====================================================
// PART III — 사이클 전망 (p.10~14)
// =====================================================
// 레퍼런스 PDF 대조 후 확장: daeunComments(대운 표 코멘트 컬럼), quarterIntro(분기
// 페이지 도입 문단), goldenWindowNote(골든 윈도우 콜아웃 본문).

import { ANALYST_SYSTEM_PROMPT } from "./system";
import { formatReportDataContext } from "./format-data-context";
import { clampChars, clampArray } from "./clamp";
import { checkTermRules, checkMinLengths, type FieldRanges } from "./term-guard";
import type { ReportData } from "../normalize";

export type SeunRow = { year: number; strategy: string };

export type ReportPart3Sections = {
  daeunNarrative: string; // p.10 차트 해설, 240~320자
  daeunComments: string[]; // p.10 대운 표 코멘트 — 대운 개수만큼, 각 20~45자
  daeunDeep: string; // p.11 현재 대운 심층, 700~950자
  daeunCaveats: string[]; // 유의 조항 2개, 각 160~240자
  seunRows: SeunRow[]; // p.12 연도별 운용전략, strategy 각 60~95자
  fiveYearSummary: string; // p.12 callout, 160~240자
  quarterIntro: string; // p.13 도입 문단, 180~260자
  quarterRows: string[]; // p.13 분기별 가이드 4개, 각 90~140자
  goldenWindowNote: string; // p.13 골든 윈도우 콜아웃, 140~220자
  donts: string[]; // p.13 금지 3항, 각 60~95자, **볼드 리드** 시작
  monthRows: string[]; // p.14 월별 한줄 운용 12개, 각 28~48자
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function parseReportPart3Sections(obj: unknown): ReportPart3Sections | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  if (!isNonEmptyString(o.daeunNarrative)) return null;
  if (!Array.isArray(o.daeunComments) || o.daeunComments.length < 3 || !o.daeunComments.every(isNonEmptyString)) return null;
  if (!isNonEmptyString(o.daeunDeep)) return null;
  if (!Array.isArray(o.daeunCaveats) || o.daeunCaveats.length < 1 || !o.daeunCaveats.every(isNonEmptyString)) return null;
  if (!Array.isArray(o.seunRows) || o.seunRows.length < 3) return null;
  for (const row of o.seunRows) {
    const r = row as Record<string, unknown>;
    if (typeof r.year !== "number" || !isNonEmptyString(r.strategy)) return null;
  }
  if (!isNonEmptyString(o.fiveYearSummary)) return null;
  if (!isNonEmptyString(o.quarterIntro)) return null;
  if (!Array.isArray(o.quarterRows) || o.quarterRows.length < 2 || !o.quarterRows.every(isNonEmptyString)) return null;
  if (!isNonEmptyString(o.goldenWindowNote)) return null;
  if (!Array.isArray(o.donts) || o.donts.length < 2 || !o.donts.every(isNonEmptyString)) return null;
  if (!Array.isArray(o.monthRows) || o.monthRows.length < 8 || !o.monthRows.every(isNonEmptyString)) return null;
  return {
    daeunNarrative: clampChars(o.daeunNarrative as string, 340),
    daeunComments: clampArray(o.daeunComments as string[], 50),
    daeunDeep: clampChars(o.daeunDeep as string, 980),
    daeunCaveats: clampArray(o.daeunCaveats as string[], 260),
    seunRows: (o.seunRows as { year: number; strategy: string }[]).map((r) => ({
      year: r.year,
      strategy: clampChars(r.strategy, 105),
    })),
    fiveYearSummary: clampChars(o.fiveYearSummary as string, 260),
    quarterIntro: clampChars(o.quarterIntro as string, 280),
    quarterRows: clampArray(o.quarterRows as string[], 150),
    goldenWindowNote: clampChars(o.goldenWindowNote as string, 240),
    donts: clampArray(o.donts as string[], 105),
    monthRows: clampArray(o.monthRows as string[], 52),
  };
}

const INSTRUCTION = `
[이번 호출 범위 — PART III 사이클 전망 (p.10~14)]

작성 필드와 분량 범위(상단 80~100%를 채울 것):
- daeunNarrative: [대운 전체 사이클] 차트가 말하는 전체 서사 1문단. 240~320자. 인생 전체의
  상승/하강 구간을 짚고 현재 위치의 의미로 끝맺어라.
- daeunComments: [대운 전체 사이클] 목록의 각 구간에 대한 한 줄 코멘트. 배열 순서·개수를
  데이터의 대운 목록과 정확히 일치시켜라. 각 20~45자 (예: "비견 조력 — 운이 동료를 대신해준 성장기").
- daeunDeep: [현재 대운] 심층 분석. 700~950자. 대운 두 글자를 분해해 이 10년의
  성격을 규정하고, 직전 대운과 대비(돈의 성격/체력/유리한 행동/불리한 행동)를 명확히 하라.
  기운 흐름 변화는 쉬운 말로만 서술 (12운성 명칭 사용 금지).
- daeunCaveats: 현재 대운의 유의 조항 2개. 각 160~240자. "**① OOO.**" 형식으로 시작.
  데이터의 [합충] 관계나 신살을 근거로.
- seunRows: [세운] 목록의 각 연도에 대해 {year, strategy(운용 전략, 60~95자)}. 세운 배열 개수만큼.
- fiveYearSummary: "**5개년 요약 전략.**"으로 시작. 밟는 해/지키는 해/거두는 해 구분. 160~240자.
- quarterIntro: 가장 가까운 세운 연도의 성격을 규정하는 도입 문단. 180~260자. 올해의 핵심
  기술 한 가지를 **볼드**로 제시하며 끝맺어라.
- quarterRows: 그 해를 4분기로 나눈 운용 가이드 4개. 각 90~140자. 해당 분기의 월운 간지
  기운을 근거로 구체적으로.
- goldenWindowNote: "**골든 윈도우 : OOO.**"으로 시작. 데이터의 골든 월운이 왜 중요한지,
  그 달에 무엇을 배치해야 하는지. 140~220자.
- donts: 그 해에 하지 말아야 할 것 3가지. 각 60~95자. "**금지 항목** — 이유" 구조.
- monthRows: [월운] 12개월 각각에 대한 한 줄 운용 지침. 각 28~48자. 월운 배열 순서 그대로.

[핵심 규칙]
- 모든 지수·간지·연도는 데이터 블록 값을 그대로 사용.
- 지수가 낮은(caution) 구간도 "하지 말라"가 아니라 "방어적으로 하라" 톤 유지.
- 핵심 어구는 **볼드** 표기.
- ⚠️ 산문 필드(daeunNarrative/daeunDeep/daeunCaveats/quarterIntro/goldenWindowNote/donts)에는
  신살 원어·공망·12운성 명칭 절대 금지 — 데이터 블록의 원어를 복사하지 말고 쉬운 말로만.
`;

const SCHEMA_INSTRUCTION = `
[출력 형식]
{
  "daeunNarrative": "...",
  "daeunComments": ["...", ... 대운 개수만큼],
  "daeunDeep": "...",
  "daeunCaveats": ["**① ...** ...", "**② ...** ..."],
  "seunRows": [{"year": 2026, "strategy": "..."}, ...],
  "fiveYearSummary": "**5개년 요약 전략.** ...",
  "quarterIntro": "...",
  "quarterRows": ["...", "...", "...", "..."],
  "goldenWindowNote": "**골든 윈도우 : ...** ...",
  "donts": ["**...** — ...", "...", "..."],
  "monthRows": ["...", ... 12개]
}
코드블록 마커 없이 순수 JSON 객체 하나만. JSON 외 텍스트 금지.
`;

export function buildReportPart3Prompt(data: ReportData): { system: string; user: string } {
  const context = formatReportDataContext(data);
  const user = `[확정 데이터]
${context}

${INSTRUCTION}
${SCHEMA_INSTRUCTION}`;
  return { system: ANALYST_SYSTEM_PROMPT, user };
}

// 표 셀(daeunComments/seunRows/monthRows/quarterRows)은 용어 검사 제외, 분량 하한은 적용.
// 게이트 하한: 산문 대형 필드는 프롬프트 하한의 ~90%, 짧은 표 셀은 ~75% —
// 표 셀은 몇 자 차이로 파트 전체를 재생성시키는 낭비가 커서 더 관대하게 (실측 튜닝).
const PART3_RANGES: FieldRanges = {
  daeunNarrative: { min: 218, max: 340 },
  daeunComments: { min: 15, max: 50 },
  daeunDeep: { min: 640, max: 980 },
  daeunCaveats: { min: 145, max: 260 },
  seunStrategies: { min: 45, max: 105 },
  fiveYearSummary: { min: 145, max: 260 },
  quarterIntro: { min: 164, max: 280 },
  quarterRows: { min: 72, max: 150 },
  goldenWindowNote: { min: 127, max: 240 },
  donts: { min: 46, max: 105 },
  monthRows: { min: 21, max: 52 },
};

export function validatePart3(s: ReportPart3Sections): string[] {
  const prose = [
    s.daeunNarrative,
    s.daeunDeep,
    ...s.daeunCaveats,
    s.fiveYearSummary,
    s.quarterIntro,
    s.goldenWindowNote,
    ...s.donts,
  ].join("\n");
  return [
    ...checkTermRules(prose),
    ...checkMinLengths(
      {
        daeunNarrative: s.daeunNarrative,
        daeunComments: s.daeunComments,
        daeunDeep: s.daeunDeep,
        daeunCaveats: s.daeunCaveats,
        seunStrategies: s.seunRows.map((r) => r.strategy),
        fiveYearSummary: s.fiveYearSummary,
        quarterIntro: s.quarterIntro,
        quarterRows: s.quarterRows,
        goldenWindowNote: s.goldenWindowNote,
        donts: s.donts,
        monthRows: s.monthRows,
      },
      PART3_RANGES,
    ),
  ];
}
