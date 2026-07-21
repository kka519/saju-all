// =====================================================
// src/lib/saju/cta-templates.ts
// =====================================================
// today-fortune CTA 템플릿 뱅크 — LLM 자유 작성 금지. 판정(good / mixed·caution)
// × 라우팅(리포트 / 연애) 2×2 = 4개 고정 문구. R1/L1/L2는 완전 고정(LLM 개입
// 0), R2만 "{오늘의_핵심문장}" 자리에 LLM이 쓴 한 문장을 꽂는다.
//
// 원칙(해설가이드 5장): 고객에 대해 아무것도 모른다는 전제 — "그대에겐 ~가
// 있어요" 같은 아는 척 문장 금지. 오늘 풀이가 답 못 하는 질문(우연인가 구조인가)
// 만 열고 CTA로 연결한다. 버튼 문구도 템플릿에 고정.

import type { DayTone } from "./today-ganji";

export type CtaTemplateId = "R1" | "R2" | "L1" | "L2" | "NONE";
export type CtaRouting = "report" | "love";

export type CtaTemplate = {
  body: string;
  needsSummary: boolean;
  ctaLabel: string;
};

export const CTA_TEMPLATES: Record<CtaTemplateId, CtaTemplate> = {
  R1: {
    needsSummary: false,
    ctaLabel: "지난 30년 확인하러 가기",
    body: "오늘은 바람이 등 뒤에서 부는 날이에요. 그런데 이 바람이 하루짜리인지, 몇 년짜리 흐름의 시작인지는 하루 풀이로는 알 수 없어요. 지금이 올라타야 할 구간인지 — 지난 30년을 되감아 확인하는 방법이 있어요.",
  },
  R2: {
    needsSummary: true,
    ctaLabel: "지난 30년 확인하러 가기",
    body: "{summary}이라고 했죠. 이게 오늘만의 우연인지, 그대 명식에 새겨진 반복 구조인지는 하루 풀이로는 알 수 없어요. 구조라면 다음에도 같은 자리에서 반복돼요 — 지난 30년을 되감아 확인하는 방법이 있어요.",
  },
  L1: {
    needsSummary: false,
    ctaLabel: "내 마음의 기후 보기",
    body: "오늘은 누군가와의 거리가 한 뼘 가까워지기 좋은 날이에요. 그런데 그 사람이 스쳐 갈 인연인지 남을 인연인지는 오늘 날씨만으론 몰라요. 날씨 말고 기후 — 그대 마음의 계절을 펼쳐보면 보여요.",
  },
  L2: {
    needsSummary: false,
    ctaLabel: "내 마음의 기후 보기",
    body: "오늘은 하루의 날씨만 봤어요. 날씨 말고 기후가 궁금하지 않으세요? 그대가 어떤 사람 앞에서 흔들리고, 어떤 사람 옆에서 단단해지는지는 명식 전체를 펼쳐야 보여요.",
  },
  // 무료 운세 전용 — CTA 없음. 화면 쪽에 이미 별도 업셀 버튼이 있어 본문에 CTA 문구를 넣지 않는다.
  NONE: {
    needsSummary: false,
    ctaLabel: "",
    body: "",
  },
};

/** targetSlug(routeCtaSlug 결과)를 report/love 라우팅 버킷으로 축약. */
export function toCtaRouting(targetSlug: string): CtaRouting {
  return targetSlug === "life-analyst-report" ? "report" : "love";
}

/** good → R1/L1, mixed·caution → R2/L2 (2단으로 합침 — 템플릿은 판정 세부가 아니라 좋은 날인지만 구분). */
export function pickCtaTemplate(routing: CtaRouting, tone: DayTone): CtaTemplateId {
  const isGood = tone === "good";
  if (routing === "report") return isGood ? "R1" : "R2";
  return isGood ? "L1" : "L2";
}

/** 최종 CTA 텍스트 조립 — 코드가 한다. summarySentence 는 R2 외엔 무시. */
export function assembleCta(id: CtaTemplateId, summarySentence?: string): { teaser: string; ctaLabel: string } {
  const t = CTA_TEMPLATES[id];
  const teaser = t.needsSummary ? t.body.replace("{summary}", summarySentence ?? "") : t.body;
  return { teaser, ctaLabel: t.ctaLabel };
}
