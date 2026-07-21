// =====================================================
// src/lib/saju/today-fortune-prompt.ts
// =====================================================
// today-fortune 전용 프롬프트 — 해설가이드.md 5장(2026-07-14 2차 갱신) 사양:
// "퍼널 입구 상품 — 880원 과잉전달". 1,100~1,400자 / 7블록. 시진·일진·톤·
// 골든타임·CTA 템플릿은 전부 코드가 계산해 데이터로 주입한다 — LLM은 재계산
// 금지, 해설만 한다("계산은 코드가, 해석만 AI가" 원칙).
//
// CTA는 자유 작성이 아니라 cta-templates.ts 의 고정 뱅크에서 코드가 조립한다
// (R2만 LLM이 짧은 연결문장 1개를 쓴다) — "템플릿 외 문장 추가"가 스키마상
// 애초에 불가능하도록 설계했다.

import type { Myeongsik } from "./manseryeok";
import { SYSTEM_BASE } from "./prompt";
import { generateInterpretation } from "./llm";
import { extractJsonObject } from "../report/prompts/extract-json";
import { checkMinLengths, FORBIDDEN_TERMS, TRANSLATE_FIRST_TERMS, type FieldRanges } from "../report/prompts/term-guard";
import type { SijinEntry } from "./sijin";
import type { DayGanji, DayTone, DayToneRelation, GoldenSijinResult } from "./today-ganji";
import { CTA_TEMPLATES, assembleCta, type CtaTemplateId } from "./cta-templates";
import { formatElementMetaphorForPrompt, type ElementMetaphor } from "./element-metaphor";

export type TodayFortuneSections = {
  dayTone: DayTone;
  headline: string;
  psychSnipe: string;
  weatherReason: string;
  flow: { morning: string; afternoon: string; evening: string };
  goldenTimeLabel: string;
  point: { take: string; avoid: string };
  check: string;
  todaySummarySentence?: string;
  tomorrow: string;
};

export type TodayFortuneResult = TodayFortuneSections & {
  teaserCta: { teaser: string; ctaLabel: string };
};

// "paid" = 유료 ₩880 오늘의 운세(기존 동작, 기본값). "free" = 무료 운세 미리보기 —
// 초3 언어 + 본문 전체 용어 0개 + 오행 비유 요구사항이 추가로 적용된다
// (지시문_무료운세_톤수정_20260721.md §3-2). paid 호출부는 variant를 생략하면
// 기존과 완전히 동일하게 동작한다.
export type TodayFortuneVariant = "paid" | "free";

const DAY_TONE_VALUES: readonly DayTone[] = ["good", "mixed", "caution"];

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function parseTodayFortuneSections(obj: unknown): TodayFortuneSections | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;

  if (!DAY_TONE_VALUES.includes(o.dayTone as DayTone)) return null;
  if (!isNonEmptyString(o.headline)) return null;
  if (!isNonEmptyString(o.psychSnipe)) return null;
  if (!isNonEmptyString(o.weatherReason)) return null;
  const flow = o.flow as Record<string, unknown> | undefined;
  if (!flow || !isNonEmptyString(flow.morning) || !isNonEmptyString(flow.afternoon) || !isNonEmptyString(flow.evening)) {
    return null;
  }
  if (!isNonEmptyString(o.goldenTimeLabel)) return null;
  const point = o.point as Record<string, unknown> | undefined;
  if (!point || !isNonEmptyString(point.take) || !isNonEmptyString(point.avoid)) return null;
  if (!isNonEmptyString(o.check)) return null;
  if (o.todaySummarySentence !== undefined && typeof o.todaySummarySentence !== "string") return null;
  if (!isNonEmptyString(o.tomorrow)) return null;

  return {
    dayTone: o.dayTone as DayTone,
    headline: o.headline as string,
    psychSnipe: o.psychSnipe as string,
    weatherReason: o.weatherReason as string,
    flow: { morning: flow.morning as string, afternoon: flow.afternoon as string, evening: flow.evening as string },
    goldenTimeLabel: o.goldenTimeLabel as string,
    point: { take: point.take as string, avoid: point.avoid as string },
    check: o.check as string,
    todaySummarySentence: o.todaySummarySentence as string | undefined,
    tomorrow: o.tomorrow as string,
  };
}

// ── "명리 용어 0개" 게이트 — term-guard.ts 목록 재사용 ──
// report의 "티어 허용치"(최대 3회 허용) 방식과 달리 today-fortune은 한 개도
// 허용하지 않는다(해설가이드: "명리 용어 0개, 생활 장면 언어"). 단발 한글자 급
// 표현(충/합 등)은 일상어와 충돌 위험이 커서 제외하고, 식별력 있는 다자 용어만
// 검사한다. 유료는 headline에만, 무료(free variant)는 본문 전체에 적용한다.
const BASE_JARGON_TERMS = [
  "사주", "명식", "일간", "오행", "대운", "세운", "월운", "십성",
  "합충", "신강", "신약", "용신", "희신", "기신", "격국", "공망", "지장간",
  // 12시진 명칭 — free variant 실측(2026-07-21)에서 "사시(오전 9시 30분~...)"처럼
  // 시진 이름을 그대로 인용하는 사례가 나와 추가. 시진 자체가 명리 전문용어다.
  "자시", "축시", "인시", "묘시", "진시", "사시", "오시", "미시", "신시", "유시", "술시", "해시",
];
const HEADLINE_JARGON_TERMS = Array.from(new Set([...FORBIDDEN_TERMS, ...TRANSLATE_FIRST_TERMS, ...BASE_JARGON_TERMS]));

function findJargon(text: string): string[] {
  return HEADLINE_JARGON_TERMS.filter((t) => text.includes(t));
}

const CTA_TRIGGER_RE = /보러\s*가기|확인하기|지금\s*확인|자세히\s*보기|알아보기/;

// ── psychSnipe 게이트 2종 ──
// ① few-shot 원문 복사 방지: 30자 이상 연속 부분 문자열이 few-shot 심리 저격
//   원문에 그대로 있으면 위반(짧은 슬라이딩 윈도우 — 문장 길이가 짧아 비용 무시 가능).
const FEW_SHOT_PSYCH_SNIPE_REFERENCE =
  "안녕, 두리예요. 시작하기 전에 하나만 물을게요 — 그대, 부탁을 받으면 거절보다 \"내가 하고 말지\"가 먼저 나오는 편이죠. 일도 사람도 혼자 다 감당하는 쪽이고요. 명식에 그대 편을 들어줄 동료 별이 하나도 없이, 해야 할 일과 챙겨야 할 결과의 별만 가득해서 그래요. 오늘은 그 버릇이 유독 세게 나오는 날입니다.";

function findCopiedSubstring(generated: string, reference: string, minLen = 30): string | null {
  if (generated.length < minLen) return null;
  for (let i = 0; i <= generated.length - minLen; i++) {
    const chunk = generated.slice(i, i + minLen);
    if (reference.includes(chunk)) return chunk;
  }
  return null;
}

// ② 현재형 습관 진단 트리거 — 하나도 없으면 "미래형만 있고 현재형 진단 없음" 위반.
const PRESENT_TENSE_TRAIT_RE = /편이죠|편이에요|경향이 있어요|스타일이에요|타입이에요|그런 사람이에요|잘\s*하죠|많이\s*하죠/;

const PART_RANGES: FieldRanges = {
  headline: { min: 40, max: 70 },
  psychSnipe: { min: 90, max: 260 },
  weatherReason: { min: 80, max: 140 },
  flowMorning: { min: 90, max: 180 },
  flowAfternoon: { min: 90, max: 180 },
  flowEvening: { min: 90, max: 180 },
  pointTake: { min: 150, max: 320 },
  pointAvoid: { min: 150, max: 320 },
  check: { min: 30, max: 70 },
  tomorrow: { min: 60, max: 120 },
};

// free variant 전용 — 초3 언어(짧은 문장, 한자·용어 0개)는 유료의 용어 밀집
// 문장보다 자연스럽게 글자 수가 적게 나온다. 실측(2026-07-21, 레퍼런스 명식
// 음력 1971-04-25 10:30 여성)에서 유료 기준 하한으로 5회 연속 재시도가
// 소진돼 확인됨 — 하한만 완화, 상한은 유지.
const FREE_PART_RANGES: FieldRanges = {
  headline: { min: 30, max: 70 },
  psychSnipe: { min: 75, max: 260 },
  weatherReason: { min: 60, max: 140 },
  flowMorning: { min: 70, max: 180 },
  flowAfternoon: { min: 70, max: 180 },
  flowEvening: { min: 70, max: 180 },
  pointTake: { min: 120, max: 320 },
  pointAvoid: { min: 120, max: 320 },
  check: { min: 25, max: 70 },
  tomorrow: { min: 45, max: 120 },
};

export function validateTodayFortune(
  s: TodayFortuneSections,
  expectedTone: DayTone,
  ctaTemplateId: CtaTemplateId,
  expectedGoldenTimeLabel: string,
  opts?: { variant?: TodayFortuneVariant; elementMetaphor?: ElementMetaphor },
): string[] {
  const issues: string[] = [];
  const isFree = opts?.variant === "free";

  if (s.dayTone !== expectedTone) {
    issues.push(`dayTone이 "${s.dayTone}"인데 코드가 계산한 판정은 "${expectedTone}"이다 — dayTone 필드를 "${expectedTone}"로 정확히 맞추고, 본문 톤 전체를 이 판정에 맞게 다시 써라`);
  }

  const jargonHits = findJargon(s.headline);
  if (jargonHits.length > 0) {
    issues.push(`headline에 명리 용어가 등장했다(${jargonHits.join(",")}) — 헤드라인은 명리 용어 0개, 생활 장면 언어로만 써라`);
  }

  const psychSnipeReference = isFree ? FREE_FEW_SHOT_PSYCH_SNIPE_REFERENCE : FEW_SHOT_PSYCH_SNIPE_REFERENCE;
  const copied = findCopiedSubstring(s.psychSnipe, psychSnipeReference);
  if (copied) {
    issues.push(`psychSnipe가 few-shot 예시와 30자 이상 그대로 겹친다("${copied}") — few-shot은 문체·구조 참고용일 뿐, 이 명식 고유의 성격 진단을 새로 도출해라(베끼지 마라)`);
  }
  if (!PRESENT_TENSE_TRAIT_RE.test(s.psychSnipe)) {
    issues.push(`psychSnipe에 현재형 습관 진단("~하는 편이죠" 류)이 없다 — 미래 예측이 아니라 원래 그런 사람이라는 현재형 문장을 반드시 포함해라`);
  }

  if (!s.goldenTimeLabel.includes(expectedGoldenTimeLabel)) {
    issues.push(`goldenTimeLabel이 코드가 계산한 골든타임("${expectedGoldenTimeLabel}")을 그대로 인용하지 않았다 — 이 문구를 그대로 포함시켜라`);
  }

  const needsSummary = CTA_TEMPLATES[ctaTemplateId].needsSummary;
  if (needsSummary) {
    if (!isNonEmptyString(s.todaySummarySentence)) {
      issues.push(`todaySummarySentence가 비어 있다 — 오늘의 핵심 문장을 1문장(60자 이내)으로 요약해서 채워라`);
    } else {
      if (s.todaySummarySentence.length > 60) {
        issues.push(`todaySummarySentence가 ${s.todaySummarySentence.length}자로 60자를 넘는다 — 짧은 한 문장으로 줄여라`);
      }
      if (CTA_TRIGGER_RE.test(s.todaySummarySentence)) {
        issues.push(`todaySummarySentence에 CTA성 문구가 들어갔다 — 오늘 상황을 요약하는 문장만 쓰고 CTA는 넣지 마라`);
      }
    }
  }

  if (isFree) {
    const fullBody = [
      s.headline, s.psychSnipe, s.weatherReason,
      s.flow.morning, s.flow.afternoon, s.flow.evening,
      s.point.take, s.point.avoid, s.check, s.tomorrow,
    ].join(" ");

    const bodyJargonHits = findJargon(fullBody);
    if (bodyJargonHits.length > 0) {
      issues.push(`본문(headline 제외 포함 전체)에 명리 용어가 등장했다(${bodyJargonHits.join(",")}) — 무료 운세는 명리 용어·한자·괄호 병기를 단 하나도 쓰면 안 된다. 초등학교 3학년도 이해할 수 있는 순수 생활 언어로 다시 써라`);
    }

    if (opts?.elementMetaphor && !s.weatherReason.includes(opts.elementMetaphor.metaphorNoun)) {
      issues.push(`weatherReason에 오늘의 비유 명사("${opts.elementMetaphor.metaphorNoun}")가 포함돼 있지 않다 — 아래 [오행 비유] 블록의 문장을 그대로 또는 근접하게 인용해라`);
    }

    // "오늘/지금/이번" 시간어 최소 횟수 — 사장님 지시: 임계값을 추측하지 않고
    // 우선 로그만 남긴다(실측 데이터 없이 하드 게이트로 승격하면 과탐 위험).
    const timeAnchorCount = (fullBody.match(/오늘|지금|이번/g) ?? []).length;
    console.warn(`[today-fortune free-variant] 시간어("오늘/지금/이번") 등장 ${timeAnchorCount}회 — 임계값 미정, 로그만`);
  }

  const lengthIssues = checkMinLengths(
    {
      headline: s.headline,
      psychSnipe: s.psychSnipe,
      weatherReason: s.weatherReason,
      flowMorning: s.flow.morning,
      flowAfternoon: s.flow.afternoon,
      flowEvening: s.flow.evening,
      pointTake: s.point.take,
      pointAvoid: s.point.avoid,
      check: s.check,
      tomorrow: s.tomorrow,
    },
    isFree ? FREE_PART_RANGES : PART_RANGES,
  );
  issues.push(...lengthIssues);

  const totalChars = [
    s.headline, s.psychSnipe, s.weatherReason, s.flow.morning, s.flow.afternoon, s.flow.evening,
    s.point.take, s.point.avoid, s.check, s.todaySummarySentence ?? "", s.tomorrow,
  ].join("").length;
  const [totalMin, totalMax] = isFree ? [800, 1550] : [1000, 1550];
  if (totalChars < totalMin || totalChars > totalMax) {
    issues.push(`전체 분량 ${totalChars}자 (허용 ${totalMin.toLocaleString()}~${totalMax.toLocaleString()}자) — 범위에 맞게 다시 작성하라`);
  }

  return issues;
}

function formatSijinTable(sijinTable: SijinEntry[]): string {
  return sijinTable.map((s) => `${s.label}: ${s.cheongan}${s.jiji}`).join(", ");
}

function formatRelations(relations: DayToneRelation[]): string {
  if (relations.length === 0) return "원국과 직접적인 합충파형 관계 없음";
  return relations.map((r) => r.detail).join(", ");
}

const TONE_LABEL: Record<DayTone, string> = { good: "좋은 날", mixed: "혼조세", caution: "주의가 필요한 날" };
const FRAME_TEXT: Record<DayTone, string> = {
  good: `본문 전체를 "이 흐름을 길게 타면 좋다"는 낙관적 톤으로 쓴다.`,
  caution: `본문 전체를 "이 구간을 조심해서 지나가야 한다"는 경계 톤으로 쓴다.`,
  mixed: `본문 전체를 "무엇을 취하고 무엇을 피할지" 유불리를 나누는 톤으로 쓴다 — 좋은 관계와
주의할 관계가 동시에 있는 혼조세임을 균형 있게 담아라.`,
};

// 검수 완료본(사장님 확정, 2026-07-14) — 임의 수정 금지.
const FEW_SHOT_EXAMPLE: string | null = `헤드라인: "오늘, 남 챙기다 내 몫 놓치기 쉬운 날이에요."

심리 저격: 안녕, 두리예요. 시작하기 전에 하나만 물을게요 — 그대, 부탁을 받으면 거절보다 "내가 하고 말지"가 먼저 나오는 편이죠. 일도 사람도 혼자 다 감당하는 쪽이고요. 명식에 그대 편을 들어줄 동료 별이 하나도 없이, 해야 할 일과 챙겨야 할 결과의 별만 가득해서 그래요. 오늘은 그 버릇이 유독 세게 나오는 날입니다.

오늘의 날씨: ⛅ 구름 — 오늘의 기운(기축)이 그대의 중심과는 손을 잡는데, 발밑과는 부딪혀요. 위는 화해, 아래는 균열. 겉으로는 순조롭게 흘러가는데 디테일에서 금이 가는 날이라는 뜻이에요.

오늘의 흐름 — 오전(9~11시): 말이 잘 통하는 시간. 대신 부탁과 제안도 이 시간에 들어와요. 듣는 건 오전에, 수락은 오후에 하세요. / 골든타임 오후 5~7시: 미뤄둔 정산, 문서 확인, 돈 이야기는 여기로 몰아넣으세요. 오늘 중 가장 단단한 두 시간이에요. / 밤: 마음이 풀어지면서 말도 풀어져요. 편한 자리일수록 한 마디를 아끼세요.

오늘의 포인트 — 💰 오늘 "내가 살게", "내가 할게"가 입에서 몇 번 나오는지 세어보세요. 세 번을 넘으면 그게 오늘의 누수입니다. 10만원 넘는 결제·보증·빌려주기는 내일로. / 💬 서운한 일이 생겨도 오늘은 문자로 길게 쓰지 마세요. 오늘의 균열 기운은 문장을 실제 마음보다 차갑게 만들어요. 내일 얼굴 보고 말하면 절반은 오해였다는 걸 알게 됩니다.

체감 체크: 오늘 밤, 딱 두 가지만 되짚어 보세요 — "내가 할게"가 몇 번이었는지, 그리고 5~7시에 무슨 일이 있었는지.

CTA(L2 템플릿): 오늘은 하루의 날씨만 봤어요. 날씨 말고 기후가 궁금하지 않으세요? 그대가 어떤 사람 앞에서 흔들리고, 어떤 사람 옆에서 단단해지는지는 명식 전체를 펼쳐야 보여요. [내 마음의 기후 보기]

내일 예고+마무리: 내일(경인)은 반대로 일이 그대를 시험하는 날이에요. 오늘 아껴둔 힘이 내일 쓰입니다. 그대의 별이 오늘도 잘 빛나길, 두리가 지켜볼게요. 🐾`;

// few-shot 뒤에 반드시 붙이는 복사 방지 경고 문구(사용자 지정 원문).
const FEW_SHOT_WARNING =
  "위 샘플은 문체·밀도·구조의 기준일 뿐이다. 간지(기축·경인), 성격 진단(혼자 감당하는 유형), 행동 팁(내가 할게 카운트)은 이 명식 전용 — 절대 복사하지 말고, 입력된 명식과 오늘 일진에서 새로 도출하라.";

// ── 무료 운세 전용 few-shot ──────────────────────────────────────────
// 검수 대기 — 사장님 확인 전. 위 유료 FEW_SHOT_EXAMPLE은 "명식"이라는 명리
// 용어를 포함해 무료 운세의 본문 전체 용어 0개 게이트를 통과하지 못한다
// (지시문_무료운세_톤수정_20260721.md §3-2-E, 실측 확인됨) — 그래서 임의로
// 유료 예시를 재사용하지 않고 이 신규 예시를 초안으로 만들었다. 배포 전
// 사장님 검수 필요.
const FREE_FEW_SHOT_EXAMPLE = `헤드라인: "오늘은 시작한 일이 쑥쑥 자라나는 날이에요."

심리 저격: 안녕, 두리예요. 그대는 새로운 걸 시작할 때 남들보다 겁이 없는 편이죠. 오늘은 그 씩씩한 마음이 유독 크게 도움이 되는 날이에요.

오늘의 날씨: 오늘은 물이 많은 날이라, 그대라는 나무가 물을 잔뜩 머금고 쑥쑥 자랄 수 있어요. 다만 해가 약하니 중요한 결정은 해가 잘 드는 낮에 하는 게 좋아요.

오늘의 흐름 — 오전: 아침엔 머리가 맑아서 새로운 생각이 잘 떠올라요. 오늘 시작하고 싶은 일이 있다면 아침에 첫 걸음을 떼어보세요. / 오후: 낮 1~3시는 해가 잘 들어서 중요한 결정을 하기에 딱 좋아요. 미뤄뒀던 약속이나 결정은 이 시간에 하세요. / 저녁: 저녁엔 몸이 좀 피곤할 수 있어요. 무리한 약속보다는 편하게 쉬는 시간을 가져보세요.

오늘의 포인트 — 취할 것: 오늘은 새로 배우고 싶었던 것에 도전해보세요. 물어보고 싶었던 질문이 있다면 오늘 용기 내서 물어보세요. 작은 화분에 물을 주듯, 오늘 시작한 일에 조금씩 신경 써주면 잘 자랄 거예요. / 피할 것: 오늘은 너무 급하게 큰 결정을 내리지 마세요. 해가 약한 아침이나 저녁보다는 낮에 결정하는 게 좋아요. 몸이 피곤한데 무리해서 약속을 여러 개 잡지는 마세요.

체감 체크: 오늘 저녁, 새로 시작한 일이 몇 개였는지 세어보세요.

내일 예고+마무리: 내일은 오늘보다 차분한 하루가 될 거예요. 오늘 쑥쑥 자란 걸 내일은 잘 정리해보세요. 그대의 하루를 두리가 오늘도 응원할게요. 🐾`;

const FREE_FEW_SHOT_WARNING =
  "위 샘플은 문체·밀도·구조의 기준일 뿐이다. 비유(나무·물)와 시간대(오전/오후/저녁 내용)는 이 예시 전용 — 절대 복사하지 말고, 아래 [오행 비유] 블록과 입력된 명식·오늘 일진에서 새로 도출하라. 이 예시에는 명리 용어가 단 하나도 없다 — 실제 출력도 반드시 그래야 한다.";

const FREE_FEW_SHOT_PSYCH_SNIPE_REFERENCE =
  "안녕, 두리예요. 그대는 새로운 걸 시작할 때 남들보다 겁이 없는 편이죠. 오늘은 그 씩씩한 마음이 유독 크게 도움이 되는 날이에요.";

type SharedPromptInput = {
  myeongsik: Myeongsik;
  manseryeokText?: string;
  birthDate: string;
  gender: "male" | "female";
  todayGanji: DayGanji;
  tomorrowGanji: DayGanji;
  sijinTable: SijinEntry[];
  dayTone: DayTone;
  relations: DayToneRelation[];
  ohengNote: string;
  goldenSijin: GoldenSijinResult;
  ctaTemplateId: CtaTemplateId;
};
type PaidPromptInput = SharedPromptInput & { variant?: "paid" };
type FreePromptInput = SharedPromptInput & { variant: "free"; elementMetaphor: ElementMetaphor };
export type TodayFortunePromptInput = PaidPromptInput | FreePromptInput;

export function buildTodayFortunePrompt(input: TodayFortunePromptInput): { system: string; user: string } {
  const isFree = input.variant === "free";
  const pillar = (p: { cheongan: string; jiji: string } | null) => (p ? `${p.cheongan}${p.jiji}` : "(시 미상)");
  const sajuSection = input.manseryeokText
    ? `[사주 풀 명식]\n${input.manseryeokText}`
    : [
        `[사주 4기둥]`,
        `- 년주: ${pillar(input.myeongsik.year)}`,
        `- 월주: ${pillar(input.myeongsik.month)}`,
        `- 일주: ${pillar(input.myeongsik.day)}`,
        `- 시주: ${pillar(input.myeongsik.hour)}`,
      ].join("\n");

  const needsSummary = CTA_TEMPLATES[input.ctaTemplateId].needsSummary;
  const ctaFieldInstruction = needsSummary
    ? `- todaySummarySentence: 오늘의 핵심(headline 취지)을 1문장, 60자 이내로 요약. CTA 문구·버튼
  안내는 절대 넣지 마라 — 이 문장은 코드가 CTA 템플릿의 "{summary}" 자리에 그대로 꽂는다.`
    : `- todaySummarySentence: 이번 판정에서는 사용하지 않는다. 필드 자체를 생략해도 된다.`;

  const fewShotBlock = isFree
    ? `\n[모범 출력 예시 — 이 밀도와 구조를 그대로 따라라]\n${FREE_FEW_SHOT_EXAMPLE}\n\n⚠️ ${FREE_FEW_SHOT_WARNING}\n`
    : FEW_SHOT_EXAMPLE
      ? `\n[모범 출력 예시 — 이 밀도와 구조를 그대로 따라라]\n${FEW_SHOT_EXAMPLE}\n\n⚠️ ${FEW_SHOT_WARNING}\n`
      : "";

  const elementMetaphorBlock = isFree
    ? `\n[오행 비유 — 코드가 계산한 확정값. weatherReason에 이 비유 명사와 문장을 그대로 또는 근접하게 반영하라]\n${formatElementMetaphorForPrompt(input.elementMetaphor)}\n`
    : "";

  const freeLanguageBlock = isFree
    ? `\n[무료 운세 전용 — 언어 난이도 규칙. 반드시 지켜라]
초등학교 3학년도 읽고 이해할 수 있는 말로만 쓴다.
- 명리 용어·한자·괄호 병기를 headline뿐 아니라 본문 전체(psychSnipe/weatherReason/flow/point/check/tomorrow 포함)에서 단 하나도 쓰지 마라(사주/명식/일간/오행/대운/세운/합충/신강신약/격국/용신/희신/기신 등 전부 금지, 위 [오행 비유] 블록의 비유 표현으로만 오행을 설명하라).
- 원국 성격 이야기는 psychSnipe 1~2문장으로만 제한한다 — 격국·신살·평생 흐름을 풀어서 서술하지 마라. 나머지 블록은 전부 "오늘 하루"의 이야기만 한다.
- 한 문장에 한 가지 이야기만 담는다. 문장은 짧게 끊어 써라.
`
    : "";

  const user = `[현재 시점]
오늘은 ${input.birthDate} 기준이 아니라 구매 시점(오늘)이다.

${sajuSection}

[오늘 일진] ${input.todayGanji.cheongan}${input.todayGanji.jiji}
[내일 일진] ${input.tomorrowGanji.cheongan}${input.tomorrowGanji.jiji}
[오늘 12시진 — 코드가 계산한 확정값. 절대 재계산하지 말고 그대로 인용하라]
${formatSijinTable(input.sijinTable)}

[오늘 일진과 원국의 관계 — 코드가 계산한 확정값]
${formatRelations(input.relations)}
${input.ohengNote}

[톤 판정 — 코드가 이미 결정했다. 재판정 금지]
dayTone: "${input.dayTone}" (${TONE_LABEL[input.dayTone]})
${FRAME_TEXT[input.dayTone]}

[골든타임 — 코드가 계산한 확정값. 그대로 인용하라]
${input.goldenSijin.entry.label}(${input.goldenSijin.entry.cheongan}${input.goldenSijin.entry.jiji}) = ${input.goldenSijin.timeRangeLabel}
④ flow 서술 안에 "${input.goldenSijin.timeRangeLabel}" 문구를 반드시 포함해 골든타임을 특정하라.
${elementMetaphorBlock}${fewShotBlock}${freeLanguageBlock}
[이번 상품 — 오늘의 운세, 퍼널 입구 상품. "880원인데 이렇게까지?" 를 목표로 과잉전달한다]
총 1,100~1,400자, 아래 필드를 채운 JSON으로 작성한다.

[밀도 규칙 — 전 블록 공통, 반드시 지켜라]
모든 블록은 명식 근거(간지·십신·합충) 1개 + 생활 장면(회의·결제·연락·약속 등) 1개를 반드시
포함한다. 근거 없는 덕담 문장("좋은 하루 되세요" 류) 금지 — 왜 그런지(근거) + 어디서
드러나는지(생활 장면)가 항상 붙어야 한다.

- dayTone: 위에서 코드가 준 값("${input.dayTone}")을 그대로 복사한다.
- headline: ① 오늘의 뾰족한 예측 1문장. **첫 문장이 훅, 인사말은 그 다음**(headline 자체엔
  인사 넣지 마라). ⚠️ 명리 용어를 단 하나도 쓰지 마라(사주/명식/일간/오행/대운/합충/신강신약
  등 전부 금지) — "오늘은 회의에서 그대 말이 평소보다 힘을 받는 날이에요" 처럼 순수 생활
  장면 언어로만. 바넘 문장 금지 — 위 [오늘 일진과 원국의 관계]를 근거로 삼되 용어 없이 풀어써라.
- psychSnipe: ② 심리 저격. 인사("안녕, 두리예요")로 시작해 이 사람의 원국 실제 구조(십성
  분포·합충)에서 도출한 현재형 성격 진단 1~2문장("~하는 편이죠/~인 편이에요" 식 — 미래 예측이
  아니라 원래 그런 사람이라는 "아하 포인트"). 마지막 문장은 반드시 "오늘은 그 버릇이 유독
  ~한 날" 형태로 오늘과 연결해라. [모범 출력 예시]가 있다면 문체·구조만 참고하고 절대 베끼지 마라
  — 이 사람의 실제 명식 데이터에서 새로 도출한 진단이어야 한다.${isFree ? " 원국 성격 이야기는 이 블록 1~2문장으로 끝내고, 다른 블록에서는 절대 원국 성격을 다시 풀어쓰지 마라." : ""}
- weatherReason: ③ 오늘의 날씨 판정 근거를 생활 언어로 1~2문장.${
    isFree
      ? ` 위 [오행 비유] 블록의 비유 명사와 문장을 반드시 그대로 또는 근접하게 포함해서 "왜 오늘이 이런 날인지"를 설명하라 — 오행 용어(목/화/토/금/수, 상생상극 등)는 절대 쓰지 말고 비유 문장으로만.`
      : ` "왜 오늘이 이런 날인지"를 명식 근거를 녹여 설명하되 여기서도 원어 나열보다 쉬운 말 위주로.`
  }
- flow: ④ 오전/오후/저녁 각 2문장(총 4문장 이상). 위 [오늘 12시진] 표에서 해당 시간대
  시진 간지를 근거로 삼아 서술(오전=인시~사시, 오후=오시~신시, 저녁=유시~해시 대역
  중 대표 시진 선택)하되,${isFree ? " 시진 이름(자시/축시/인시/묘시/진시/사시/오시/미시/신시/유시/술시/해시)은 명리 용어이므로 절대 쓰지 말고 반드시 현대 시간(예: \"오전 9시~11시\")으로만 표현하라." : " 시진 이름을 그대로 언급해도 된다."}
  위에서 지정한 골든타임 문구는 해당 시간대 서술 안에 자연스럽게 포함.
- goldenTimeLabel: 위 [골든타임]에서 코드가 준 시간대 문구를 그대로 복사한다.
- point: ⑤ 오늘의 포인트 2영역. take(취할 것, 3~4문장)와 avoid(피할 것, 3~4문장) 각각
  구체적 행동 단위로 쓴다(예: "10만원 넘는 결제는 내일로 미루세요"). 저녁에 스스로 검증
  가능한 조건부 문장("~하기 쉬운 날")을 반드시 섞어라.
- check: ⑥ "오늘 저녁, 몇 개가 맞았는지 세어보세요" 같은 체감 체크 유도 문장 1개.
${ctaFieldInstruction} (⑦ CTA)
- tomorrow: ⑧ 내일 예고 1문장(위 [내일 일진] 근거) + 따뜻한 마무리 위로 1문장.

[핵심 규칙]
- 흉한 신호도 뭉개지 말고 뾰족하게 짚되(해설가이드 0장), 반드시 행동 처방과 함께 제시한다.
- 공포 마케팅(해설가이드 3장) 금지 — "삼재라서 큰일" 식 불안 조장 금지.
- 고객에 대해 아무것도 모른다는 전제 — "그대에겐 ~가 있어요" 같은 아는 척 문장 금지.
- 모든 간지·시진·톤·골든타임은 위 데이터 블록 값을 그대로 인용 — 재계산·추측·재판정 금지.
- CTA 문구는 절대 쓰지 마라 — CTA는 코드가 별도 템플릿으로 조립한다(위 todaySummarySentence
  지시를 따르는 경우 제외).

[출력 형식 — 매우 중요]
반드시 아래 JSON 객체 하나로만 응답한다. 코드블록 마커 없이 { 로 시작해 } 로 끝나는 순수 JSON:
{
  "dayTone": "${input.dayTone}",
  "headline": "...",
  "psychSnipe": "...",
  "weatherReason": "...",
  "flow": {"morning":"...","afternoon":"...","evening":"..."},
  "goldenTimeLabel": "${input.goldenSijin.timeRangeLabel}",
  "point": {"take":"...","avoid":"..."},
  "check": "...",
  ${needsSummary ? `"todaySummarySentence": "...",` : ""}
  "tomorrow": "..."
}
JSON 외 다른 텍스트 절대 추가 금지.`;

  return { system: SYSTEM_BASE, user };
}

// 게이트 종류 증가(용어 제로/골든타임/CTA요약 등)에 맞춰 여유를 더 둠.
const MAX_ATTEMPTS = 5;

export async function generateTodayFortuneWithRetry(
  input: TodayFortunePromptInput,
): Promise<{ result: TodayFortuneResult; provider: string; model: string }> {
  let prevIssues: string[] = [];
  let lastText = "";
  let provider = "";
  let model = "";
  const validateOpts =
    input.variant === "free" ? { variant: "free" as const, elementMetaphor: input.elementMetaphor } : undefined;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { system, user } = buildTodayFortunePrompt(input);
    const userFinal =
      prevIssues.length > 0
        ? `${user}\n\n[재생성 지시 — 직전 응답이 아래를 위반했다. 모두 수정해 전체 JSON을 다시 작성하라]\n- ${prevIssues.join("\n- ")}`
        : user;
    let llm: Awaited<ReturnType<typeof generateInterpretation>>;
    try {
      llm = await generateInterpretation({ system, user: userFinal, maxTokens: 8192 });
    } catch (err) {
      // 네트워크/일시적 API 오류(503 overloaded 등) — JSON 파싱 실패와 동일하게 재시도 대상.
      console.warn(`[today-fortune retry] attempt ${attempt + 1} API 호출 실패: ${err instanceof Error ? err.message : String(err)}`);
      prevIssues = [];
      continue;
    }
    lastText = llm.text;
    provider = llm.provider;
    model = llm.model;
    const obj = extractJsonObject(llm.text);
    const parsed = obj ? parseTodayFortuneSections(obj) : null;
    if (!parsed) {
      console.warn(`[today-fortune retry] attempt ${attempt + 1} JSON 파싱/스키마 실패. obj=${obj ? "파싱은 됐으나 스키마 불일치" : "파싱 실패"}. raw(500자): ${lastText.slice(0, 500)}`);
      prevIssues = ["JSON 스키마 불일치 — 지정된 필드 구성을 정확히 지켜라"];
      continue;
    }
    const issues = validateTodayFortune(parsed, input.dayTone, input.ctaTemplateId, input.goldenSijin.timeRangeLabel, validateOpts);
    if (issues.length === 0) {
      const teaserCta = assembleCta(input.ctaTemplateId, parsed.todaySummarySentence);
      return { result: { ...parsed, teaserCta }, provider, model };
    }
    console.warn(`[today-fortune retry] attempt ${attempt + 1} 위반: ${issues.join(" / ")}`);
    prevIssues = issues;
  }

  throw new Error(`today-fortune 생성 실패 — ${MAX_ATTEMPTS}회 연속 실패. 마지막 응답 앞 300자: ${lastText.slice(0, 300)}`);
}

/**
 * 8블록 JSON을 감사/폴백용 마크다운 문자열로 펼친다. confirm/route.ts(유료)와
 * free-fortune/route.ts(무료) 양쪽이 동일 로직을 쓰도록 공용화 — teaser가 빈
 * 문자열(무료, ctaTemplateId="NONE")이면 CTA 줄을 건너뛴다.
 */
export function formatTodayFortuneAsMarkdown(sections: TodayFortuneResult): string {
  const lines = [
    `## ${sections.headline}`,
    ``,
    sections.psychSnipe,
    ``,
    sections.weatherReason,
    ``,
    `**오전** ${sections.flow.morning}`,
    `**오후** ${sections.flow.afternoon}`,
    `**저녁** ${sections.flow.evening}`,
    `**골든타임** ${sections.goldenTimeLabel}`,
    ``,
    `**취할 것**: ${sections.point.take}`,
    `**피할 것**: ${sections.point.avoid}`,
    ``,
    sections.check,
  ];
  if (sections.teaserCta.teaser) {
    lines.push(``, sections.teaserCta.teaser);
  }
  lines.push(``, `**내일** ${sections.tomorrow}`);
  return lines.join("\n");
}
