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
import type { CoupleWolunHighlight } from "./couple-wolun-data";
import { formatCoupleWolunHighlightForPrompt, checkTimingPreviewHasMonthCount } from "./couple-wolun-data";
import type { MyeongsikViewModel } from "@/lib/saju/build-myeongsik-view";
import type { Oheng } from "@/lib/saju/derived";
import {
  computeCoupleTypeNames,
  formatCoupleTypeNamesForPrompt,
  PERSONA_TYPES,
  PACE_TYPES,
  CLOCK_TYPES,
  type CoupleTypeNames,
} from "./type-names";
import {
  judgeRelationshipType,
  formatRelationshipTypeForPrompt,
  computeCoupleHealMatrix,
  formatCoupleHealMatrixForPrompt,
  computeAttractionDevices,
  formatAttractionDevicesForPrompt,
  computeSpousePalaceDiagnoses,
  formatSpousePalaceDiagnosesForPrompt,
  RELATIONSHIP_TYPES,
  type RelationshipType,
} from "./section9";

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
  wolunHighlight: CoupleWolunHighlight;
};

// ── few-shot 고정(검수요청_궁합_fewshot샘플_20260715.md, 사장님 검수 통과) ──
// "쪽집게 장치 5가지": 장면 특정·유형 네이밍·단정+검증 초대·숫자 박기·시간 특정 처방.
// ⚠️ 이 3개 샘플의 이름(경아님/광훈님)·숫자(-107 등)·연도(2025년 등)는 검수 당시
// 검증용으로 쓴 테스트 커플의 실제 값이 우연히 들어간 것일 뿐 — 절대 고정값이 아니다.
// 실제 생성 시 반드시 이번 커플의 [세운 교차]/[관계 매트릭스]/[유형 판정] 블록에서
// 그 커플 고유의 숫자·연도·이름으로 새로 도출해야 한다. 아래는 문체·구조·밀도 참고용.
const FEW_SHOT_SAMPLES = `[샘플 1 — 갈등(리스크 공시/매뉴얼 계열)]
싸운 다음 날 아침, 광훈님은 아무 일 없던 사람처럼 말을 겁니다. 경아님은 그 태연함에 한 번 더 상처받죠. 무심해서가 아닙니다 — 두 분의 회복 시계가 다를 뿐입니다. 광훈님은 반나절 시계, 경아님은 하루반 시계. 시계가 다른 두 사람이 같은 시각에 화해하려니 매번 어긋났던 겁니다. 이 관계에서 화해가 실패한 건 마음이 식어서가 아니라, 시각을 안 맞춘 회의였기 때문입니다.
처방은 하나입니다. 화해는 싸움 후 36시간, 경아님의 시계에 맞추십시오. 그리고 그 36시간 동안 광훈님이 할 일은 설득이 아니라 평소대로 밥을 차리는 일입니다. 경아님의 명식은 말보다 일상이 복구될 때 마음이 풀리는 구조입니다.

[샘플 2 — 속궁합(케미스트리 계열)]
먼저 손을 내미는 쪽은 거의 광훈님일 겁니다. 문제는 방식이 아니라 타이밍입니다. 광훈님의 욕구는 스위치형 — 켜지면 바로 직진합니다. 경아님은 다이얼형 — 천천히 돌려야 올라갑니다. 그래서 두 분의 밤은 자주 어긋났을 겁니다. 광훈님이 다가온 밤, 경아님은 아직 낮을 벗지 못했고, 경아님이 돌아누운 것이 거절이 아니라 예열 중이라는 걸 광훈님은 몰랐습니다.
스위치와 다이얼이 만나면 방법은 하나뿐입니다. 밤의 시작을 스킨십이 아니라 대화 10분으로 바꾸십시오. 경아님의 다이얼은 귀에서부터 돌아갑니다. 그리고 경아님 — 다이얼이 다 돌아간 밤에는 그 신호를 표현해도 좋습니다. 광훈님의 명식은 초대받을 때 가장 좋은 파트너가 되는 구조입니다.

[샘플 3 — 백테스트(시기 계열)]
2025년 을사년. 경아님, 이 해에 유독 지치지 않으셨습니까. 숫자로 말씀드리면 그해 경아님의 시황은 -107 — 7개년 중 최저점이었습니다. 그런데 같은 해 광훈님은 +29. 옆 사람은 멀쩡한데 나만 가라앉는 해였다는 뜻입니다. 그 시기에 "왜 내 힘듦을 몰라주지"라는 생각이 스쳤다면, 그건 광훈님이 무심해서가 아니라 두 분의 그래프가 반대 방향으로 움직인 해였기 때문입니다.
이 엇갈림은 우연이 아니라 구조였고, 구조에는 끝나는 날짜가 있습니다. 2028년 무신년, 두 분의 곡선은 상장 이후 처음으로 같은 방향으로 오릅니다. 그때까지의 임무는 하나 — 서로의 저점을 알고 있다는 것만으로, 두 분은 이미 대부분의 커플보다 유리합니다.`;

const FEW_SHOT_WARNING =
  "위 3개 샘플은 문체·밀도·구조(장면 특정→적중→구조 재해석→시간 특정 처방→인용 한 줄)의 기준일 뿐이다. 이름·숫자·연도는 전부 예시用 — 절대 그대로 베끼지 말고, 이번 커플에게 실제로 주입된 데이터에서 새로 도출하라. " +
  "샘플 길이(약 400~600자)를 실제 필드 길이로 착각하지 마라 — 각 필드의 정확한 글자수 범위는 아래 [출력 스키마]에 필드마다 따로 적혀 있으니 그 범위를 반드시, 정확히 지켜라(하한 미달도 상한 초과도 금지). 문단을 무한정 늘리지 말고, 스키마에 적힌 그 범위 안에서만 써라.";

// ── 뻔한 처방 금지어(검수요청 ④) ─────────────────────────
export const GENERIC_PRESCRIPTION_PHRASES = [
  "대화를 자주",
  "서로 이해",
  "이해해 주세요",
  "이해하려고 노력",
  "소통을 늘리",
  "많은 대화를",
  "노력이 필요합니다",
  "존중해 주세요",
] as const;

// ── 시간·행동 특정 처방 검출 정규식(검수요청 ③ "시간 특정 처방") ────────
const TIME_SPECIFIC_PRESCRIPTION_RE = /\d+\s*(시간|분|일)\s*(후|안에|이내|먼저|동안)/;

const COUPLE_SYSTEM_ADDENDUM = `
[few-shot — 이 문체·구조를 따르되 이름·숫자·연도는 절대 베끼지 마라]
${FEW_SHOT_SAMPLES}

⚠️ ${FEW_SHOT_WARNING}

[구조 게이트 — 리스크 공시·리스크 관리·백테스트·크라이시스 섹션에 적용]
위 few-shot처럼 다음 순서로 써라: ①장면 특정(유형 설명이 아니라 구체적 행동 장면) →
②적중("~하지 않으셨습니까"로 찌르기) → ③구조 재해석(그건 성격 결함이 아니라 명식
구조 때문이라고 재해석) → ④시간·행동 특정 처방("36시간 후", "대화 10분 먼저"처럼
숫자+시간단위+행동. "이해하세요"/"노력하세요" 같은 뻔한 말 금지) → ⑤인용 한 줄로 마무리.

[뻔한 처방 금지어 — 절대 준수]
"대화를 자주 하세요", "서로 이해하세요", "소통을 늘리세요" 같은 내용 없는 뻔한 조언을
쓰지 마라. 반드시 시간·행동이 특정된 처방으로 바꿔라(예: "화해는 36시간 후", "대화
10분 먼저").

[상품 특화 — 커플 궁합 리포트 "COUPLE MERGER RESEARCH"]
이 리포트는 두 사람(종목 A={{SELF}}, 종목 B={{PARTNER}})의 "합병 실사 보고서"다. 반드시
두 명식을 모두 근거로 인용해 서술하라 — 한쪽만 분석하면 안 된다.

[도입 훅 — execSummary 첫 문장 방향]
"명식은 상장 시점에 정해진 포트폴리오, 합병 상대는 직접 고르는 유일한 대형 딜"이라는
프레임을 execSummary 서두에 자연스럽게 녹여라(문장을 그대로 베끼지 말고 같은 취지로
새로 써라) — 이 리포트가 왜 존재하는지에 대한 답이다.

[관계 유형 태그 — execSummary 절대 준수]
아래 [관계 유형 태그] 블록에 코드가 배정한 유형명을 execSummary에 등급과 함께 반드시
표기하라. 배정되지 않은 다른 유형명을 쓰면 안 된다.

[처방 행동 성별 중성화 — riskManagementSelf/riskManagementPartner 절대 준수]
화해 처방으로 밥상·요리·커피 타주기 등 가사 노동을 특정 인물에게 배정하지 마라(성별
고정관념 리뷰 리스크). 대신 아래 중성 예시 뱅크에서 골라 쓰거나 같은 결의 행동을 새로
만들어라: 먼저 인사 건네기, 산책 제안하기, 상대가 좋아하는 것 챙겨주기, 평소 루틴 먼저
복구하기, 짧은 메시지 먼저 보내기.

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
가져온 것이어야 한다. 연도와 점수를 분리해서 쓰지 마라 — "2026~2027년(-58, -67)"
처럼 여러 해를 묶어 점수를 괄호로 나열하는 것도, "2025년, 2026년에는 격차가
벌어집니다. 을사년 -107, 병오년 -92"처럼 연도들을 먼저 나열한 뒤 점수를 나중에
몰아서 말하는 것도 금지 — 둘 다 어느 점수가 어느 해인지 모호해진다. 반드시
"2025년 을사년(-107)... 이어서 2026년 병오년(-92)..."처럼 연도 하나를 언급하면
그 즉시 그 해의 점수를 바로 붙여 한 쌍씩 완결하고 나서 다음 연도로 넘어가라.

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
- chemistryTimingPreview: 아래 [온도 타이밍] 블록에 코드가 찾아준 구간 1개만 언급(라이트).
  "20XX년" 같은 세운 연도 표기 절대 금지 — 반드시 "약 N개월 후"류 상대 시점으로만 써라.
  세운 연도·동반 상승 서사는 backtest·futureCalendar 전용이니 여기선 재사용하지 마라.

[금지 목록 — 절대 준수]
이혼·파경을 단정하는 표현("일부종사 어렵다" 류) 금지 — 위험 신호는 변동성으로만.
신살·원진을 정신질환(공황장애·빙의 등)과 연결하는 해석 절대 금지.
"남자는 신강, 여자는 신약이 좋다" 류 성별 규범 명제 금지 — 강약은 성별 무관 "에너지
균형"으로만 서술.
`;

export function buildCoupleContentPrompt(
  input: CoupleContentPromptInput,
): { system: string; user: string; typeNames: CoupleTypeNames; relationshipType: RelationshipType } {
  const { names, matrix } = input;
  const addendum = COUPLE_SYSTEM_ADDENDUM
    .replaceAll("{{SELF}}", names.selfLabel)
    .replaceAll("{{PARTNER}}", names.partnerLabel);
  const system = ANALYST_SYSTEM_PROMPT + addendum;

  const relationshipType = judgeRelationshipType(matrix);
  const healMatrix = computeCoupleHealMatrix(matrix);
  const attractionDevices = computeAttractionDevices(matrix);
  const spousePalace = computeSpousePalaceDiagnoses(matrix);

  const ohaengBlock = [
    formatOhaengDistribution(matrix.selfView, names.selfLabel),
    formatOhaengDistribution(matrix.partnerView, names.partnerLabel),
  ].join("\n");

  const typeNames = computeCoupleTypeNames(matrix.selfView, matrix.partnerView);

  const user = `[${names.selfLabel} 만세력]
${input.selfManseryeokText}

[${names.partnerLabel} 만세력]
${input.partnerManseryeokText}

[관계 매트릭스 — 이 값만 사용, 재계산·창작 금지]
${formatRelationMatrixForPrompt(matrix)}

[오행 분포 — 이 문장을 그대로 인용, 직접 계산 금지]
${ohaengBlock}

${formatCoupleTypeNamesForPrompt(typeNames, { self: names.selfLabel, partner: names.partnerLabel })}
- 밤의 페르소나 유형명은 chemistryPersona에, 예열-지속 유형명은 chemistryPaceCurve에
  반드시 등장시켜라. 회복 시계 유형명('반나절 시계'/'하루반 시계')은 riskDisclosure에
  두 사람 것을 정확한 표기 그대로 최소 1회씩 반드시 등장시켜라(풀어쓰기·바꿔쓰기 금지)
  — riskManagementSelf/riskManagementPartner에도 자연스럽게 이어 쓰면 더 좋다. 위 6개
  유형명 목록에 없는 별명을 새로 만들지 마라.

${formatRelationshipTypeForPrompt(relationshipType)}

${formatCoupleHealMatrixForPrompt(healMatrix, { self: names.selfLabel, partner: names.partnerLabel })}

${formatAttractionDevicesForPrompt(attractionDevices, { self: names.selfLabel, partner: names.partnerLabel })}

${formatSpousePalaceDiagnosesForPrompt(spousePalace, { self: names.selfLabel, partner: names.partnerLabel })}

${formatCoupleSeunSeriesForPrompt(input.seunSeries)}

${formatCoupleWolunHighlightForPrompt(input.wolunHighlight, { self: names.selfLabel, partner: names.partnerLabel })}

[출력 스키마] 아래 JSON 키로만 응답하라(코드블록 마커 없이 순수 JSON 객체 하나):
{
  "execSummary": "도입 훅 + 관계를 한 문장으로 정의 + [관계 유형 태그] 표기 + 총평 (500~700자)",
  "selfSeenByPartner": "${names.partnerLabel}이 ${names.selfLabel}을 어떻게 경험하는가 — 십성 교차 근거, 구체적 장면 2개 이상 포함해 충분히 서술 (600~800자)",
  "partnerSeenBySelf": "${names.selfLabel}이 ${names.partnerLabel}을 어떻게 경험하는가 — 십성 교차 근거, 구체적 장면 2개 이상 포함해 충분히 서술 (600~800자)",
  "attractionStructure": "왜 서로에게 끌렸는가 — 천간합·일간 상생상극 근거 + [끌림의 숨은 장치] 반영 (500~700자)",
  "synergy": "성격·소통·라이프스타일이 잘 맞는 지점 — [병-치유 매트릭스]를 중심 분석으로 (550~750자)",
  "riskDisclosure": "반복되는 다툼 패턴 — 충형파해·용신 교차 근거, 심리 저격형 문장 포함 (700~900자)",
  "riskManagementSelf": "${names.selfLabel}을 위한 화해 사용설명서 — 행동 단위 조언 (400~550자)",
  "riskManagementPartner": "${names.partnerLabel}을 위한 화해 사용설명서 — 행동 단위 조언 (400~550자)",
  "chemistryHook": "케미스트리 심리 저격 훅 (150~250자)",
  "chemistryPersona": "두 사람 각자의 낮과 밤 갭 진단 (350~500자)",
  "chemistryDesireGauge": "욕구 온도차 (200~300자)",
  "chemistryLeadStructure": "주도권 구조 (200~300자)",
  "chemistryPaceCurve": "예열-지속 곡선 (200~300자)",
  "chemistrySkinshipLanguage": "스킨십 언어 차이 (200~300자)",
  "chemistrySignalDictionary": "밤의 시그널 사전 — 오해 신호 2~3개 번역+처방 (300~450자)",
  "chemistryTimingPreview": "온도 타이밍 예고(라이트) — [온도 타이밍] 블록 구간만, 연도 언급 금지 (150~250자)",
  "financialOutlook": "공동 재무 전망 — 돈 쓰는 스타일 궁합 (450~600자)",
  "longTermFit": "장기 통합 적합성 — [배우자궁 자체 진단]을 먼저 언급한 뒤 결혼하면 어떤 부부인가, 배우자궁(일지) 교차 근거 (500~650자)",
  "backtest": "커플 백테스트 — 두 사람 대운·세운 교차로 본 과거 흐름, 적중 체감 톤(단정형) (500~650자)",
  "futureCalendar": "향후 3년 통합 캘린더 — 좋은 시기/주의 시기 (500~650자)",
  "crisisScenario": "위기 시나리오 — 헤어질 위험이 있다면 언제·왜·예방책 (450~600자)",
  "roadmap": "통합 로드맵 — 단계별 행동 아이템 (450~600자)",
  "finalOpinion": "최종 의견 — 총평, 담담한 격려로 마무리 (400~500자)"
}`;

  return { system, user, typeNames, relationshipType };
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

// 2026-07-17 채움률 실측(20페이지 PDF 렌더 검증) 하한 상향 — 특히
// selfSeenByPartner/partnerSeenBySelf(단독 필드가 페이지 하나를 통째로 차지,
// 실측 채움률 23~30%)를 크게 올리고, 나머지도 폰트·줄간격 상향(9→9.8pt,
// 1.55→1.75) 이후에도 부족한 만큼만 완만히 올렸다. 케미스트리·리스크관리는
// 별도 경량 비주얼(온도 게이지·Do/Don't 카드)로 보강하므로 그대로 둔다.
export const COUPLE_FIELD_RANGES: FieldRanges = {
  execSummary: { min: 500, max: 700 },
  selfSeenByPartner: { min: 600, max: 800 },
  partnerSeenBySelf: { min: 600, max: 800 },
  attractionStructure: { min: 500, max: 700 },
  synergy: { min: 550, max: 750 },
  riskDisclosure: { min: 700, max: 900 },
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
  financialOutlook: { min: 450, max: 600 },
  longTermFit: { min: 500, max: 650 },
  backtest: { min: 500, max: 650 },
  futureCalendar: { min: 500, max: 650 },
  crisisScenario: { min: 450, max: 600 },
  roadmap: { min: 450, max: 600 },
  finalOpinion: { min: 400, max: 500 },
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

// ── 세운 일치 게이트(수정 3, 지시문_궁합_v4검토수정_20260716.md §7-1로 재작성,
// 2026-07-17 "연도 런/점수 런 청크 위치쌍 매칭"으로 추가 보강) ─────────────
// 텍스트를 연도 토큰(YYYY년)·점수 토큰(+NN/-NN)의 순서열로 스캔한다. 연도가 N개
// 연속 등장한 뒤 점수가 등장하면, 그 점수 개수가 N의 배수(k*N)일 때 N개씩 끊어
// 같은 연도 순서에 반복 매칭한다 — "2026년과 2027년… 김경아님 -92, -43…
// 최광훈님은 +66, +71"처럼 한 명씩 두 해 점수를 따로 나열하는 문장도 정확히
// 처리한다(사람별로 같은 2개 연도가 두 번 반복되는 구조, 2026-07-17 실측). 배수가
// 아니면(구조가 애매함) 귀속을 포기한다 — 예전에는 마지막 연도로 폴백했지만
// 무리한 추정이 반복적으로 오탐을 냈다(2026-07-16/17 다수 실측) — 확실한 경우만
// 검사하는 게 안전하다.
// "을사년"/"병오년" 같은 간지 표기는 4자리 숫자가 아니라 이 스캔에서 자동으로
// 건너뛰어진다. 예전 근접 윈도우 방식이 "2029년 …+59…2027년의 긴장"에서 +59를
// 2027년 것으로 오판하던 문제는 이 순차 스캔 방식엔 없다.
// 연도/점수 토큰이 "같은 언급"에 속하는지 판단하는 최대 문자 간격. "2025년과
// 2026년이다 — 김경아님이 각각 대흉(" 처럼 연결구가 낀 경우도 하나의 런으로 봐야
// 하지만("각각 대흉(" 22자 실측), 전혀 다른 문장의 연도 언급까지 쓸어담으면 안 된다
// (예: "2028~2029년은 가속 구간이다" 언급 후 57자 뒤에 나오는 무관한 "2025년과
// 2026년" — 이 둘은 별개 런이어야 함, 2026-07-17 실측 확인).
const SEUN_TOKEN_MAX_GAP = 30;

export function checkSeunConsistency(text: string, series: CoupleSeunSeries): string[] {
  const issues: string[] = [];
  const tokenPattern = /(\d{4})년|([+-]\d{1,3})(?!\d)/g;
  type Token = { kind: "year"; year: number; idx: number } | { kind: "score"; score: number; idx: number };
  const tokens: Token[] = [];
  let m: RegExpExecArray | null;
  while ((m = tokenPattern.exec(text)) !== null) {
    if (m[1]) tokens.push({ kind: "year", year: parseInt(m[1], 10), idx: m.index });
    else tokens.push({ kind: "score", score: parseInt(m[2], 10), idx: m.index });
  }

  const checkPair = (year: number, score: number) => {
    if (!series.years.includes(year)) return;
    const idx = series.years.indexOf(year);
    const validScores = new Set([series.self[idx].score, series.partner[idx].score]);
    if (!validScores.has(score)) {
      issues.push(
        `${year}년 귀속 점수 ${score >= 0 ? "+" : ""}${score}가 코드 계산값(본인 ${series.self[idx].score}/상대 ${series.partner[idx].score})과 불일치 — 세운 점수 창작 의심`,
      );
    }
  };

  const asYear = (t: Token) => (t as { kind: "year"; year: number; idx: number }).year;
  const asScore = (t: Token) => (t as { kind: "score"; score: number; idx: number }).score;

  let i = 0;
  while (i < tokens.length) {
    if (tokens[i].kind !== "year") {
      i++;
      continue;
    }
    const yearRun: number[] = [asYear(tokens[i])];
    i++;
    while (i < tokens.length && tokens[i].kind === "year" && tokens[i].idx - tokens[i - 1].idx <= SEUN_TOKEN_MAX_GAP) {
      yearRun.push(asYear(tokens[i]));
      i++;
    }
    const scoreRun: number[] = [];
    while (i < tokens.length && tokens[i].kind === "score" && tokens[i].idx - tokens[i - 1].idx <= SEUN_TOKEN_MAX_GAP) {
      scoreRun.push(asScore(tokens[i]));
      i++;
    }
    if (scoreRun.length === 0) continue;

    if (scoreRun.length % yearRun.length === 0) {
      const chunkSize = yearRun.length;
      for (let c = 0; c * chunkSize < scoreRun.length; c++) {
        yearRun.forEach((y, k) => checkPair(y, scoreRun[c * chunkSize + k]));
      }
    }
    // 배수가 아니면 구조가 애매하므로 검사를 건너뛴다(오탐 방지 우선).
  }
  return issues;
}

// ── 호칭 일치 게이트(수정 5, 지시문_궁합_v4검토수정_20260716.md §7-2로 완화) ──
// 이름이 실제로 입력된 경우에만 검사한다 — 이름 미입력 폴백("본인"/"상대방") 자체는
// 정상 동작이라 그 상태에서는 이 표현이 나와도 위반이 아니다.
// "상대"/"본인"은 "상대의 반응", "본인이 원하는" 처럼 문장 속 지극히 정상적인
// 한국어 대명사로도 널리 쓰인다 — 등장 자체를 위반으로 보면 오탐이 압도적으로
// 많다(2026-07-16 v4 검토 실측: 실제 이름 153회 vs 일반 지칭 12회인데도 위반
// 보고됨). 그래서 "이름을 실제로 안 쓰고 본인/상대방으로 때웠는가"라는 원래 취지에
// 맞게, 일반 지칭 횟수가 실제 이름 호칭 횟수보다 많을 때만(=이름 회피로 볼 근거가
// 있을 때만) 위반으로 본다. "OO님 본인은"처럼 이름 뒤에 재귀적으로 붙는 경우는
// 애초에 집계에서 제외한다.
export function checkNameUsage(text: string, names: CoupleNames): string[] {
  const usingFallback = names.selfLabel === "본인" && names.partnerLabel === "상대방";
  if (usingFallback) return [];
  const countOf = (needle: string) => text.split(needle).length - 1;
  const nameCount = countOf(names.selfLabel) + countOf(names.partnerLabel);
  const stripped = text.replace(/님\s?(본인|상대)/g, "님");
  const genericCount = (stripped.match(/상대방|상대는|상대가|상대를|본인은|본인이|본인을/g) ?? []).length;
  if (nameCount === 0) {
    return [`실제 이름("OO님")이 본문에 전혀 등장하지 않음 — 이름 대신 본인/상대방으로만 지칭한 것으로 의심`];
  }
  if (genericCount > nameCount) {
    return [
      `"본인/상대방" 류 일반 지칭(${genericCount}회)이 실제 이름 호칭(${nameCount}회)보다 많음 — 이름을 더 적극적으로 사용해야 함`,
    ];
  }
  return [];
}

// ── few-shot 복사 방지 게이트(검수요청 — 오늘의 운세와 동일 30자 방식) ──────
function findCopiedSubstring(generated: string, reference: string, minLen = 30): string | null {
  if (generated.length < minLen) return null;
  for (let i = 0; i <= generated.length - minLen; i++) {
    const chunk = generated.slice(i, i + minLen);
    if (reference.includes(chunk)) return chunk;
  }
  return null;
}

export function checkFewShotCopy(proseText: string): string[] {
  const copied = findCopiedSubstring(proseText, FEW_SHOT_SAMPLES);
  if (!copied) return [];
  return [`few-shot 샘플과 30자 이상 그대로 겹친다("${copied}") — 문체·구조만 참고하고 내용은 이 커플 고유로 새로 써라`];
}

// ── 뻔한 처방 금지어 게이트(검수요청 ④) ────────────────────
export function checkGenericPrescriptionPhrases(proseText: string): string[] {
  const issues: string[] = [];
  for (const phrase of GENERIC_PRESCRIPTION_PHRASES) {
    if (proseText.includes(phrase)) {
      issues.push(`뻔한 처방 문구 "${phrase}" 등장 — 시간·행동이 특정된 처방으로 바꿔라(예: "화해는 36시간 후")`);
    }
  }
  return issues;
}

// ── 시간 특정 처방 게이트(검수요청 ③ "시간 특정 처방") ──────────
// 화해 매뉴얼 2개 필드 중 최소 1곳엔 "N시간/분/일 후·안에·먼저" 패턴이 있어야 한다.
export function checkTimeSpecificPrescription(sections: CoupleSections): string[] {
  const combined = `${sections.riskManagementSelf}\n${sections.riskManagementPartner}`;
  if (!TIME_SPECIFIC_PRESCRIPTION_RE.test(combined)) {
    return [
      `riskManagementSelf/riskManagementPartner 어디에도 시간 특정 처방("36시간 후" 류)이 없다 — 최소 1곳에 숫자+시간단위+행동 처방을 넣어라`,
    ];
  }
  return [];
}

// ── 유형명 오배정 게이트(검수요청 ②) ────────────────────────
// LLM은 코드가 배정한 유형명만 써야 한다 — 배정 안 된 다른 유형명이 같은 축 필드에
// 등장하면 임의로 다른 유형을 지어낸 것으로 본다.
export function checkTypeNameUsage(sections: CoupleSections, typeNames: CoupleTypeNames): string[] {
  const issues: string[] = [];
  const checkAxis = (
    fieldText: string,
    fieldName: string,
    allNames: readonly string[],
    assigned: readonly string[],
  ) => {
    for (const name of allNames) {
      if (assigned.includes(name)) continue;
      if (fieldText.includes(name)) {
        issues.push(`${fieldName}에 배정되지 않은 유형명 "${name}" 등장 — 코드가 배정한 유형명만 사용해야 함`);
      }
    }
    for (const name of assigned) {
      if (!fieldText.includes(name)) {
        issues.push(`${fieldName}에 배정된 유형명 "${name}"이 등장하지 않음 — 반드시 포함해야 함`);
      }
    }
  };
  checkAxis(sections.chemistryPersona, "chemistryPersona", PERSONA_TYPES, [
    typeNames.self.persona,
    typeNames.partner.persona,
  ]);
  checkAxis(sections.chemistryPaceCurve, "chemistryPaceCurve", PACE_TYPES, [
    typeNames.self.pace,
    typeNames.partner.pace,
  ]);
  const clockText = `${sections.riskDisclosure}\n${sections.riskManagementSelf}\n${sections.riskManagementPartner}`;
  checkAxis(clockText, "riskDisclosure/riskManagementSelf/riskManagementPartner", CLOCK_TYPES, [
    typeNames.self.clock,
    typeNames.partner.clock,
  ]);
  return issues;
}

// ── 관계 유형 태그 오배정 게이트(§9-4) ──────────────────────
export function checkRelationshipTypeUsage(execSummary: string, relationshipType: RelationshipType): string[] {
  const issues: string[] = [];
  for (const t of RELATIONSHIP_TYPES) {
    if (t === relationshipType) continue;
    if (execSummary.includes(t)) {
      issues.push(`execSummary에 배정되지 않은 관계 유형 태그 "${t}" 등장 — 코드가 배정한 유형명만 사용해야 함`);
    }
  }
  if (!execSummary.includes(relationshipType)) {
    issues.push(`execSummary에 배정된 관계 유형 태그 "${relationshipType}"이 등장하지 않음 — 반드시 포함해야 함`);
  }
  return issues;
}

// ── 온도 타이밍 세운연도 금지 게이트(지시문_궁합_v4검토수정_20260716.md §2) ────
export function checkTimingPreviewNoSeunYear(chemistryTimingPreview: string): string[] {
  if (/\d{4}년/.test(chemistryTimingPreview)) {
    return [`chemistryTimingPreview에 세운 연도("20XX년") 표기 등장 — 월운 기반 상대 시점("약 N개월 후")으로만 써야 함`];
  }
  return [];
}

// ── 처방 행동 성별 중성화 게이트(지시문_궁합_v4검토수정_20260716.md §5) ────────
const GENDERED_CHORE_PHRASES = ["밥상", "커피를 타", "요리해", "설거지", "빨래", "청소해"] as const;
export function checkGenderNeutralPrescription(sections: CoupleSections): string[] {
  const combined = `${sections.riskManagementSelf}\n${sections.riskManagementPartner}`;
  const issues: string[] = [];
  for (const phrase of GENDERED_CHORE_PHRASES) {
    if (combined.includes(phrase)) {
      issues.push(`riskManagementSelf/riskManagementPartner에 가사 행동 처방 "${phrase}" 등장 — 특정 인물에게 가사 노동을 배정하지 말고 중성 예시 뱅크로 바꿔라`);
    }
  }
  return issues;
}

export function validateCoupleSections(
  sections: CoupleSections,
  matrix: CoupleRelationMatrix,
  seunSeries: CoupleSeunSeries,
  names: CoupleNames,
  typeNames: CoupleTypeNames,
  relationshipType: RelationshipType,
  wolunHighlight: CoupleWolunHighlight,
): string[] {
  const proseText = SECTION_KEYS.map((k) => sections[k]).join("\n");
  const issues: string[] = [
    ...checkTermRules(proseText),
    ...checkMinLengths(sections, COUPLE_FIELD_RANGES),
    ...checkSeunConsistency(proseText, seunSeries),
    ...checkNameUsage(proseText, names),
    ...checkFewShotCopy(proseText),
    ...checkGenericPrescriptionPhrases(proseText),
    ...checkTimeSpecificPrescription(sections),
    ...checkTypeNameUsage(sections, typeNames),
    ...checkRelationshipTypeUsage(sections.execSummary, relationshipType),
    ...checkTimingPreviewNoSeunYear(sections.chemistryTimingPreview),
    ...checkGenderNeutralPrescription(sections),
    ...checkTimingPreviewHasMonthCount(sections.chemistryTimingPreview, wolunHighlight),
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
