// =====================================================
// src/lib/saju/today-fortune-prompt.ts
// =====================================================
// today-fortune 전용 프롬프트 — 해설가이드.md 5장(2026-07-14 갱신) 사양:
// "퍼널 입구 상품 — 마케팅 문법 적용". 다른 두리 상품(love-saju 등)의 자유분방한
// 5키 JSON과 달리, 6블록 고정 구조 + 500~700자 + 검증 가능 문장/CTA 개수 게이트를 둔다.
//
// 시진/오늘·내일 일진은 전부 코드가 계산해 데이터로 주입한다 — LLM은 재계산 금지,
// 해설만 한다("계산은 코드가, 해석만 AI가" 원칙, 리포트 모듈과 동일 사상).

import type { Myeongsik } from "./manseryeok";
import { SYSTEM_BASE } from "./prompt";
import { generateInterpretation } from "./llm";
import { extractJsonObject } from "../report/prompts/extract-json";
import type { SijinEntry } from "./sijin";
import type { DayGanji } from "./today-ganji";

export type TodayFortuneSections = {
  headline: string;
  flow: { morning: string; afternoon: string; evening: string };
  point: { items: string[]; avoid: string };
  check: string;
  teaserCta: { teaser: string; ctaLabel: string };
  tomorrow: string;
};

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export function parseTodayFortuneSections(obj: unknown): TodayFortuneSections | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;

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
    headline: o.headline as string,
    flow: { morning: flow.morning as string, afternoon: flow.afternoon as string, evening: flow.evening as string },
    point: { items: point.items as string[], avoid: point.avoid as string },
    check: o.check as string,
    teaserCta: { teaser: teaserCta.teaser as string, ctaLabel: teaserCta.ctaLabel as string },
    tomorrow: o.tomorrow as string,
  };
}

// 해설가이드 4장 "검증 가능 문장 2개 미만 → 재생성" / "CTA 2개 이상 → 재생성" 게이트.
const CTA_TRIGGER_RE = /보러\s*가기|확인하기|지금\s*확인|자세히\s*보기|알아보기/;

export function validateTodayFortune(s: TodayFortuneSections): string[] {
  const issues: string[] = [];

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

export function buildTodayFortunePrompt(input: {
  myeongsik: Myeongsik;
  manseryeokText?: string;
  birthDate: string;
  gender: "male" | "female";
  todayGanji: DayGanji;
  tomorrowGanji: DayGanji;
  sijinTable: SijinEntry[];
  dayQuality: "good" | "bad";
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

  const frameInstruction =
    input.dayQuality === "bad"
      ? `오늘은 나쁜 날(소나기) 판정이다 — teaserCta 는 "이 구간이 언제 끝나는지 아는 게 무기" 프레임으로 쓴다.`
      : `오늘은 좋은 날(맑음) 판정이다 — teaserCta 는 "이 흐름을 길게 타는 법" 프레임으로 쓴다.`;

  const user = `[현재 시점]
오늘은 ${input.birthDate} 기준이 아니라 구매 시점(오늘)이다.

${sajuSection}

[오늘 일진] ${input.todayGanji.cheongan}${input.todayGanji.jiji}
[내일 일진] ${input.tomorrowGanji.cheongan}${input.tomorrowGanji.jiji}
[오늘 12시진 — 코드가 계산한 확정값. 절대 재계산하지 말고 그대로 인용하라]
${formatSijinTable(input.sijinTable)}

[날씨 판정 — 코드가 결정] ${input.dayQuality === "bad" ? "나쁜 날(소나기)" : "좋은 날(맑음)"}
${frameInstruction}

[CTA 타겟 상품] ${input.targetProductName} — teaserCta.ctaLabel 은 이 상품으로 이어지는 문구로 쓴다
(URL/링크는 절대 쓰지 마라 — 코드가 별도로 연결한다).

[이번 상품 — 오늘의 운세, 퍼널 입구 상품. 마케팅 문법 적용]
총 500~700자, 아래 6블록 JSON으로 작성한다.

- headline: 오늘의 뾰족한 예측 1문장. **첫 문장이 훅** — 인사말은 그 다음(headline 자체엔 인사 넣지 마라).
  "오늘은 변화가 많을 수 있어요" 같은 바넘 문장 금지 — 오늘 일진과 본인 명식의 상호작용(십성·오행·합충)을
  구체적 근거로 짚어 특정하게 써라.
- flow: 오전/오후/저녁 각 1문장. 위 [오늘 12시진] 표에서 해당 시간대 시진 간지를 근거로 인용하며 서술
  (오전=인시~사시 대역, 오후=오시~신시 대역, 저녁=유시~해시 대역 중 대표 시진 선택).
- point: 오늘의 포인트 1~2개(items) + "피할 것" 1개(avoid). 반드시 저녁에 스스로 검증 가능한 조건부
  문장("~하기 쉬운 날") 형태로 쓰고, avoid는 구체적 행동 단위로 쓴다(예: "10만원 넘는 결제는 내일로").
- check: "오늘 저녁, 몇 개가 맞았는지 세어보세요" 같은 체감 체크 유도 문장 1개.
- teaserCta: {teaser, ctaLabel}. teaser는 사이클 티저(오픈 루프 — 다 풀어주지 않고 궁금증을 남긴다) +
  위 프레임 지시를 따른 1~2문장. ctaLabel은 버튼에 들어갈 짧은 문구(예: "연애 사주 더 보기").
- tomorrow: 내일 예고 1문장. 위 [내일 일진]을 근거로.

[핵심 규칙]
- 흉한 신호도 뭉개지 말고 뾰족하게 짚되(해설가이드 0장), 반드시 행동 처방과 함께 제시한다.
- 공포 마케팅(해설가이드 3장) 금지 — "삼재라서 큰일" 식 불안 조장 금지.
- CTA는 teaserCta 필드 하나에만 — 다른 블록에 "보러 가기"류 문구를 넣지 마라.
- 모든 간지·시진은 위 데이터 블록 값을 그대로 인용 — 재계산·추측 금지.

[출력 형식 — 매우 중요]
반드시 아래 JSON 객체 하나로만 응답한다. 코드블록 마커 없이 { 로 시작해 } 로 끝나는 순수 JSON:
{
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

const MAX_ATTEMPTS = 3;

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
    const llm = await generateInterpretation({ system, user: userFinal, maxTokens: 4096 });
    lastText = llm.text;
    provider = llm.provider;
    model = llm.model;
    const obj = extractJsonObject(llm.text);
    const parsed = obj ? parseTodayFortuneSections(obj) : null;
    if (!parsed) {
      console.warn(`[today-fortune retry] attempt ${attempt + 1} JSON 파싱/스키마 실패. obj=${obj ? "파싱은 됐으나 스키마 불일치" : "파싱 실패"}. raw(500자): ${lastText.slice(0, 500)}`);
      prevIssues = ["JSON 스키마 불일치 — 지정된 6블록 구성을 정확히 지켜라"];
      continue;
    }
    const issues = validateTodayFortune(parsed);
    if (issues.length === 0) return { sections: parsed, provider, model };
    console.warn(`[today-fortune retry] attempt ${attempt + 1} 위반: ${issues.join(" / ")}`);
    prevIssues = issues;
  }

  throw new Error(`today-fortune 생성 실패 — ${MAX_ATTEMPTS}회 연속 실패. 마지막 응답 앞 300자: ${lastText.slice(0, 300)}`);
}
