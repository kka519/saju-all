// =====================================================
// 사주 해석 프롬프트 빌더
// =====================================================
// 상품 slug 별로 톤/분량을 다르게. 수강생은 여기서 본인 톤으로 갈아끼우면 됩니다.

import type { Myeongsik } from "./manseryeok";
import type { ZiweiSummary } from "./ziwei";

export type PromptInput = {
  productSlug: string;
  productName: string;
  myeongsik: Myeongsik;
  // luckyloveme 풀 분석이 있으면 4기둥 자리 대신 이 텍스트(천간지지/십성/대운/세운/12운성/신살 등 16종)로 교체.
  // 없으면(데모 / 호출 실패 fallback) 단순 4기둥만 포함.
  manseryeokText?: string;
  birthDate: string;
  birthTime: string | null;
  timeUnknown: boolean;
  gender: "male" | "female";
  concerns: string[];
  // 자미두수 명반 — 4개 상품(love-saju, couple-match, love-consulting, premium-saju) +
  // 시 미상 아님 일 때만 채워짐. 없으면 자미두수 블록 미포함 (저가 상품/시 미상 영향 0).
  ziwei?: ZiweiSummary;
};

// ─────────────────────────────────────────────────────
// 자미두수 명반 → 프롬프트 텍스트 블록
// ─────────────────────────────────────────────────────
// LLM이 사주 명식과 교차 해석할 수 있도록 핵심 정보만 요약 (토큰 절약).
// 주성 + 사화 부착 위치 중심 — 잡요성은 노이즈가 많아 제외.
function formatZiweiBlock(ziwei: ZiweiSummary): string {
  const palacesLine = ziwei.palaces
    .map((p) => {
      const stars = p.majorStars
        .map((s) => `${s.name}${s.mutagen ? `(${s.mutagen})` : ""}`)
        .join("·");
      return `  - ${p.name}(${p.earthlyBranch}): ${stars || "(주성 없음)"}`;
    })
    .join("\n");

  // 사화(록/권/과/기) 위치 별도 추출 — 주성·보좌성 둘 다 검사
  const mutagens: Array<{ type: string; star: string; palace: string }> = [];
  for (const p of ziwei.palaces) {
    for (const s of [...p.majorStars, ...p.minorStars]) {
      if (s.mutagen) {
        mutagens.push({ type: s.mutagen, star: s.name, palace: `${p.name}/${p.earthlyBranch}` });
      }
    }
  }
  const mutagenOrder = ["록", "권", "과", "기"];
  mutagens.sort((a, b) => mutagenOrder.indexOf(a.type) - mutagenOrder.indexOf(b.type));
  const mutagenLine =
    mutagens.length > 0
      ? mutagens.map((m) => `화${m.type}=${m.star}(${m.palace})`).join(", ")
      : "(사화 없음)";

  return [
    `[자미두수 명반]`,
    `- 명궁: ${ziwei.soulPalaceBranch}, 신궁: ${ziwei.bodyPalaceBranch}`,
    `- 명주: ${ziwei.soul}, 신주: ${ziwei.body}, 오행국: ${ziwei.fiveElementsClass}`,
    `- 12궁 주성:`,
    palacesLine,
    `- 사화: ${mutagenLine}`,
  ].join("\n");
}

export const SYSTEM_BASE = `당신은 "두리"입니다. 별에서 온 말티즈 영물로, 루나쌤한테 13년 명리학을 배웠어요. 평소엔 귀엽고 친근하지만, 사주를 풀 때는 진지해져요. 사용자의 사주를 풀어주는 화자로서 글을 씁니다.

[캐릭터·말투]
- 1인칭은 "두리"로 씁니다 (예: "두리가 봐드릴게요").
- 문장 끝은 반드시 ~예요 / ~네요 / ~봐요 / ~드릴게요 같은 친근 존댓말로 마무리합니다. "~합니다", "~십니다" 같은 격식 어미는 절대 쓰지 않습니다.
- 사용자 호칭: 이름이 주어졌다면 "○○님", 없으면 "그대" 또는 "당신"을 씁니다. "따님분", "고객님", "회원님" 같은 호칭은 절대 쓰지 않습니다 — 사용자 본인의 사주를 풀어드리는 자리예요.

[글의 시작과 끝]
- 첫 문장은 두리의 짧은 인사로 시작합니다 (예: "안녕! 두리예요. 오늘은 그대 사주를 살짝 들여다볼게요").
- 마지막 문장은 두리의 따뜻한 마무리 인사로 닫습니다 (예: "그대의 별이 오늘도 잘 빛나길 바라요", "두리가 응원하고 있을게요").

[해석 톤]
- 정확성은 그대로 유지하되, 따뜻한 해석으로 풀어주세요. 13년 명리학 깊이는 단어 선택과 디테일에서 자연스럽게 드러나도록 합니다.
- 흉운·약점·갈등을 가릴 필요는 없습니다. 있는 그대로 알려드리되, 그 뒤에 반드시 "이렇게 대비하면 돼요" 식의 구체적인 행동 조언으로 마무리합니다.
- 단정적인 운명론은 피하고, 가능성·경향성으로 표현합니다 ("~할 수도 있어요", "~한 시기예요").
- 점성·주술적 권유나 비과학적 단정은 하지 않습니다.

[현재 시점]
- 현재 날짜는 user 프롬프트의 [현재 시점] 블록에 명시된 날짜를 기준으로 합니다.
- LLM 학습 데이터 시점이 아니라 사용자가 알려준 "오늘"을 기준으로 세운(연운), "올해", "이번 시기", "최근 흐름" 등을 해석하세요.
- 시기 관련 표현("올해 운세", 대운·세운, "요즘", "올 한 해")은 반드시 user의 오늘 날짜를 기준으로 풀이합니다. 학습 데이터의 마지막 연도(예: 2024)를 사용하면 안 됩니다.

[형식]
- 한국어로 작성합니다.
- 마크다운 헤딩(##, ###)과 불릿을 적극 사용해 가독성을 높입니다.
- 풀이 본문은 진지하게, 인사와 마무리는 두리답게 친근하게 — 이 반전 톤이 두리만의 색이에요.`;

// PRD §5.1 순서 (9개 라인업) — 가격대별 분량/포커스 차등.
const STYLE_BY_SLUG: Record<string, { length: string; focus: string }> = {
  "today-fortune": {
    length: "2-3문장",
    focus: "오늘 하루의 흐름과 작은 행동 팁 1개",
  },
  "love-style": {
    length: "500-700자",
    focus: "본인 연애 스타일 — 십성 기반 감정 표현·끌리는 유형, 신강신약 기반 리드/팔로우 성향, 사랑할 때 자주 나오는 행동 패턴",
  },
  "solo-fate": {
    length: "600-800자",
    focus: "인연이 들어오는 시기 — 대운 흐름으로 본 만남의 큰 시기, 홍염살·도화살의 발현 강도와 시점, 지금 솔로 기간의 의미",
  },
  "crush": {
    length: "600-800자",
    focus: "짝사랑 진전 가능성 — 본인 홍염·도화 기반 매력 발산 강도, 사주 합충 패턴으로 본 인연 끌어당김 경향, 다가가기 좋은 시기와 방식",
  },
  "love-saju": {
    length: "900-1200자",
    focus: "연애 패턴, 잘 맞는 상대 유형, 갈등 패턴, 현재 관계 조언",
  },
  "couple-match": {
    length: "700-900자",
    focus: "커플 궁합 — 두 명식의 합충 비교(있다면 활용), 일간 상생상극, 십성 보완 관계로 본 관계 흐름과 갈등 포인트, 관계 발전 시기",
  },
  "basic-saju": {
    length: "600-900자",
    focus: "기본 성향, 강점, 보완점, 올해의 흐름",
  },
  "love-consulting": {
    length: "1500-2000자",
    focus: "사주 기반 연애 종합 컨설팅(메인 상품) — 풀 명식 16종 적극 활용, 현재 시기 인연·관계 흐름(대운·세운), 본인 강점과 갈등 패턴, 단계별 행동 조언(말 거는 법·만남 시점·관계 유지 전략)",
  },
  "premium-saju": {
    length: "1500-2000자",
    focus: "대운/세운 흐름, 직업운, 재물운, 건강운, 인간관계 종합",
  },
};

export function buildSajuPrompt(input: PromptInput): { system: string; user: string } {
  const today = new Date().toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const style = STYLE_BY_SLUG[input.productSlug] ?? STYLE_BY_SLUG["basic-saju"];
  const m = input.myeongsik;
  const pillar = (p: { cheongan: string; jiji: string } | null) =>
    p ? `${p.cheongan}${p.jiji}` : "(시 미상)";

  // 풀 분석 텍스트가 있으면 그걸 우선 사용, 없으면 단순 4기둥
  const sajuSection = input.manseryeokText
    ? `[사주 풀 명식]\n${input.manseryeokText}`
    : [
        `[사주 4기둥]`,
        `- 년주: ${pillar(m.year)}`,
        `- 월주: ${pillar(m.month)}`,
        `- 일주: ${pillar(m.day)}`,
        `- 시주: ${pillar(m.hour)}`,
      ].join("\n");

  // 자미두수 명반 블록 (있을 때만, 자미두수 4개 상품 + 시 미상 아닐 때만 채워짐)
  const ziweiSection = input.ziwei ? `\n\n${formatZiweiBlock(input.ziwei)}` : "";
  const ziweiInstruction = input.ziwei
    ? " 위 자미두수 명반은 참고 자료예요. 사주 명식과 교차해, 일치하는 해석은 강조하고 보완 정보로 활용하되 두리 톤은 유지하세요."
    : "";

  const user = `[현재 시점]
오늘은 ${today}이에요.

[상품] ${input.productName}
[분량] 약 ${style.length}
[핵심 포커스] ${style.focus}

${sajuSection}${ziweiSection}

[기본 정보]
- 생년월일: ${input.birthDate}${input.timeUnknown ? " (시 미상)" : input.birthTime ? ` ${input.birthTime}` : ""}
- 성별: ${input.gender === "male" ? "남성" : "여성"}
- 고민 키워드: ${input.concerns.length > 0 ? input.concerns.join(", ") : "(미입력)"}

위 정보를 바탕으로 마크다운 리포트를 작성해 주세요.${
    input.manseryeokText
      ? " 천간지지/십성/대운/세운/신살 등 풀 명식 정보를 적극 활용하되, 단정적 표현은 피하고 가능성/경향으로 풀어 주세요."
      : ""
  }${ziweiInstruction}`;

  return { system: SYSTEM_BASE, user };
}
