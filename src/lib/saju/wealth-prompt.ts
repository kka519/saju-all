// =====================================================
// src/lib/saju/wealth-prompt.ts
// =====================================================
// 재물 영역 전용 prompt — 5필드 JSON 강제 + 사주↔자미두수 교차 의무.
//
// 기존 buildSajuPrompt (5섹션 JSON: greeting/saju/coreReading/advice/closing) 와
// 완전 격리:
//   - 입력 타입(WealthPromptInput) 다름
//   - 출력 스키마(WealthSections) 다름 — signature/bigPicture/manifestation/crossReading/timing
//   - 4블록 규칙(A 고정 프레임 / B 교차 강제 / C 시그니처 / H 문장 스타일 / I 검증가능 정보 금지)
//
// SYSTEM_BASE 는 그대로 활용 (두리 톤 공통).
// formatZiweiBlock 도 prompt.ts 에서 import (재물 4궁 보좌성·잡요성 포함된 현재 출력).
// 기존 buildSajuPrompt 동작/시그니처 0 변경.

import { SYSTEM_BASE, formatZiweiBlock } from "./prompt";
import type { Myeongsik } from "./manseryeok";
import type { ZiweiSummary } from "./ziwei";

export type WealthPromptInput = {
  /** 상품명 (선택, 표시용) */
  productName?: string;
  /** 4기둥 (천간지지) */
  myeongsik: Myeongsik;
  /** luckyloveme 풀 분석 한국어 텍스트 (16종) */
  manseryeokText: string;
  /** "YYYY-MM-DD" */
  birthDate: string;
  /** "HH:mm" 또는 null (시 미상) */
  birthTime: string | null;
  gender: "male" | "female";
  /** 자미두수 명반 — 필수. 시 미상 시 호출처가 호출 안 함. */
  ziwei: ZiweiSummary;
};

export type WealthSections = {
  signature: string;
  bigPicture: string;
  manifestation: string;
  crossReading: string;
  timing: string;
};

const WEALTH_KEYS: readonly (keyof WealthSections)[] = [
  "signature",
  "bigPicture",
  "manifestation",
  "crossReading",
  "timing",
] as const;

/**
 * LLM 응답 obj → 검증된 5필드 객체.
 * 모든 필드가 비어있지 않은 string 일 때만 반환. 빈 string 1개라도 있으면 null.
 * (관대 검증: signature 의 "OO형" 패턴 등은 호출처/스크립트에서 사후 검증.)
 */
export function parseWealthSections(obj: unknown): WealthSections | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const out: Partial<WealthSections> = {};
  for (const k of WEALTH_KEYS) {
    if (typeof o[k] !== "string") return null;
    if (!(o[k] as string).trim()) return null; // 빈 string 거부
    out[k] = o[k] as string;
  }
  return out as WealthSections;
}

// ─────────────────────────────────────────────────────
// 4블록 지시문 (사용자 사양 그대로)
// ─────────────────────────────────────────────────────
const WEALTH_INSTRUCTION_BLOCKS = `
[재물 분석 규칙]

A. 고정 프레임
- 재물만 분석합니다. 연애/건강/직업 등 다른 영역 풀이는 금지.
- 5필드(signature/bigPicture/manifestation/crossReading/timing)를 순서대로 작성합니다.
- 앞 필드를 이어받아 다음 필드에서 구체화하세요.
- 빈 필드 절대 금지 — 모든 필드에 의미 있는 본문을 채우세요.

B. 사주 ↔ 자미두수 교차 강제 (가장 중요)
- crossReading 필드는 "사주에선 ~인데, 자미두수로 보면 ~" 구조의 문장을 최소 2개 포함합니다.
- 각 교차 문장에 결론을 명시합니다:
  · 같은 방향 → "두 점법이 같은 곳을 가리키니 거의 확실해요" 식 문구.
  · 엇갈림   → "사주는 A, 자미두수는 B → 이렇게 보완돼요" 식 문구.
- 자미두수만 별도 단락으로 분리하지 마세요 (나열 금지). 사주와 같은 문장 안에서 엮으세요.
- 사주 재물 재료: 정재·편재·식상·재고귀인·대운.
- 자미두수 재물 재료: 재백·전택·복덕·관록 4궁의 주성·보좌성(보)·잡요성(잡).
  * (보)/(잡) 라벨은 별 분류 표시일 뿐 본문에 그대로 노출하지 마세요.

C. 시그니처 강제
- signature 필드는 반드시 "OO형"이라는 라벨이 **문장 맨 앞**에 와야 합니다. 분량을 늘려도 이 규칙은 절대 불변.
- 라벨을 문장 중간이나 끝에 두는 것 금지.
  · 금지: "지혜를 품고 기회를 낚아채는 지식금고형이에요"
  · 권장: "지식금고형이에요. 지혜를 품고 기회를 낚아채는 기질이 있어요"
- "OO형" 라벨 예시: "씨앗저축형", "흐름타기형", "재고침묵형".
- 진부한 라벨 금지: 대박형, 고생형, 부자형, 평범형 등.

H. 문장 스타일 (AI 냄새 제거 — 최우선)
- 단정문으로 씁니다. "~일 수 있어요", "~수도 있어요", "~일지 몰라요" 같은 비단정 어미는 금지.
- 두리 친근 어미는 유지: ~예요 / ~네요 / ~봐요 / ~드릴게요.
- 두괄식. 각 필드의 첫 문장에서 결론부터 던집니다.
- 검증 가능한 구체 행동 단정 금지. 바로 "맞다/틀리다"로 갈리는 행동을 단정하지 마세요. **금융 행동 용어("포트폴리오 재편", "적금 든다", "주식을 산다", "코인 투자한다" 등)도 동일하게 금지** — 사용자가 실제로 그렇게 하는지 검증 가능한 행동입니다.
  · 금지: "통장을 쪼개 관리해요" / "10원 단위로 장부 써요" / "부동산을 산다" / "보험을 든다" / "포트폴리오로 재편한다"
  · 권장: "안정적인 자산으로 무게중심이 옮겨가는 흐름" / "안전 쪽으로 기울어요"
- 대신 기질·경향·조건부·모순형으로 써주세요:
  · 기질: "안정적인 쪽을 편하게 느껴요"
  · 모순형: "평소엔 아끼는데 꽂히면 확 써요"
  · 조건부: "~한 상황이 오면 ~하는 쪽으로 기울어요"
- 핵심: 누구나 자기 얘기로 읽을 수 있되, 기질의 방향은 분명하게.
- 모순형 문장 최소 1개 포함. "평소엔 ~인데 막상 ~할 땐 ~해요" 같은 구조.
- 한 문장에 한 내용만 담으세요.
- 명리·자미두수 용어 노출 OK. 단 한 문장에 별 이름 3개 이상 금지.
- 금지 표현: 현모양처, 모성애, 따님분, 회원님, 고객님 등 시대착오/호칭 오류.
- [강조 부사 절제] 강조 부사("철저하게", "완벽하게", "치열하게", "빈틈없이", "강하게", "꼼꼼히", "굵직한", "쏟아지는", "튼튼한", "강렬한", "단단히" 등)는 **100자당 1개 이하** (필드 길이 비례). 분량이 늘어도 비율은 유지하세요. 부사로 힘주지 말고 행동·사실로 말하세요.
- [풀이 자기칭찬 금지] 풀이 자체를 칭찬하는 표현 금지. 교차 결론은 담백하게.
  · 금지: "입체적으로 맞물려요", "절묘하게 교차해요", "완벽하게 보완돼요", "환상적으로 채워줘요", "멋진 구조"
  · 권장: "서로 채워줘요", "같은 곳을 가리켜요", "맞물려요" (수식 없이)
- [인사말 누수 금지] 어느 필드에도 인사말("안녕! 두리예요", "오늘은 ~ 살펴볼게요" 등)을 넣지 마세요. bigPicture 는 첫 문장부터 재물 결론으로 두괄식 시작합니다.
- [번역투·문어체 금지] 블로그 운세톤 X. 두리의 자연스러운 입말(구어)로.
  · 금지: "재물이 샘솟는", "심리적 안정을 얻습니다", "재물 형태가 바뀌면서"
  · 권장: "통장이 차오르는", "마음이 놓여요", "돈의 모양이 바뀌어요"
- [호칭 규칙] 재물 영역에서는 호칭을 쓰지 않습니다 — "그대", "OO님", "당신" 등 호칭 금지. 주어를 생략하고 바로 서술하세요.
  · 금지: "그대는 통장을 쪼개 관리해요"
  · 권장: "통장을 쪼개 관리해요"

I. 검증가능 정보 금지
- 결과 단정 금지: "사업으로 큰돈 번다", "부동산 부자 된다", "올해 5천 번다" 등.
- 경향 서술로: "~하는 기질이 있어요", "~로 흐르기 쉬워요", "~한 방식이 잘 맞아요".

D. 분량 규칙 (목표 5필드 합 2,500~3,000자)
- 5필드 합쳐 2,500~3,000자를 목표로 작성합니다. 2,500자 넘으면 합격, 3,000자 채우려고 무리하지 말 것.
- 분량은 다음 4가지 방법으로만 늘립니다:
  1) crossReading 교차 사례를 3~4건으로 늘립니다. 사주 재료와 자미두수 재료를 더 많이 동원해 교차하세요.
  2) 지금까지 안 쓴 사주 재료를 더 활용합니다 — 십성(정재/편재/식상/비겁/인성/관성), 대운, 신살(재고귀인/도화살/화개살 등), 귀인을 근거로.
  3) timing을 2026~2030년 흐름으로 확장합니다. 단 연도별 검증가능한 단정은 금지("2027년 5천만원 번다" 등). 기운·흐름 수준으로만 풀어주세요.
  4) 각 필드에 "왜 그런지" 명리·자미두수 근거를 1줄씩 더 보강합니다. 근거 비중 약 20%.
- 분량 늘릴 때 절대 금지:
  · 부사로 늘리기 (강조 부사는 여전히 필드당 1개 이하).
  · 같은 내용 반복/다른 말로 재진술.
  · 일반론·추상 형용사로 채우기.
  · 검증가능 행동 단정 추가 (통장/장부/매매 등 — H 블록 0건 유지).
  · 호칭/인사 추가 (그대/OO님/안녕 등 — H 블록 0건 유지).

[톤]
- 두리 (말티즈, 다정한 어미).
- 20대 여성 독자.
- 위로보다 묘사가 메인. 공감만 늘어놓지 마세요.
`;

const WEALTH_SCHEMA_INSTRUCTION = `
[출력 형식 — 매우 중요]
반드시 아래 JSON 객체 하나로만 응답합니다. 코드블록 마커(\`\`\`json 등) 없이, { 로 시작해 } 로 끝나는 순수 JSON 문자열만 출력합니다:

{
  "signature": "재물 시그니처. 반드시 'OO형' 라벨로 시작하는 1~2문장.",
  "bigPicture": "돈이 들어오고 나가는 기본 방식의 큰 틀.",
  "manifestation": "일상의 행동·현상으로 드러나는 구체 발현.",
  "crossReading": "사주와 자미두수의 교차 해석. '사주에선 ~인데, 자미두수로 보면 ~' 구조 문장 최소 2개.",
  "timing": "시기 관련 흐름. 검증 가능한 결과 단정 금지."
}

각 필드는 빈 string 절대 금지. 마크다운(**굵게**, 불릿 등) 사용 가능.
JSON 구조는 깨지지 않게 escape 처리. JSON 외 다른 텍스트(설명·머리말·코드블록 마커) 절대 추가 금지.
`;

/**
 * 재물 영역 전용 prompt 빌더.
 *   system: SYSTEM_BASE (두리 톤 공통)
 *   user:   사주 풀 명식 + 자미두수 명반 + 4블록 규칙 + JSON 스키마
 */
export function buildWealthPrompt(input: WealthPromptInput): {
  system: string;
  user: string;
} {
  const today = new Date().toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const ziweiBlock = formatZiweiBlock(input.ziwei);

  const user = `[현재 시점]
오늘은 ${today}이에요.

[상품] ${input.productName ?? "재물 풀이"}
[분석 영역] 재물 전용 (다른 영역 풀이 금지)

[사주 풀 명식]
${input.manseryeokText}

${ziweiBlock}

[기본 정보]
- 생년월일: ${input.birthDate}${input.birthTime ? ` ${input.birthTime}` : " (시 미상)"}
- 성별: ${input.gender === "male" ? "남성" : "여성"}

${WEALTH_INSTRUCTION_BLOCKS}
${WEALTH_SCHEMA_INSTRUCTION}`;

  return { system: SYSTEM_BASE, user };
}
