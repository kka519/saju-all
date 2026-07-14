// =====================================================
// src/lib/saju/today-fortune-prompt.ts
// =====================================================
// today-fortune 전용 프롬프트 — 해설가이드.md 5장(2026-07-14 갱신) 사양:
// "퍼널 입구 상품 — 마케팅 문법 적용". 다른 두리 상품(love-saju 등)의 자유분방한
// 5키 JSON과 달리, 6블록 고정 구조 + 500~700자 + 검증 가능 문장/CTA 개수 게이트를 둔다.
//
// 시진/오늘·내일 일진/톤(day_tone)은 전부 코드가 계산해 데이터로 주입한다 —
// LLM은 재계산 금지, 해설만 한다("계산은 코드가, 해석만 AI가" 원칙).
//
// 진실 원천 통일: 톤 판정(analyzeDayTone, today-ganji.ts)과 본문 서술이 어긋나던
// 문제(예: "맑음" 판정인데 headline은 부정적) 재발 방지 — LLM에게 day_tone 필드로
// 판정을 그대로 되돌려 쓰게 하고, 게이트가 이 값이 주입된 판정과 일치하는지 +
// teaserCta가 톤에 맞는 프레임 키워드를 썼는지까지 검증한다.

import type { Myeongsik } from "./manseryeok";
import { SYSTEM_BASE } from "./prompt";
import { generateInterpretation } from "./llm";
import { extractJsonObject } from "../report/prompts/extract-json";
import type { SijinEntry } from "./sijin";
import type { DayGanji, DayTone, DayToneRelation } from "./today-ganji";

export type TodayFortuneSections = {
  dayTone: DayTone;
  headline: string;
  flow: { morning: string; afternoon: string; evening: string };
  point: { items: string[]; avoid: string };
  check: string;
  teaserCta: { teaser: string; ctaLabel: string };
  tomorrow: string;
};

const DAY_TONE_VALUES: readonly DayTone[] = ["good", "mixed", "caution"];

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function parseTodayFortuneSections(obj: unknown): TodayFortuneSections | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;

  if (!DAY_TONE_VALUES.includes(o.dayTone as DayTone)) return null;
  if (!isNonEmptyString(o.headline)) return null;
  const flow = o.flow as Record<string, unknown> | undefined;
  if (!flow || !isNonEmptyString(flow.morning) || !isNonEmptyString(flow.afternoon) || !isNonEmptyString(flow.evening)) {
    return null;
  }
  const point = o.point as Record<string, unknown> | undefined;
  if (
    !point ||
    !Array.isArray(point.items) ||
    point.items.length < 1 ||
    !point.items.every(isNonEmptyString) ||
    !isNonEmptyString(point.avoid)
  ) {
    return null;
  }
  if (!isNonEmptyString(o.check)) return null;
  const teaserCta = o.teaserCta as Record<string, unknown> | undefined;
  if (!teaserCta || !isNonEmptyString(teaserCta.teaser) || !isNonEmptyString(teaserCta.ctaLabel)) return null;
  if (!isNonEmptyString(o.tomorrow)) return null;

  return {
    dayTone: o.dayTone as DayTone,
    headline: o.headline as string,
    flow: { morning: flow.morning as string, afternoon: flow.afternoon as string, evening: flow.evening as string },
    point: { items: point.items as string[], avoid: point.avoid as string },
    check: o.check as string,
    teaserCta: { teaser: teaserCta.teaser as string, ctaLabel: teaserCta.ctaLabel as string },
    tomorrow: o.tomorrow as string,
  };
}

// 톤별 CTA 프레임 키워드 — teaserCta.teaser 가 최소 1개는 포함해야 "프레임을 지켰다"로 인정.
const FRAME_KEYWORDS: Record<DayTone, RegExp> = {
  good: /길게\s*타는|오래\s*타는|흐름을\s*타/,
  caution: /언제\s*끝나는지|구간이\s*끝나|끝나는지\s*아는/,
  mixed: /무엇을\s*취하고|취하고\s*무엇을\s*피할지|취할\s*것.*피할\s*것|골라\s*가져가/,
};

// teaserCta가 날씨/톤 얘기에서 벗어나 신살을 나열하는 식으로 새는 걸 감지하는 가벼운 휴리스틱.
const SINSAL_LEAK_RE = /백호살|화개살|원진|도화살|역마살|홍염살|귀문살|천을귀인|금여|암록|반안살|장성살|겁살|망신살|천의성/g;

// 해설가이드 4장 "검증 가능 문장 2개 미만 → 재생성" / "CTA 2개 이상 → 재생성" 게이트.
const CTA_TRIGGER_RE = /보러\s*가기|확인하기|지금\s*확인|자세히\s*보기|알아보기/;

export function validateTodayFortune(s: TodayFortuneSections, expectedTone: DayTone): string[] {
  const issues: string[] = [];

  if (s.dayTone !== expectedTone) {
    issues.push(`dayTone이 "${s.dayTone}"인데 코드가 계산한 판정은 "${expectedTone}"이다 — dayTone 필드를 "${expectedTone}"로 정확히 맞추고, 본문 톤 전체(headline/point/teaserCta)를 이 판정에 맞게 다시 써라`);
  }

  if (!FRAME_KEYWORDS[expectedTone].test(s.teaserCta.teaser)) {
    issues.push(`teaserCta가 "${expectedTone}" 프레임 키워드를 포함하지 않는다 — 지정된 프레임 문구를 teaser에 명확히 반영하라`);
  }

  const sinsalMatches = s.teaserCta.teaser.match(SINSAL_LEAK_RE);
  if (sinsalMatches && sinsalMatches.length >= 2) {
    issues.push(`teaserCta가 신살 나열(${sinsalMatches.join(",")})로 주제를 이탈했다 — 톤 프레임 본연의 주제로만 써라`);
  }

  const verifiableCount = s.point.items.length + (s.point.avoid ? 1 : 0);
  if (verifiableCount < 2) {
    issues.push(`검증 가능 문장이 ${verifiableCount}개뿐(2개 이상 필요) — point.items/avoid를 조건부+행동 단위 문장으로 보강하라`);
  }

  const outsideCta = [s.headline, s.flow.morning, s.flow.afternoon, s.flow.evening, ...s.point.items, s.point.avoid, s.check, s.tomorrow];
  const ctaLeaks = outsideCta.filter((t) => CTA_TRIGGER_RE.test(t));
  if (ctaLeaks.length > 0) {
    issues.push(`teaserCta 이외의 필드에 CTA성 문구가 등장(${ctaLeaks.length}건) — CTA는 teaserCta 하나로만 제한하라`);
  }

  const totalChars = [s.headline, s.flow.morning, s.flow.afternoon, s.flow.evening, ...s.point.items, s.point.avoid, s.check, s.teaserCta.teaser, s.tomorrow].join("").length;
  if (totalChars < 400 || totalChars > 850) {
    issues.push(`전체 분량 ${totalChars}자 (목표 500~700자, 허용 400~850자) — 목표 범위에 맞게 다시 작성하라`);
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
  good: `teaserCta 는 "이 흐름을 길게 타는 법" 프레임으로 쓴다.`,
  caution: `teaserCta 는 "이 구간이 언제 끝나는지 아는 게 무기" 프레임으로 쓴다.`,
  mixed: `teaserCta 는 "무엇을 취하고 무엇을 피할지" 프레임으로 쓴다 — 오늘은 좋은 관계와 주의할 관계가 동시에 있는 혼조세이니, 유불리를 나누는 톤으로.`,
};

export function buildTodayFortunePrompt(input: {
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
  targetProductName: string;
}): { system: string; user: string } {
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

[톤 판정 — 코드가 위 관계·오행을 종합해 이미 결정했다. 재판정하지 마라]
dayTone: "${input.dayTone}" (${TONE_LABEL[input.dayTone]})
headline·point·teaserCta 전체의 톤(긍정/경계/혼조)을 반드시 이 판정과 일치시켜라 —
예를 들어 "good"인데 headline이 부정적이거나, "caution"인데 낙관적으로 쓰면 안 된다.
${FRAME_TEXT[input.dayTone]}

[CTA 타겟 상품] ${input.targetProductName} — teaserCta.ctaLabel 은 이 상품으로 이어지는 문구로 쓴다
(URL/링크는 절대 쓰지 마라 — 코드가 별도로 연결한다).

[이번 상품 — 오늘의 운세, 퍼널 입구 상품. 마케팅 문법 적용]
총 500~700자, 아래 7필드 JSON으로 작성한다.

- dayTone: 위에서 코드가 준 값("${input.dayTone}")을 그대로 복사해 넣는다 — 절대 다른 값 쓰지 마라.
- headline: 오늘의 뾰족한 예측 1문장. **첫 문장이 훅** — 인사말은 그 다음(headline 자체엔 인사 넣지 마라).
  "오늘은 변화가 많을 수 있어요" 같은 바넘 문장 금지 — 위 [오늘 일진과 원국의 관계] 를 구체적 근거로
  짚어 특정하게 써라. mixed 판정이면 좋은 관계와 주의할 관계를 모두 한 문장 안에 균형 있게 담아라.
- flow: 오전/오후/저녁 각 1문장. 위 [오늘 12시진] 표에서 해당 시간대 시진 간지를 근거로 인용하며 서술
  (오전=인시~사시 대역, 오후=오시~신시 대역, 저녁=유시~해시 대역 중 대표 시진 선택).
- point: 오늘의 포인트 1~2개(items) + "피할 것" 1개(avoid). 반드시 저녁에 스스로 검증 가능한 조건부
  문장("~하기 쉬운 날") 형태로 쓰고, avoid는 구체적 행동 단위로 쓴다(예: "10만원 넘는 결제는 내일로").
  mixed 판정이면 items 중 하나는 "취할 것"(좋은 관계 근거), avoid는 "피할 것"(주의할 관계 근거)으로 대비시켜라.
- check: "오늘 저녁, 몇 개가 맞았는지 세어보세요" 같은 체감 체크 유도 문장 1개.
- teaserCta: {teaser, ctaLabel}. teaser는 사이클 티저(오픈 루프 — 다 풀어주지 않고 궁금증을 남긴다) +
  위에서 지정한 프레임 문구를 반드시 포함한 1~2문장. 신살 이름을 나열하지 말고 톤 프레임 주제에 집중하라.
  ctaLabel은 버튼에 들어갈 짧은 문구(예: "연애 사주 더 보기").
- tomorrow: 내일 예고 1문장. 위 [내일 일진]을 근거로.

[핵심 규칙]
- 흉한 신호도 뭉개지 말고 뾰족하게 짚되(해설가이드 0장), 반드시 행동 처방과 함께 제시한다.
- 공포 마케팅(해설가이드 3장) 금지 — "삼재라서 큰일" 식 불안 조장 금지.
- CTA는 teaserCta 필드 하나에만 — 다른 블록에 "보러 가기"류 문구를 넣지 마라.
- 모든 간지·시진·톤 판정은 위 데이터 블록 값을 그대로 인용 — 재계산·추측·재판정 금지.

[출력 형식 — 매우 중요]
반드시 아래 JSON 객체 하나로만 응답한다. 코드블록 마커 없이 { 로 시작해 } 로 끝나는 순수 JSON:
{
  "dayTone": "${input.dayTone}",
  "headline": "...",
  "flow": {"morning":"...","afternoon":"...","evening":"..."},
  "point": {"items":["...", "..."],"avoid":"..."},
  "check": "...",
  "teaserCta": {"teaser":"...","ctaLabel":"..."},
  "tomorrow": "..."
}
JSON 외 다른 텍스트 절대 추가 금지.`;

  return { system: SYSTEM_BASE, user };
}

// 3 → 4: 톤 일치/프레임 게이트 추가로 위반 종류가 늘어 재시도 여유를 더 둠.
const MAX_ATTEMPTS = 4;

export async function generateTodayFortuneWithRetry(
  input: Parameters<typeof buildTodayFortunePrompt>[0],
): Promise<{ sections: TodayFortuneSections; provider: string; model: string }> {
  let prevIssues: string[] = [];
  let lastText = "";
  let provider = "";
  let model = "";

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { system, user } = buildTodayFortunePrompt(input);
    const userFinal =
      prevIssues.length > 0
        ? `${user}\n\n[재생성 지시 — 직전 응답이 아래를 위반했다. 모두 수정해 전체 JSON을 다시 작성하라]\n- ${prevIssues.join("\n- ")}`
        : user;
    let llm: Awaited<ReturnType<typeof generateInterpretation>>;
    try {
      llm = await generateInterpretation({ system, user: userFinal, maxTokens: 4096 });
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
      prevIssues = ["JSON 스키마 불일치 — 지정된 7필드(dayTone 포함) 구성을 정확히 지켜라"];
      continue;
    }
    const issues = validateTodayFortune(parsed, input.dayTone);
    if (issues.length === 0) return { sections: parsed, provider, model };
    console.warn(`[today-fortune retry] attempt ${attempt + 1} 위반: ${issues.join(" / ")}`);
    prevIssues = issues;
  }

  throw new Error(`today-fortune 생성 실패 — ${MAX_ATTEMPTS}회 연속 실패. 마지막 응답 앞 300자: ${lastText.slice(0, 300)}`);
}
