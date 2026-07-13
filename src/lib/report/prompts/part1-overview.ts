// =====================================================
// PART 0 + PART I — 표지/Executive Summary/종목분석 (p.1~7)
// =====================================================
// wealth-prompt.ts 와 동일 패턴: 엄격 JSON 스키마 + 분량 범위 + parse 검증기.
// 톤은 두리가 아니라 ANALYST_SYSTEM_PROMPT (증권 리서치 문체).
// 레퍼런스 PDF(인생애널리스트보고서_정식판20p) 대조 후 필드 확장:
//   - specNotes: p.4 스펙 시트 해설 컬럼
//   - ilganEpithet/ilganSecTitle: p.5 밴드/섹션 타이틀 보강
//   - strengthSummary/complementTasks: p.5 강점 요약 골드 박스

import { ANALYST_SYSTEM_PROMPT } from "./system";
import { formatReportDataContext } from "./format-data-context";
import { clampChars, stripBold } from "./clamp";
import type { ReportData } from "../normalize";

export type DecisionStyleRow = { item: string; diagnosis: string; basis: string };
export type SinsalRow = { name: string; note: string };
export type SpecNotes = {
  ohaeng: string;
  strength: string;
  yongsin: string;
  gisin: string;
  gongmang: string;
  cheoneul: string;
  gyeokguk: string;
};

export type ReportPart1Sections = {
  headline: string; // 표지 헤드라인, "구절1,\n구절2" 2행, 합 max 34자
  execSummary: string[]; // 4개 항목, 각 140~190자, **볼드 리드** 시작
  keySentence: string; // 100~130자, 따옴표 인용문 형태
  specComment: string; // p.4 스펙 요약, 280~370자
  specNotes: SpecNotes; // p.4 해설 컬럼, 각 20~42자
  ilganEpithet: string; // p.5 밴드 타이틀 별칭 (예: "甲木, 홀로 서 있는 큰 나무"), max 24자
  ilganSecTitle: string; // p.5 섹션 타이틀 (예: "성장주, 그것도 우직한 우량 성장주"), max 26자
  ilganDeep: string[]; // 2문단, 각 340~440자
  decisionStyle: DecisionStyleRow[]; // 5행
  pattern: string; // p.5 반복 패턴, 300~400자
  strengthSummary: string; // p.5 골드박스 강점 요약, 80~120자
  complementTasks: string; // p.5 골드박스 보완 과제, 50~90자
  valuechainComment: string; // p.6, 240~320자
  jaedaWarning: string; // p.6 구조적 경고, 220~300자
  sinsalRows: SinsalRow[]; // 신살/귀인 해설, 각 note 70~120자
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

const SPEC_NOTE_KEYS: readonly (keyof SpecNotes)[] = [
  "ohaeng",
  "strength",
  "yongsin",
  "gisin",
  "gongmang",
  "cheoneul",
  "gyeokguk",
];

export function parseReportPart1Sections(obj: unknown): ReportPart1Sections | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;

  if (!isNonEmptyString(o.headline)) return null;
  if (!Array.isArray(o.execSummary) || o.execSummary.length < 3 || !o.execSummary.every(isNonEmptyString)) return null;
  if (!isNonEmptyString(o.keySentence)) return null;
  if (!isNonEmptyString(o.specComment)) return null;
  if (!o.specNotes || typeof o.specNotes !== "object") return null;
  const sn = o.specNotes as Record<string, unknown>;
  for (const k of SPEC_NOTE_KEYS) if (!isNonEmptyString(sn[k])) return null;
  if (!isNonEmptyString(o.ilganEpithet)) return null;
  if (!isNonEmptyString(o.ilganSecTitle)) return null;
  if (!Array.isArray(o.ilganDeep) || o.ilganDeep.length < 2 || !o.ilganDeep.every(isNonEmptyString)) return null;
  if (!Array.isArray(o.decisionStyle) || o.decisionStyle.length < 3) return null;
  for (const row of o.decisionStyle) {
    const r = row as Record<string, unknown>;
    if (!isNonEmptyString(r.item) || !isNonEmptyString(r.diagnosis) || !isNonEmptyString(r.basis)) return null;
  }
  if (!isNonEmptyString(o.pattern)) return null;
  if (!isNonEmptyString(o.strengthSummary)) return null;
  if (!isNonEmptyString(o.complementTasks)) return null;
  if (!isNonEmptyString(o.valuechainComment)) return null;
  if (!isNonEmptyString(o.jaedaWarning)) return null;
  if (!Array.isArray(o.sinsalRows) || o.sinsalRows.length < 1) return null;
  for (const row of o.sinsalRows) {
    const r = row as Record<string, unknown>;
    if (!isNonEmptyString(r.name) || !isNonEmptyString(r.note)) return null;
  }
  // 최종 방어선 — LLM이 분량 상한을 넘겨도 여기서 강제로 자름 (A4 고정 레이아웃 보호).
  const notes = o.specNotes as SpecNotes;
  return {
    headline: clampChars(o.headline as string, 40),
    execSummary: (o.execSummary as string[]).map((s) => clampChars(s, 200)),
    keySentence: clampChars(o.keySentence as string, 140),
    specComment: clampChars(o.specComment as string, 390),
    specNotes: Object.fromEntries(
      SPEC_NOTE_KEYS.map((k) => [k, stripBold(clampChars(notes[k], 46))]),
    ) as SpecNotes,
    ilganEpithet: stripBold(clampChars(o.ilganEpithet as string, 28)),
    ilganSecTitle: stripBold(clampChars(o.ilganSecTitle as string, 30)),
    ilganDeep: (o.ilganDeep as string[]).map((s) => clampChars(s, 460)),
    decisionStyle: (o.decisionStyle as DecisionStyleRow[]).map((r) => ({
      item: stripBold(clampChars(r.item, 20)),
      diagnosis: stripBold(clampChars(r.diagnosis, 44)),
      basis: stripBold(clampChars(r.basis, 54)),
    })),
    pattern: clampChars(o.pattern as string, 420),
    strengthSummary: clampChars(o.strengthSummary as string, 130),
    complementTasks: clampChars(o.complementTasks as string, 100),
    valuechainComment: clampChars(o.valuechainComment as string, 340),
    jaedaWarning: clampChars(o.jaedaWarning as string, 320),
    sinsalRows: (o.sinsalRows as SinsalRow[]).map((r) => ({
      name: stripBold(clampChars(r.name, 20)),
      note: clampChars(r.note, 130),
    })),
  };
}

const INSTRUCTION = `
[이번 호출 범위 — PART 0 표지/Executive Summary + PART I 종목분석 (p.1~7)]

작성 필드와 분량 범위(하한 미달 = 페이지 허전, 상한 초과 = 페이지 밀림. 상단 80~100% 채울 것):
- headline: 표지 헤드라인. 반드시 "구절1,\\n구절2" 처럼 줄바꿈(\\n)으로 나뉜 2행 구조. 시적이면서 구조적 (예: "10년의 겨울이 끝났다,\\n뿌리에 물이 닿는 시간"). 합계 24~34자.
- execSummary: 핵심 요약 4개 항목. 각 140~190자. 반드시 "**볼드 리드 문장.**"으로 시작 후 근거 설명. 순서: ①구조적 강점 ②구조적 약점 ③사이클 전환 시점(투자의견 언급) ④이번 10년의 주제와 로드맵.
- keySentence: "본 리포트의 핵심 문장 하나". 100~130자. 큰따옴표로 감싼 인용문 형태로, 독자의 지난 10년을 시황으로 재해석해주는 문장.
- specComment: p.4 스펙 요약 코멘트. 280~370자. 명식 전체를 하나의 은유(나무/구조물 등)로 관통해 요약하고, 이 명식 서사의 핵심 코드를 짚어라.
- specNotes: p.4 스펙 시트 각 행의 해설. 각 20~42자. {ohaeng: 오행 수급 해설, strength: 신강약 해설, yongsin: 용신·희신 해설, gisin: 기신 해설, gongmang: 공망 해설, cheoneul: 천을귀인 해설, gyeokguk: 격국 해설}.
- ilganEpithet: 일간을 한 구절로 표현한 별칭. "甲木, 홀로 서 있는 큰 나무" 같은 형식(한자 일간 + 은유). 최대 24자.
- ilganSecTitle: 종목 성격 섹션 부제. "성장주, 그것도 우직한 우량 성장주" 같은 투자 은유. 최대 26자.
- ilganDeep: 일간 심층 분석 2문단. 각 340~440자. 1문단=일간 글자의 본성과 이 사람의 기본 기질(투자 은유 병기), 2문단=이 명식 고유의 조합(계절/시각/오행 배치/용신 구조)이 만드는 구체적 성격.
- decisionStyle: 의사결정 스타일 표 5행. 각 행 {item: 항목명(예: "결정 속도"), diagnosis: 진단(20~40자), basis: 명식 근거(20~50자)}.
- pattern: 이 사람이 평생 반복해온 패턴 1문단. 300~400자. 구체적인 행동 패턴("차라리 내가 하고 만다" 식 실감나는 표현 포함)과 그것이 팔자 구조임을 짚어라.
- strengthSummary: "**강점 요약.**"으로 시작. 강점을 십신 라벨과 함께 나열. 80~120자.
- complementTasks: "**보완 과제.**"로 시작. 보완할 것들 나열. 50~90자.
- valuechainComment: 십신 밸류체인(인성→일간→식상→재성→관성 순환) 해설. 240~320자. 어디서 병목이 생기는지 명시.
- jaedaWarning: 명식의 구조적 리스크 경고. 220~300자. "**OOO 경고.**"로 시작.
- sinsalRows: 데이터의 [신살]/[귀인] 목록 중 의미 있는 것 5~8개를 골라 해설. 각 {name, note(70~120자)}. note에는 이 사람 삶에서의 발현 방식과 활용/관리 지침 포함.

[핵심 규칙]
- 모든 수치·간지·오행은 데이터 블록에서 그대로 인용 — 재계산·추측 금지.
- 각 필드는 빈 문자열 금지. 핵심 어구는 **볼드** 표기.
- decisionStyle 의 basis 는 반드시 명식 데이터(십성/신살/격국 등)를 근거로 제시.
`;

const SCHEMA_INSTRUCTION = `
[출력 형식 — 매우 중요]
반드시 아래 JSON 객체 하나로만 응답한다. 코드블록 마커 없이 { 로 시작해 } 로 끝나는 순수 JSON:

{
  "headline": "구절1,\\n구절2",
  "execSummary": ["**리드.** 설명", "...", "...", "..."],
  "keySentence": "\\"...\\"",
  "specComment": "...",
  "specNotes": {"ohaeng":"...","strength":"...","yongsin":"...","gisin":"...","gongmang":"...","cheoneul":"...","gyeokguk":"..."},
  "ilganEpithet": "...",
  "ilganSecTitle": "...",
  "ilganDeep": ["...", "..."],
  "decisionStyle": [{"item":"...","diagnosis":"...","basis":"..."}, ...5개],
  "pattern": "...",
  "strengthSummary": "**강점 요약.** ...",
  "complementTasks": "**보완 과제.** ...",
  "valuechainComment": "...",
  "jaedaWarning": "...",
  "sinsalRows": [{"name":"...","note":"..."}, ...]
}
JSON 외 다른 텍스트 절대 추가 금지.
`;

export function buildReportPart1Prompt(data: ReportData): { system: string; user: string } {
  const context = formatReportDataContext(data);
  const user = `[확정 데이터]
${context}

${INSTRUCTION}
${SCHEMA_INSTRUCTION}`;
  return { system: ANALYST_SYSTEM_PROMPT, user };
}
