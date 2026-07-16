// =====================================================
// 커플 궁합 리포트 — 본편 콘텐츠 생성(재시도 포함)
// =====================================================
// life-analyst-report의 callWithRetry 패턴을 커플용으로 경량화: 파싱 실패/게이트
// 위반 시 재생성(최대 2회), 용어 위반은 재생성 없이 sanitizeCoupleSections로 즉시 교정.
// 리포트 런타임 모델: Sonnet 고정(기획서 §0, 원가 전제).

import { generateInterpretation } from "@/lib/saju/llm";
import {
  buildCoupleContentPrompt,
  extractAndParseCoupleJSON,
  validateCoupleSections,
  sanitizeCoupleSections,
  type CoupleContentPromptInput,
  type CoupleSections,
} from "./prompts";

const MAX_ATTEMPTS = 2;
// 23필드(케미스트리 8블록 포함) 목표 분량 총합이 약 8,700자. 32000으로도 생성 편차에
// 따라 가끔 완결 전에 잘리는 것이 실측 확인돼(2026-07-15) 여유를 더 크게 둔다.
const MAX_TOKENS = 48000;

export type CoupleGenerateResult = {
  sections: CoupleSections;
  provider: string;
  model: string;
  remainingIssues: string[];
  sanitizedTerms: string[];
};

export async function generateCoupleContentWithRetry(
  input: CoupleContentPromptInput,
): Promise<CoupleGenerateResult> {
  const { system, user, typeNames, relationshipType } = buildCoupleContentPrompt(input);

  let lastIssues: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const llm = await generateInterpretation({
      system,
      user: attempt === 1 ? user : `${user}\n\n[이전 시도 위반 사항 — 반드시 고쳐서 다시 작성]\n${lastIssues.join("\n")}`,
      provider: "anthropic",
      model: "claude-sonnet-5",
      maxTokens: MAX_TOKENS,
    });

    const parsed = extractAndParseCoupleJSON(llm.text);
    if (!parsed) {
      if (attempt === MAX_ATTEMPTS) {
        throw new Error(
          `커플 리포트 생성 실패 — ${MAX_ATTEMPTS}회 시도 모두 JSON 파싱 실패. 마지막 원문 길이: ${llm.text.length}자, 끝부분: ${llm.text.slice(-200)}`,
        );
      }
      lastIssues = ["JSON 파싱 실패 — 스키마대로 순수 JSON 객체만 응답할 것"];
      continue;
    }

    const { sections: sanitized, replaced } = sanitizeCoupleSections(parsed);
    const issues = validateCoupleSections(sanitized, input.matrix, input.seunSeries, input.names, typeNames, relationshipType);

    // 용어 위반은 sanitize로 이미 교정됐으니 재검사에서 제외 — 세운/호칭/일간인용/분량만
    // 남은 위반이면 재시도, 그마저 다 없으면 통과.
    if (issues.length === 0 || attempt === MAX_ATTEMPTS) {
      return {
        sections: sanitized,
        provider: llm.provider,
        model: llm.model,
        remainingIssues: issues,
        sanitizedTerms: replaced,
      };
    }
    lastIssues = issues;
  }

  throw new Error("unreachable");
}
