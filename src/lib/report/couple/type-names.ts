// =====================================================
// 커플 궁합 리포트 — 유형명 ↔ 코드 판정 (진실 원천)
// =====================================================
// docs/검수요청_궁합_fewshot샘플_20260715.md "유형명 ↔ 코드 판정 매핑표" 구현.
// "계산은 코드가, 서술만 AI가" 원칙 — 배정은 반드시 코드가 하고 LLM은 배정된
// 유형명만 사용한다(게이트 검증). 3축은 서로 다른 목적(블록2/블록5/갈등매뉴얼)이라
// 같은 별명을 두 판정에 쓰지 않는다.

import type { MyeongsikViewModel, PillarView } from "@/lib/saju/build-myeongsik-view";
import type { Oheng } from "@/lib/saju/derived";

// ── 축 1 — 밤의 페르소나 (십신 분포) ────────────────────
export const PERSONA_TYPES = [
  "낮밤 반전형",
  "저격 대기형",
  "리액션 연료형",
  "리드 수신형",
  "무드 감독형",
  "직진 점화형",
] as const;
export type PersonaType = (typeof PERSONA_TYPES)[number];

const PERSONA_DEF: Record<PersonaType, string> = {
  "낮밤 반전형": "낮엔 신사, 밤엔 확신",
  "저격 대기형": "꽂히는 포인트가 있어야 켜진다",
  "리액션 연료형": "상대의 반응이 연료 — 해주고 불붙는다",
  "리드 수신형": "이끌려야 안전하게 달아오른다",
  "무드 감독형": "조명·분위기·연출이 먼저다",
  "직진 점화형": "켜지면 바로 직진, 밀당 없음",
};

// ── 축 2 — 예열-지속 곡선 (오행·십신) ────────────────────
export const PACE_TYPES = ["스위치형", "다이얼형", "파도형"] as const;
export type PaceType = (typeof PACE_TYPES)[number];

const PACE_DEF: Record<PaceType, string> = {
  스위치형: "점화 빠르고 냉각도 빠르다",
  다이얼형: "천천히 돌려야 올라가고, 오래 간다",
  파도형: "컨디션 따라 오르내린다",
};

// ── 축 3 — 회복 시계 (갈등 매뉴얼용) ─────────────────────
export const CLOCK_TYPES = ["반나절 시계", "하루반 시계"] as const;
export type ClockType = (typeof CLOCK_TYPES)[number];

const CLOCK_DEF: Record<ClockType, string> = {
  "반나절 시계": "비겁·양간 우세 — 결론 나면 빨리 회복",
  "하루반 시계": "인성·음간 우세 — 정리할 시간이 더 필요",
};

const YANG_GAN = new Set(["갑", "병", "무", "경", "임"]);

type SipseongCounts = { 비겁: number; 식상: number; 관성: number; 인성: number; 편재: number };

function countSipseong(view: MyeongsikViewModel): SipseongCounts {
  const counts: SipseongCounts = { 비겁: 0, 식상: 0, 관성: 0, 인성: 0, 편재: 0 };
  const pillars: (PillarView | null)[] = [
    view.pillars.year,
    view.pillars.month,
    view.pillars.day,
    view.pillars.hour,
  ];
  for (const p of pillars) {
    if (!p) continue;
    for (const sip of [p.sipseongCheongan, p.sipseongJiji]) {
      switch (sip) {
        case "비견":
        case "겁재":
          counts.비겁++;
          break;
        case "식신":
        case "상관":
          counts.식상++;
          break;
        case "정관":
        case "편관":
          counts.관성++;
          break;
        case "정인":
        case "편인":
          counts.인성++;
          break;
        case "편재":
          counts.편재++;
          break;
      }
    }
  }
  return counts;
}

/**
 * 판정 우선순위(매핑표 원문): 최다 십신 기준, 동률 시 살인상생 구조 여부 →
 * 관성 → 식상 → 인성 → 편재 → 비겁 순으로 체크.
 * 살인상생 구조는 "관성과 인성이 함께 존재"를 근사치로 판정(임계값은 구현 판단 —
 * 정밀한 오행 상생 검증 대신 마케팅 목적상 충분한 근사).
 */
function judgePersonaType(view: MyeongsikViewModel): PersonaType {
  const c = countSipseong(view);
  const hasSalinSangsaeng = c.관성 >= 1 && c.인성 >= 1;
  const max = Math.max(c.비겁, c.식상, c.관성, c.인성, c.편재);
  const tied = (Object.keys(c) as (keyof SipseongCounts)[]).filter((k) => c[k] === max && max > 0);

  let winner: keyof SipseongCounts;
  if (tied.length !== 1) {
    if (tied.includes("관성")) winner = "관성";
    else if (tied.includes("식상")) winner = "식상";
    else if (tied.includes("인성")) winner = "인성";
    else if (tied.includes("편재")) winner = "편재";
    else winner = "비겁";
  } else {
    winner = tied[0];
  }

  if (winner === "인성" || winner === "관성") {
    return hasSalinSangsaeng ? "낮밤 반전형" : winner === "인성" ? "저격 대기형" : "리드 수신형";
  }
  if (winner === "식상") return "리액션 연료형";
  if (winner === "편재") return "무드 감독형";
  return "직진 점화형";
}

/** 목화·식상 우세 → 스위치형 / 금수 우세 → 다이얼형 / 수·화 혼재(기복) → 파도형. */
function judgePaceType(view: MyeongsikViewModel): PaceType {
  const { 목, 화, 금, 수 } = view.ohaengCount as Record<Oheng, number>;
  if (화 >= 2 && 수 >= 2 && Math.abs(화 - 수) <= 1) return "파도형";
  const hwaMok = 목 + 화;
  const geumSu = 금 + 수;
  return geumSu > hwaMok ? "다이얼형" : "스위치형";
}

/**
 * 비겁 > 인성 → 반나절 시계 / 인성 > 비겁 → 하루반 시계 / 동률 → 양간이면 반나절,
 * 음간이면 하루반(지시문_궁합_v4검토수정_20260716.md §1 — "우세" 원문 반영, 기존
 * OR 로직은 인구 절반이 자동 반나절로 오판정되는 결함이 있었음).
 */
function judgeRecoveryClock(view: MyeongsikViewModel): ClockType {
  const c = countSipseong(view);
  if (c.비겁 > c.인성) return "반나절 시계";
  if (c.인성 > c.비겁) return "하루반 시계";
  const isYang = YANG_GAN.has(view.pillars.day.cheongan);
  return isYang ? "반나절 시계" : "하루반 시계";
}

export type PersonTypeNames = {
  persona: PersonaType;
  pace: PaceType;
  clock: ClockType;
};

export type CoupleTypeNames = {
  self: PersonTypeNames;
  partner: PersonTypeNames;
};

export function computeCoupleTypeNames(
  selfView: MyeongsikViewModel,
  partnerView: MyeongsikViewModel,
): CoupleTypeNames {
  return {
    self: {
      persona: judgePersonaType(selfView),
      pace: judgePaceType(selfView),
      clock: judgeRecoveryClock(selfView),
    },
    partner: {
      persona: judgePersonaType(partnerView),
      pace: judgePaceType(partnerView),
      clock: judgeRecoveryClock(partnerView),
    },
  };
}

/** 프롬프트 주입용 — "이 유형명만 사용" 진실 원천 블록. */
export function formatCoupleTypeNamesForPrompt(types: CoupleTypeNames, names: { self: string; partner: string }): string {
  const line = (label: string, p: PersonTypeNames) =>
    `  ${label}: 밤의 페르소나=${p.persona}(${PERSONA_DEF[p.persona]}) · 예열-지속=${p.pace}(${PACE_DEF[p.pace]}) · 회복 시계=${p.clock}(${CLOCK_DEF[p.clock]})`;
  return [
    `[유형 판정 — 이 유형명만 사용, 다른 별명 창작 금지]`,
    line(names.self, types.self),
    line(names.partner, types.partner),
  ].join("\n");
}

/** 게이트용 — 이 문서에 정의된 유형명 전체(오배정 검출에 사용). */
export const ALL_TYPE_NAMES: readonly string[] = [...PERSONA_TYPES, ...PACE_TYPES, ...CLOCK_TYPES];
