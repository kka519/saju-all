// =====================================================
// PART IV·V — 실행 전략 + 마무리 (p.15~18, p.20)
// =====================================================
// p.19~20 의 리스크 공시/Compliance Notice/FAQ 는 전부 고정 텍스트(비-AI) —
// template/fixed-sections.ts 에 하드코딩, 여기서 생성하지 않음.
//
// 레퍼런스 PDF 대조 후 전면 구조화: 기존 단일 문단 3개(profitModel/riskManagement/
// relationshipCapital)로는 p.15~17 이 거의 비어 보였음 — 레퍼런스처럼
// 도입문단 + 표 행들 + 볼드리드 불릿 + 콜아웃 구조로 페이지를 채운다.

import { ANALYST_SYSTEM_PROMPT } from "./system";
import { formatReportDataContext } from "./format-data-context";
import { clampChars, clampArray, stripBold } from "./clamp";
import { checkTermRules, checkMinLengths, type FieldRanges } from "./term-guard";
import type { ReportData } from "../normalize";

export type PortfolioRow = { item: string; fixed: string; opportunity: string };
export type RiskTypeRow = { type: string; cause: string; remedy: string };
export type RiskCalendarRow = { timing: string; note: string };
export type HelperRow = { type: string; person: string; role: string };
export type LeadBullet = { lead: string; body: string };

export type ReportPart4Sections = {
  // p.15 수익모델
  profitIntro: string; // 220~320자
  portfolioRows: PortfolioRow[]; // 4~5행 {항목, 안정 라인, 기회 라인}
  profitChannels: LeadBullet[]; // 3개 {lead(볼드 제목), body(80~140자)}
  // p.16 리스크 관리
  riskTypes: RiskTypeRow[]; // 3행 {유형, 구조적 원인, 증상 및 차단 장치}
  riskCalendar: RiskCalendarRow[]; // 3~4행 {시기, 주의사항}
  healthNote: string; // 240~360자, 의료 단서 필수
  riskCallout: string; // 140~220자, "**단 하나만 기억한다면.**" 시작
  // p.17 관계 자본
  relationIntro: string; // 200~300자
  helperRows: HelperRow[]; // 4행 {유형, 이런 기운의 사람, 맡길 역할}
  relationPrinciples: LeadBullet[]; // 3개
  relationCallout: string; // 140~220자, 액션 포인트
  // p.18 액션 플랜
  actions30days: string[]; // 4개, 각 55~90자
  actions1year: string[]; // 4개, 각 55~90자
  actions10year: string[]; // 4개, 각 55~90자
  // p.20 결론
  closing: string[]; // 3문장, 각 60~90자
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}
function isStringArray(v: unknown, min: number): v is string[] {
  return Array.isArray(v) && v.length >= min && v.every(isNonEmptyString);
}
function isLeadBulletArray(v: unknown, min: number): v is LeadBullet[] {
  if (!Array.isArray(v) || v.length < min) return false;
  return v.every((row) => {
    const r = row as Record<string, unknown>;
    return isNonEmptyString(r.lead) && isNonEmptyString(r.body);
  });
}

export function parseReportPart4Sections(obj: unknown): ReportPart4Sections | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;

  if (!isNonEmptyString(o.profitIntro)) return null;
  if (!Array.isArray(o.portfolioRows) || o.portfolioRows.length < 3) return null;
  for (const row of o.portfolioRows) {
    const r = row as Record<string, unknown>;
    if (!isNonEmptyString(r.item) || !isNonEmptyString(r.fixed) || !isNonEmptyString(r.opportunity)) return null;
  }
  if (!isLeadBulletArray(o.profitChannels, 2)) return null;

  if (!Array.isArray(o.riskTypes) || o.riskTypes.length < 2) return null;
  for (const row of o.riskTypes) {
    const r = row as Record<string, unknown>;
    if (!isNonEmptyString(r.type) || !isNonEmptyString(r.cause) || !isNonEmptyString(r.remedy)) return null;
  }
  if (!Array.isArray(o.riskCalendar) || o.riskCalendar.length < 2) return null;
  for (const row of o.riskCalendar) {
    const r = row as Record<string, unknown>;
    if (!isNonEmptyString(r.timing) || !isNonEmptyString(r.note)) return null;
  }
  if (!isNonEmptyString(o.healthNote)) return null;
  if (!isNonEmptyString(o.riskCallout)) return null;

  if (!isNonEmptyString(o.relationIntro)) return null;
  if (!Array.isArray(o.helperRows) || o.helperRows.length < 3) return null;
  for (const row of o.helperRows) {
    const r = row as Record<string, unknown>;
    if (!isNonEmptyString(r.type) || !isNonEmptyString(r.person) || !isNonEmptyString(r.role)) return null;
  }
  if (!isLeadBulletArray(o.relationPrinciples, 2)) return null;
  if (!isNonEmptyString(o.relationCallout)) return null;

  if (!isStringArray(o.actions30days, 3)) return null;
  if (!isStringArray(o.actions1year, 3)) return null;
  if (!isStringArray(o.actions10year, 3)) return null;
  if (!isStringArray(o.closing, 2)) return null;

  const clampLeadBullets = (arr: LeadBullet[], leadMax: number, bodyMax: number) =>
    arr.map((b) => ({ lead: clampChars(b.lead, leadMax), body: clampChars(b.body, bodyMax) }));

  return {
    profitIntro: clampChars(o.profitIntro as string, 340),
    portfolioRows: (o.portfolioRows as PortfolioRow[]).map((r) => ({
      item: stripBold(clampChars(r.item, 16)),
      fixed: clampChars(r.fixed, 60),
      opportunity: clampChars(r.opportunity, 60),
    })),
    profitChannels: clampLeadBullets(o.profitChannels as LeadBullet[], 24, 150),
    riskTypes: (o.riskTypes as RiskTypeRow[]).map((r) => ({
      type: stripBold(clampChars(r.type, 16)),
      cause: stripBold(clampChars(r.cause, 44)),
      remedy: clampChars(r.remedy, 110),
    })),
    riskCalendar: (o.riskCalendar as RiskCalendarRow[]).map((r) => ({
      timing: stripBold(clampChars(r.timing, 22)),
      note: clampChars(r.note, 80),
    })),
    healthNote: clampChars(o.healthNote as string, 380),
    riskCallout: clampChars(o.riskCallout as string, 240),
    relationIntro: clampChars(o.relationIntro as string, 320),
    helperRows: (o.helperRows as HelperRow[]).map((r) => ({
      type: stripBold(clampChars(r.type, 16)),
      person: clampChars(r.person, 55),
      role: clampChars(r.role, 55),
    })),
    relationPrinciples: clampLeadBullets(o.relationPrinciples as LeadBullet[], 26, 150),
    relationCallout: clampChars(o.relationCallout as string, 240),
    actions30days: clampArray(o.actions30days as string[], 100),
    actions1year: clampArray(o.actions1year as string[], 100),
    actions10year: clampArray(o.actions10year as string[], 100),
    closing: clampArray(o.closing as string[], 100),
  };
}

const INSTRUCTION = `
[이번 호출 범위 — PART IV 실행 전략 (p.15~18) + 결론 (p.20)]

작성 필드와 분량 범위(상단 80~100%를 채울 것):

《p.15 수익모델》
- profitIntro: 이 명식의 수익 구조를 규정하는 도입 문단. 220~320자. 십신 구조(식상/재성 등)를
  근거로 "이 명식의 돈은 어떤 성격인가"를 규정.
- portfolioRows: 권고 포트폴리오 표 4~5행. 각 {item: 항목(성격/예시/운용 원칙/확대 시기/축소 시기 등),
  fixed: 안정 라인 내용(20~60자), opportunity: 기회 라인 내용(20~60자)}.
- profitChannels: 이 명식의 강점을 돈으로 바꾸는 관로 3개. 각 {lead: "**OO의 OO화.**" 형식
  제목(최대 24자), body: 십신·귀인 근거와 구체 방식(80~140자)}.

《p.16 리스크 관리》
- riskTypes: 이 명식의 손실 유형 3행. 각 {type: "① OO성 손실" 형식(최대 16자),
  cause: 구조적 원인 — 신살/십신 근거(20~44자), remedy: 증상 및 차단 장치(50~110자, "**차단:**" 포함)}.
- riskCalendar: 리스크 캘린더 3~4행. 각 {timing: 시기(예: "매년 8~9월", "2028·2030년"),
  note: 주의사항(40~80자)}. 데이터의 세운/월운/합충을 근거로.
- healthNote: 건강 관련 서술. 240~360자. 오행 취약 계열을 짚되, 반드시 "의학적 진단이 아니며
  증상이 있으면 의료기관 상담을 권한다"는 단서 포함.
- riskCallout: "**단 하나만 기억한다면.**"으로 시작하는 콜아웃. 140~220자.

《p.17 관계 자본》
- relationIntro: 이 명식의 관계 구조(비겁/관성/귀인 상태)를 규정하는 도입 문단. 200~300자.
- helperRows: 조력자 매칭 가이드 표 4행. 각 {type: 유형(최대 16자), person: 이런 기운의
  사람(20~55자), role: 맡길 역할(20~55자)}. 오행·귀인 기반으로.
- relationPrinciples: 관계 운용 원칙 3개. 각 {lead: "**원칙 제목.**"(최대 26자), body: 80~140자}.
- relationCallout: "**OOOO 액션 포인트.**"로 시작하는 콜아웃. 140~220자. 시기 데이터 근거.

《p.18 액션 플랜》
- actions30days / actions1year / actions10year: 각 4개 행동 지침. 각 55~90자.
  "**행동 리드** — 부연" 구조. 검증 불가능한 결과 단정 금지 — 태도·방향 지침으로.

《p.20 결론》
- closing: 결론 3문장. 각 60~90자. 마지막은 "운은 시황이지 실적이 아니다" 관점으로 마무리.

[핵심 규칙]
- 특정 금융상품 권유 금지. "투자의견"은 비유임을 전제.
- 결정론적 단언 금지. 핵심 어구는 **볼드** 표기.
- 모든 간지·연도·십신은 데이터 블록에서 그대로 인용.
- ⚠️ 산문 필드(profitIntro/profitChannels/healthNote/riskCallout/relationIntro/
  relationPrinciples/relationCallout/actions/closing)에는 신살 원어·공망·12운성 명칭 절대 금지 —
  데이터 블록의 원어를 복사하지 말고 쉬운 말로만. 원어는 표 필드(riskTypes.cause 등)에서만 허용.
`;

const SCHEMA_INSTRUCTION = `
[출력 형식]
{
  "profitIntro": "...",
  "portfolioRows": [{"item":"...","fixed":"...","opportunity":"..."}, ...4~5행],
  "profitChannels": [{"lead":"**...**","body":"..."}, ...3개],
  "riskTypes": [{"type":"① ...","cause":"...","remedy":"... **차단:** ..."}, ...3행],
  "riskCalendar": [{"timing":"...","note":"..."}, ...3~4행],
  "healthNote": "...",
  "riskCallout": "**단 하나만 기억한다면.** ...",
  "relationIntro": "...",
  "helperRows": [{"type":"...","person":"...","role":"..."}, ...4행],
  "relationPrinciples": [{"lead":"**...**","body":"..."}, ...3개],
  "relationCallout": "**... 액션 포인트.** ...",
  "actions30days": ["...", "...", "...", "..."],
  "actions1year": ["...", "...", "...", "..."],
  "actions10year": ["...", "...", "...", "..."],
  "closing": ["...", "...", "..."]
}
코드블록 마커 없이 순수 JSON 객체 하나만. JSON 외 텍스트 금지.
`;

export function buildReportPart4Prompt(data: ReportData): { system: string; user: string } {
  const context = formatReportDataContext(data);
  const user = `[확정 데이터]
${context}

${INSTRUCTION}
${SCHEMA_INSTRUCTION}`;
  return { system: ANALYST_SYSTEM_PROMPT, user };
}

// 표 셀(portfolioRows/riskTypes/riskCalendar/helperRows)은 용어 검사 제외, 주요 본문만.
// 게이트 하한은 프롬프트 하한보다 ~10% 느슨하게 — 몇 자 차이 재시도 낭비 방지.
const PART4_RANGES: FieldRanges = {
  profitIntro: { min: 200, max: 340 },
  profitChannelBodies: { min: 72, max: 150 },
  healthNote: { min: 218, max: 380 },
  riskCallout: { min: 127, max: 240 },
  relationIntro: { min: 182, max: 320 },
  relationPrincipleBodies: { min: 72, max: 150 },
  relationCallout: { min: 127, max: 240 },
  actions30days: { min: 42, max: 100 },
  actions1year: { min: 42, max: 100 },
  actions10year: { min: 42, max: 100 },
  closing: { min: 46, max: 100 },
};

export function validatePart4(s: ReportPart4Sections): string[] {
  const prose = [
    s.profitIntro,
    ...s.profitChannels.flatMap((c) => [c.lead, c.body]),
    s.healthNote,
    s.riskCallout,
    s.relationIntro,
    ...s.relationPrinciples.flatMap((c) => [c.lead, c.body]),
    s.relationCallout,
    ...s.actions30days,
    ...s.actions1year,
    ...s.actions10year,
    ...s.closing,
  ].join("\n");
  return [
    ...checkTermRules(prose),
    ...checkMinLengths(
      {
        profitIntro: s.profitIntro,
        profitChannelBodies: s.profitChannels.map((c) => c.body),
        healthNote: s.healthNote,
        riskCallout: s.riskCallout,
        relationIntro: s.relationIntro,
        relationPrincipleBodies: s.relationPrinciples.map((c) => c.body),
        relationCallout: s.relationCallout,
        actions30days: s.actions30days,
        actions1year: s.actions1year,
        actions10year: s.actions10year,
        closing: s.closing,
      },
      PART4_RANGES,
    ),
  ];
}
