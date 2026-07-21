// =====================================================
// src/lib/saju/element-metaphor.ts
// =====================================================
// 무료 운세 초3 언어 요구사항(지시문_무료운세_톤수정_20260721.md §3-2-C) —
// "오늘 기운"을 일간 오행에 맞는 자연 비유(나무 키우기/불씨/밭/보석/시냇물)로
// 설명한다. 관계(생조/극설)와 문장은 전부 코드가 계산해 확정값으로 프롬프트에
// 주입한다 — LLM이 오행 관계를 스스로 판단하게 두면 방향이 틀릴 위험이 크다.

import { getCheonganOheng, OHAENG_GENERATES, OHAENG_OVERCOMES, type Oheng } from "./derived";

export type ElementRelation =
  | "same" // 비겁 — 오늘 기운이 일간과 같은 오행
  | "generates-user" // 인성 — 오늘 기운이 일간을 생함
  | "user-generates" // 식상 — 일간이 오늘 기운을 생함(설기)
  | "overcomes-user" // 관살 — 오늘 기운이 일간을 극함
  | "user-overcomes"; // 재성 — 일간이 오늘 기운을 극함

export type ElementMetaphor = {
  dayMasterOheng: Oheng;
  todayOheng: Oheng;
  relation: ElementRelation;
  /** 일간 오행 기준 비유 명사 — 나무/불씨/밭/보석/시냇물. */
  metaphorNoun: string;
  /** 코드가 완성한 문장 — 프롬프트가 weatherReason에 그대로/근접 인용하도록 지시하는 값. */
  hintSentence: string;
};

const ELEMENT_NOUN: Record<Oheng, string> = {
  목: "나무",
  화: "불씨",
  토: "밭",
  금: "보석",
  수: "시냇물",
};

// 오행별 x 관계별 문장 — 방향(생조/극설)이 명리적으로 정확하도록 코드로 고정.
const HINT_SENTENCES: Record<Oheng, Record<ElementRelation, string>> = {
  목: {
    same: "오늘은 그대처럼 나무 기운이 강한 날이에요. 비슷한 나무들이 많아서 서로 돕고 함께 자랄 수 있어요.",
    "generates-user": "오늘은 물이 많은 날이라, 그대라는 나무가 물을 잔뜩 머금고 쑥쑥 자랄 수 있어요.",
    "user-generates": "오늘은 그대라는 나무가 불을 피우는 날이에요. 갖고 있던 힘을 밖으로 쓰느라 조금 지칠 수 있어요.",
    "overcomes-user": "오늘은 쇠 기운이 강해서, 나무인 그대를 도끼처럼 힘들게 다듬으려 할 수 있어요.",
    "user-overcomes": "오늘은 나무인 그대가 흙에 뿌리내리는 날이에요. 애쓴 만큼 좋은 결실을 얻을 수 있어요.",
  },
  화: {
    same: "오늘은 그대처럼 불 기운이 강한 날이에요. 여기저기서 함께 타오를 불씨들이 많아요.",
    "generates-user": "오늘은 나무 기운이 강해서, 불씨인 그대에게 좋은 땔감이 되어줄 수 있어요.",
    "user-generates": "오늘은 불씨인 그대가 흙을 굽는 날이에요. 힘을 쓰는 만큼 결과물이 단단해져요.",
    "overcomes-user": "오늘은 물 기운이 강해서, 불씨인 그대를 꺼뜨리려 할 수 있어요. 무리하지 말고 몸을 사려야 해요.",
    "user-overcomes": "오늘은 불씨인 그대가 쇠를 녹여 다루는 날이에요. 힘들이는 만큼 원하는 모양을 만들 수 있어요.",
  },
  토: {
    same: "오늘은 그대처럼 흙 기운이 강한 날이에요. 넓은 땅이 여기저기 펼쳐져 든든해요.",
    "generates-user": "오늘은 불 기운이 강해서, 밭인 그대에게 따뜻한 온기를 보태줄 수 있어요.",
    "user-generates": "오늘은 밭인 그대가 쇠를 키워내는 날이에요. 품을 들이는 만큼 값진 결과물이 나와요.",
    "overcomes-user": "오늘은 나무 기운이 강해서, 밭인 그대의 땅을 파고들려 할 수 있어요. 뿌리 깊은 문제는 오늘 무리해서 풀려 하지 마세요.",
    "user-overcomes": "오늘은 밭인 그대가 물길을 막고 다스리는 날이에요. 애쓴 만큼 상황을 잘 정리할 수 있어요.",
  },
  금: {
    same: "오늘은 그대처럼 쇠 기운이 강한 날이에요. 비슷한 보석들이 여기저기서 함께 빛나요.",
    "generates-user": "오늘은 흙 기운이 강해서, 보석인 그대를 땅속에서 든든하게 품어줄 수 있어요.",
    "user-generates": "오늘은 보석인 그대가 맑은 물을 만들어내는 날이에요. 힘을 쓰는 만큼 주변이 깨끗해져요.",
    "overcomes-user": "오늘은 불 기운이 강해서, 보석인 그대를 뜨겁게 녹이려 할 수 있어요. 오늘은 무리한 결정을 잠시 미뤄두세요.",
    "user-overcomes": "오늘은 보석인 그대가 나무를 다듬는 날이에요. 힘들이는 만큼 원하는 모양을 만들 수 있어요.",
  },
  수: {
    same: "오늘은 그대처럼 물 기운이 강한 날이에요. 여러 물줄기가 모여 흐름이 세져요.",
    "generates-user": "오늘은 쇠 기운이 강해서, 시냇물인 그대에게 맑은 샘물을 보태줄 수 있어요.",
    "user-generates": "오늘은 시냇물인 그대가 나무를 키워내는 날이에요. 힘을 쓰는 만큼 무언가 쑥쑥 자라나요.",
    "overcomes-user": "오늘은 흙 기운이 강해서, 시냇물인 그대의 흐름을 막으려 할 수 있어요. 오늘은 억지로 뚫고 가려 하지 마세요.",
    "user-overcomes": "오늘은 시냇물인 그대가 불을 다스리는 날이에요. 애쓴 만큼 상황을 진정시킬 수 있어요.",
  },
};

function classifyRelation(dayMasterOheng: Oheng, todayOheng: Oheng): ElementRelation {
  if (dayMasterOheng === todayOheng) return "same";
  if (OHAENG_GENERATES[todayOheng] === dayMasterOheng) return "generates-user";
  if (OHAENG_GENERATES[dayMasterOheng] === todayOheng) return "user-generates";
  if (OHAENG_OVERCOMES[todayOheng] === dayMasterOheng) return "overcomes-user";
  return "user-overcomes"; // 남은 경우는 반드시 이것 — 5원소 순환이라 5갈래 외 없음.
}

/**
 * 일간 천간과 오늘 일진 천간으로 오행 비유를 계산한다.
 * @throws 천간 문자가 CHEONGAN_OHENG 테이블에 없을 때(방어적 — 정상 데이터에선 발생 안 함).
 */
export function computeElementMetaphor(dayMasterCheongan: string, todayCheongan: string): ElementMetaphor {
  const dayMasterOheng = getCheonganOheng(dayMasterCheongan);
  const todayOheng = getCheonganOheng(todayCheongan);
  if (!dayMasterOheng || !todayOheng) {
    throw new Error(`오행 매핑 실패: dayMaster=${dayMasterCheongan}, today=${todayCheongan}`);
  }
  const relation = classifyRelation(dayMasterOheng, todayOheng);
  return {
    dayMasterOheng,
    todayOheng,
    relation,
    metaphorNoun: ELEMENT_NOUN[dayMasterOheng],
    hintSentence: HINT_SENTENCES[dayMasterOheng][relation],
  };
}

export function formatElementMetaphorForPrompt(m: ElementMetaphor): string {
  return `일간 오행: ${m.dayMasterOheng}(비유: ${m.metaphorNoun}) / 오늘 오행: ${m.todayOheng} / 관계: ${m.relation}\n권장 문장(그대로 또는 근접 인용): "${m.hintSentence}"`;
}
