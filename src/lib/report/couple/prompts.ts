// =====================================================
// 커플 궁합 리포트 — 본편 콘텐츠 프롬프트 (Phase B)
// =====================================================
// 지시문_궁합리포트_Phase B수정_20260715.md 6건 반영:
//   1. 용어 규칙(term-guard.ts FORBIDDEN_TERMS 재사용 — 귀인 16종 추가는 그 파일에서)
//   2. 산술 표현(오행 분포·비율)은 코드가 문장으로 만들어 주입, LLM 생성 금지
//   3. 세운 점수는 couple-seun-data.ts가 코드로 추출·주입 + 출력 일치 게이트
//   4. 백테스트 헤지 과다 방지 — 톤 지시 + 섹션당 헤지 1회 이하
//   5. 호칭 — 이름 있으면 "OO님", 없으면 본인/상대방 폴백
//   6. 분량 상향 + 케미스트리 8블록/2페이지 확장(기획서 §4)

import { ANALYST_SYSTEM_PROMPT } from "@/lib/report/prompts/system";
import { checkTermRules, checkMinLengths, sanitizeProseFields, type FieldRanges } from "@/lib/report/prompts/term-guard";
import type { CoupleRelationMatrix } from "./relation-matrix";
import { formatRelationMatrixForPrompt } from "./relation-matrix";
import type { CoupleSeunSeries } from "./couple-seun-data";
import { formatCoupleSeunSeriesForPrompt } from "./couple-seun-data";
import type { MyeongsikViewModel } from "@/lib/saju/build-myeongsik-view";
import type { Oheng } from "@/lib/saju/derived";

// ── 이름 처리(수정 5) ──────────────────────────────────
export type CoupleNames = { selfLabel: string; partnerLabel: string };

export function resolveCoupleNames(selfName?: string | null, partnerName?: string | null): CoupleNames {
  return {
    selfLabel: selfName?.trim() ? `${selfName.trim()}님` : "본인",
    partnerLabel: partnerName?.trim() ? `${partnerName.trim()}님` : "상대방",
  };
}

// ── 산술 표현 코드화(수정 2) ────────────────────────────
// "8자 중 6개=75%" 같은 글자 수·비율 계산은 LLM이 하면 "6개 중 6개"↔"75%" 같은
// 산술 모순이 난다(draft에서 실측 확인) — 코드가 정확히 세어 문장으로 만들고
// LLM은 그 문장을 그대로 인용만 하게 한다.
export function formatOhaengDistribution(view: MyeongsikViewModel, label: string): string {
  const entries = Object.entries(view.ohaengCount) as [Oheng, number][];
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  const sorted = [...entries].sort((a, b) => b[1] - a[1]);
  const [topOheng, topCount] = sorted[0];
  const pct = total > 0 ? Math.round((topCount / total) * 100) : 0;
  const breakdown = entries.map(([o, n]) => `${o}${n}`).join(" ");
  return `${label} 오행 분포: ${breakdown} (전체 ${total}자 중 ${topOheng} ${topCount}개 = ${pct}%)`;
}

// ── 프롬프트 본체 ───────────────────────────────────────

export type CoupleContentPromptInput = {
  names: CoupleNames;
  selfManseryeokText: string;
  partnerManseryeokText: string;
  matrix: CoupleRelationMatrix;
  seunSeries: CoupleSeunSeries;
};

const COUPLE_SYSTEM_ADDENDUM = `
[상품 특화 — 커플 궁합 리포트 "COUPLE MERGER RESEARCH"]
이 리포트는 두 사람(종목 A={{SELF}}, 종목 B={{PARTNER}})의 "합병 실사 보고서"다. 반드시
두 명식을 모두 근거로 인용해 서술하라 — 한쪽만 분석하면 안 된다.

[호칭 — 절대 준수]
"본인"/"상대"/"상대방"이라는 말 대신 반드시 "{{SELF}}"/"{{PARTNER}}"로 지칭하라.

[JSON 문자열 안 인용부호 — 절대 준수, 파싱 실패의 최대 원인]
예시 대사·강조 인용을 넣을 때 큰따옴표(")를 쓰지 마라. 대신 작은따옴표를 써라:
'나는 이런 감정을 느꼈다' 는 식으로.
**작은따옴표(')는 JSON에서 아무 의미 없는 평범한 글자다 — 백슬래시로 이스케이프하지
마라. \' 처럼 쓰면 그 자체가 문법 오류다.** 그냥 ' 하나만 그대로 타이핑해라.
큰따옴표가 정 필요하면(거의 없어야 함) 반드시 \" 로 이스케이프하라 — 이때만 백슬래시를 쓴다.

[핵심 서사]
"두 분이 다투는 것은 사랑이 부족해서가 아니라 관계의 구조 때문이며, 그 구조는 다룰 수
있다"는 메시지를 리스크 공시·리스크 관리 파트에서 관철하라.

[백테스트·캘린더 톤 — 헤지 과다 금지]
"엇갈렸을 가능성이 높다", "체감되었을 수도 있다" 같은 헤지 표현을 한 섹션에 1회를
넘기지 마라. 과거 사실(세운 점수)에 대해서는 단정형으로 써라: "2025년, 유독 힘들지
않으셨습니까" 같은 적중 체감 톤. 미래 예측에만 최소한의 가능성 어법을 남겨라.

[산술 표현 — 절대 준수]
글자 개수·비율·퍼센트 등 산술적 사실은 아래 [오행 분포] 블록에 코드가 이미 계산해
넣어뒀다. 그 문장을 그대로 인용하라 — 직접 세거나 계산해서 다른 숫자를 쓰면 안 된다
(예: "6개 중 6개"라고 세어놓고 "75%"라고 쓰는 산술 모순 금지).

[세운 점수 — 절대 준수]
아래 [세운 교차] 블록의 연도·간지·점수만 언급하라. 블록에 없는 연도나 점수를
새로 만들어내면 안 된다 — 언급하는 모든 연도-점수 쌍은 반드시 이 블록에서 그대로
가져온 것이어야 한다.

[케미스트리 리포트 — chemistry 8블록]
잠자리·밤·욕구·주도권을 정면으로 다루되(허용어: 잠자리, 밤, 욕구, 스킨십, 주도권,
달아오르다, 예열, 온도, 밀당, 몸의 대화, 리드), 성행위를 직접 묘사하거나 신체 부위를
명시하거나 외설적 표현을 쓰지 마라. 8개 필드를 각각 채워라:
- chemistryHook: 심리 저격 훅, 현재형 적중으로 시작
- chemistryPersona: 두 사람 각자의 "낮과 밤의 갭" 진단(십성 기반)
- chemistryDesireGauge: 욕구 크기·빈도 온도차
- chemistryLeadStructure: 주도권 구조(누가 이끄는가)
- chemistryPaceCurve: 예열-지속 곡선(빨리 타오르는 형 vs 늦게 데워지는 형)
- chemistrySkinshipLanguage: 스킨십 반응 결의 차이
- chemistrySignalDictionary: 서로 오해하는 신호 2~3개 번역+처방
- chemistryTimingPreview: 향후 온도가 함께 오르는 시기 1개(라이트)

[금지 목록 — 절대 준수]
이혼·파경을 단정하는 표현("일부종사 어렵다" 류) 금지 — 위험 신호는 변동성으로만.
신살·원진을 정신질환(공황장애·빙의 등)과 연결하는 해석 절대 금지.
"남자는 신강, 여자는 신약이 좋다" 류 성별 규범 명제 금지 — 강약은 성별 무관 "에너지
균형"으로만 서술.
`;

export function buildCoupleContentPrompt(input: CoupleContentPromptInput): { system: string; user: string } {
  const { names, matrix } = input;
  const addendum = COUPLE_SYSTEM_ADDENDUM
    .replaceAll("{{SELF}}", names.selfLabel)
    .replaceAll("{{PARTNER}}", names.partnerLabel);
  const system = ANALYST_SYSTEM_PROMPT + addendum;

  const ohaengBlock = [
    formatOhaengDistribution(matrix.selfView, names.selfLabel),
    formatOhaengDistribution(matrix.partnerView, names.partnerLabel),
  ].join("\n");

  const user = `[${names.selfLabel} 만세력]
${input.selfManseryeokText}

[${names.partnerLabel} 만세력]
${input.partnerManseryeokText}

[관계 매트릭스 — 이 값만 사용, 재계산·창작 금지]
${formatRelationMatrixForPrompt(matrix)}

[오행 분포 — 이 문장을 그대로 인용, 직접 계산 금지]
${ohaengBlock}

${formatCoupleSeunSeriesForPrompt(input.seunSeries)}

[출력 스키마] 아래 JSON 키로만 응답하라(코드블록 마커 없이 순수 JSON 객체 하나):
{
  "execSummary": "관계를 한 문장으로 정의 + 총평 (400~550자)",
  "selfSeenByPartner": "${names.partnerLabel}이 ${names.selfLabel}을 어떻게 경험하는가 — 십성 교차 근거 (400~550자)",
  "partnerSeenBySelf": "${names.selfLabel}이 ${names.partnerLabel}을 어떻게 경험하는가 — 십성 교차 근거 (400~550자)",
  "attractionStructure": "왜 서로에게 끌렸는가 — 천간합·일간 상생상극 근거 (400~550자)",
  "synergy": "성격·소통·라이프스타일이 잘 맞는 지점 (500~700자)",
  "riskDisclosure": "반복되는 다툼 패턴 — 충형파해·용신 교차 근거, 심리 저격형 문장 포함 (600~800자)",
  "riskManagementSelf": "${names.selfLabel}을 위한 화해 사용설명서 — 행동 단위 조언 (400~550자)",
  "riskManagementPartner": "${names.partnerLabel}을 위한 화해 사용설명서 — 행동 단위 조언 (400~550자)",
  "chemistryHook": "케미스트리 심리 저격 훅 (150~250자)",
  "chemistryPersona": "두 사람 각자의 낮과 밤 갭 진단 (350~500자)",
  "chemistryDesireGauge": "욕구 온도차 (200~300자)",
  "chemistryLeadStructure": "주도권 구조 (200~300자)",
  "chemistryPaceCurve": "예열-지속 곡선 (200~300자)",
  "chemistrySkinshipLanguage": "스킨십 언어 차이 (200~300자)",
  "chemistrySignalDictionary": "밤의 시그널 사전 — 오해 신호 2~3개 번역+처방 (300~450자)",
  "chemistryTimingPreview": "온도 타이밍 예고(라이트) (150~250자)",
  "financialOutlook": "공동 재무 전망 — 돈 쓰는 스타일 궁합 (350~450자)",
  "longTermFit": "장기 통합 적합성 — 결혼하면 어떤 부부인가, 배우자궁(일지) 교차 근거 (400~550자)",
  "backtest": "커플 백테스트 — 두 사람 대운·세운 교차로 본 과거 흐름, 적중 체감 톤(단정형) (400~550자)",
  "futureCalendar": "향후 3년 통합 캘린더 — 좋은 시기/주의 시기 (400~550자)",
  "crisisScenario": "위기 시나리오 — 헤어질 위험이 있다면 언제·왜·예방책 (400~550자)",
  "roadmap": "통합 로드맵 — 단계별 행동 아이템 (400~550자)",
  "finalOpinion": "최종 의견 — 총평, 담담한 격려로 마무리 (300~400자)"
}`;

  return { system, user };
}

export type CoupleSections = {
  execSummary: string;
  selfSeenByPartner: string;
  partnerSeenBySelf: string;
  attractionStructure: string;
  synergy: string;
  riskDisclosure: string;
  riskManagementSelf: string;
  riskManagementPartner: string;
  chemistryHook: string;
  chemistryPersona: string;
  chemistryDesireGauge: string;
  chemistryLeadStructure: string;
  chemistryPaceCurve: string;
  chemistrySkinshipLanguage: string;
  chemistrySignalDictionary: string;
  chemistryTimingPreview: string;
  financialOutlook: string;
  longTermFit: string;
  backtest: string;
  futureCalendar: string;
  crisisScenario: string;
  roadmap: string;
  finalOpinion: string;
};

const SECTION_KEYS: readonly (keyof CoupleSections)[] = [
  "execSummary", "selfSeenByPartner", "partnerSeenBySelf", "attractionStructure", "synergy",
  "riskDisclosure", "riskManagementSelf", "riskManagementPartner",
  "chemistryHook", "chemistryPersona", "chemistryDesireGauge", "chemistryLeadStructure",
  "chemistryPaceCurve", "chemistrySkinshipLanguage", "chemistrySignalDictionary", "chemistryTimingPreview",
  "financialOutlook", "longTermFit", "backtest", "futureCalendar", "crisisScenario", "roadmap", "finalOpinion",
];

export const COUPLE_FIELD_RANGES: FieldRanges = {
  execSummary: { min: 400, max: 550 },
  selfSeenByPartner: { min: 400, max: 550 },
  partnerSeenBySelf: { min: 400, max: 550 },
  attractionStructure: { min: 400, max: 550 },
  synergy: { min: 500, max: 700 },
  riskDisclosure: { min: 600, max: 800 },
  riskManagementSelf: { min: 400, max: 550 },
  riskManagementPartner: { min: 400, max: 550 },
  chemistryHook: { min: 150, max: 250 },
  chemistryPersona: { min: 350, max: 500 },
  chemistryDesireGauge: { min: 200, max: 300 },
  chemistryLeadStructure: { min: 200, max: 300 },
  chemistryPaceCurve: { min: 200, max: 300 },
  chemistrySkinshipLanguage: { min: 200, max: 300 },
  chemistrySignalDictionary: { min: 300, max: 450 },
  chemistryTimingPreview: { min: 150, max: 250 },
  financialOutlook: { min: 350, max: 450 },
  longTermFit: { min: 400, max: 550 },
  backtest: { min: 400, max: 550 },
  futureCalendar: { min: 400, max: 550 },
  crisisScenario: { min: 400, max: 550 },
  roadmap: { min: 400, max: 550 },
  finalOpinion: { min: 300, max: 400 },
};

export function parseCoupleSections(obj: unknown): CoupleSections | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const out: Partial<CoupleSections> = {};
  for (const k of SECTION_KEYS) {
    if (typeof o[k] !== "string") return null;
    out[k] = o[k] as string;
  }
  return out as CoupleSections;
}

export function extractAndParseCoupleJSON(text: string): CoupleSections | null {
  try {
    return parseCoupleSections(JSON.parse(text));
  } catch {
    /* fall through */
  }
  const codeFence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeFence?.[1]) {
    try {
      return parseCoupleSections(JSON.parse(codeFence[1].trim()));
    } catch {
      /* fall through */
    }
  }
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return parseCoupleSections(JSON.parse(braceMatch[0]));
    } catch {
      /* fall through */
    }
  }
  return null;
}

// ── 세운 일치 게이트(수정 3) ────────────────────────────
// 본문에 등장하는 "YYYY년" 근처의 부호 있는 숫자(+NN/-NN)가 코드 계산값과
// 일치하는지 검사. 완전한 자연어 파싱은 아니지만, 코드가 준 적 없는 연도-점수
// 조합이 나오면 반드시 걸러낸다(허구 수치 방지가 목적이라 과탐이 안전한 방향).
export function checkSeunConsistency(text: string, series: CoupleSeunSeries): string[] {
  const issues: string[] = [];
  const yearPattern = /(\d{4})년/g;
  let m: RegExpExecArray | null;
  while ((m = yearPattern.exec(text)) !== null) {
    const year = parseInt(m[1], 10);
    if (!series.years.includes(year)) continue; // 리포트 대상 기간 밖 연도는 검사 제외(출생년 등)
    const windowStart = Math.max(0, m.index - 40);
    const windowEnd = Math.min(text.length, m.index + 60);
    const window = text.slice(windowStart, windowEnd);
    const scoreMatches = [...window.matchAll(/([+-]\d{1,3})(?!\d)/g)].map((mm) => parseInt(mm[1], 10));
    if (scoreMatches.length === 0) continue;
    const idx = series.years.indexOf(year);
    const validScores = new Set([series.self[idx].score, series.partner[idx].score]);
    for (const s of scoreMatches) {
      if (!validScores.has(s)) {
        issues.push(
          `${year}년 근처에 언급된 점수 ${s >= 0 ? "+" : ""}${s}가 코드 계산값(본인 ${series.self[idx].score}/상대 ${series.partner[idx].score})과 불일치 — 세운 점수 창작 의심`,
        );
      }
    }
  }
  return issues;
}

// ── 호칭 일치 게이트(수정 5) ────────────────────────────
// 이름이 실제로 입력된 경우에만 검사한다 — 이름 미입력 폴백("본인"/"상대방") 자체는
// 정상 동작이라 그 상태에서는 이 표현이 나와도 위반이 아니다.
export function checkNameUsage(text: string, names: CoupleNames): string[] {
  const usingFallback = names.selfLabel === "본인" && names.partnerLabel === "상대방";
  if (usingFallback) return [];
  const issues: string[] = [];
  if (/상대방|상대는|상대가|상대를|본인은|본인이|본인을/.test(text)) {
    issues.push(`"본인/상대방" 류 표현 등장 — 실제 이름 호칭("OO님")을 사용해야 함`);
  }
  return issues;
}

export function validateCoupleSections(
  sections: CoupleSections,
  matrix: CoupleRelationMatrix,
  seunSeries: CoupleSeunSeries,
  names: CoupleNames,
): string[] {
  const proseText = SECTION_KEYS.map((k) => sections[k]).join("\n");
  const issues: string[] = [
    ...checkTermRules(proseText),
    ...checkMinLengths(sections, COUPLE_FIELD_RANGES),
    ...checkSeunConsistency(proseText, seunSeries),
    ...checkNameUsage(proseText, names),
  ];
  // 상대 일간 인용 게이트(§5.3) — 가짜 궁합 2차 방어. 두 일간 한글자가 모두 등장해야 함.
  const selfGan = matrix.selfView.pillars.day.cheongan;
  const partnerGan = matrix.partnerView.pillars.day.cheongan;
  if (!proseText.includes(selfGan)) issues.push(`본인 일간(${selfGan}) 미인용 — 가짜 궁합 의심`);
  if (!proseText.includes(partnerGan)) issues.push(`상대 일간(${partnerGan}) 미인용 — 가짜 궁합 의심`);
  return issues;
}

/** 재생성 없이 즉시 교정 — sanitizeProseFields 재사용(용어 자동 치환만, 세운/호칭 위반은 재생성 필요). */
export function sanitizeCoupleSections(sections: CoupleSections): { sections: CoupleSections; replaced: string[] } {
  return sanitizeProseFields(sections, SECTION_KEYS);
}
