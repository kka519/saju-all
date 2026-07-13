// =====================================================
// 4파트 LLM 호출 오케스트레이터
// =====================================================
// 파트별 JSON 파싱 실패 시 재시도(IMPLEMENTATION_SPEC.md §3-3).
//
// 병렬 호출(Promise.all) — 레퍼런스 대조 후 파트별 출력 분량을 대폭 늘리면서
// 순차 실행으로는 Claude 기준 LLM만 4~7분이 걸려 Vercel maxDuration(300s)을
// 초과할 위험이 생김. 병렬이면 벽시계 시간 = 가장 긴 파트 1개 분량으로 압축.
// 진행률은 파트별 세분화 대신 "llm_parts" 단일 스테이지로 보고.

import { generateInterpretation } from "@/lib/saju/llm";
import type { ReportData } from "../normalize";
import { extractJsonObject } from "./extract-json";
import { buildReportPart1Prompt, parseReportPart1Sections, validatePart1, type ReportPart1Sections } from "./part1-overview";
import { buildReportPart2Prompt, parseReportPart2Sections, validatePart2, type ReportPart2Sections } from "./part2-backtest";
import { buildReportPart3Prompt, parseReportPart3Sections, validatePart3, type ReportPart3Sections } from "./part3-cycle";
import { buildReportPart4Prompt, parseReportPart4Sections, validatePart4, type ReportPart4Sections } from "./part4-strategy";

// 인생 애널리스트 리포트는 Anthropic(Claude)로 고정 — 나머지 상품(무료운세/재물 등)은
// .env.local 의 LLM_PROVIDER(Gemini)를 그대로 따름. 톤/정확도 비교 결과 이 리포트만
// Claude 품질이 더 맞아서 provider 를 여기서만 오버라이드.
const REPORT_LLM_PROVIDER = "anthropic" as const;
const REPORT_LLM_MODEL = "claude-sonnet-5";

export type ReportSections = {
  part1: ReportPart1Sections;
  part2: ReportPart2Sections;
  part3: ReportPart3Sections;
  part4: ReportPart4Sections;
  llmProvider: string;
  llmModel: string;
};

async function callWithRetry<T>(
  partName: string,
  build: () => { system: string; user: string },
  parse: (obj: unknown) => T | null,
  maxTokens: number,
  validate?: (sections: T) => string[],
): Promise<{ sections: T; provider: string; model: string }> {
  let lastText = "";
  let lastError: unknown;
  let provider = "";
  let model = "";
  // 직전 시도의 규칙 위반 사유 — 재시도 프롬프트에 [재생성 지시]로 주입 (환각 게이트와 동일 방식).
  let prevIssues: string[] = [];
  // 용어/분량 게이트 도입 후 4회로 상향 — 위반이 많은 첫 시도에서 수렴까지 여유 1회 추가.
  const MAX_ATTEMPTS = 4;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const { system, user } = build();
      const userFinal =
        prevIssues.length > 0
          ? `${user}

[재생성 지시 — 직전 응답이 아래 규칙을 위반했다. 모두 수정해 전체 JSON을 다시 작성하라]
- ${prevIssues.join("\n- ")}
분량 미달 필드는 일반론·수사로 채우지 말고 입력 JSON의 수치·간지·십신 근거를 인용해 구체적으로 서술하라.`
          : user;
      const llm = await generateInterpretation({
        system,
        user: userFinal,
        maxTokens,
        provider: REPORT_LLM_PROVIDER,
        model: REPORT_LLM_MODEL,
      });
      lastText = llm.text;
      provider = llm.provider;
      model = llm.model;
      const obj = extractJsonObject(llm.text);
      const parsed = obj ? parse(obj) : null;
      if (!parsed) {
        prevIssues = ["JSON 스키마 불일치 — 지정된 필드 구성/최소 항목 수를 정확히 지켜라"];
        continue;
      }
      const issues = validate ? validate(parsed) : [];
      if (issues.length === 0) return { sections: parsed, provider, model };
      prevIssues = issues;
      lastError = new Error(`용어/분량 규칙 위반 ${issues.length}건: ${issues.slice(0, 5).join(" / ")}`);
    } catch (err) {
      // 네트워크/일시적 API 오류(fetch failed, 503 등) — JSON 파싱 실패와 동일하게 재시도 대상.
      lastError = err;
    }
  }
  const detail =
    lastError instanceof Error
      ? lastError.message
      : `JSON 파싱/검증 실패. 마지막 응답 앞 500자: ${lastText.slice(0, 500)}`;
  throw new Error(`리포트 ${partName} 생성 실패 — ${MAX_ATTEMPTS}회 연속 실패. ${detail}`);
}

export type StageCallback = (stage: string) => Promise<void> | void;

export async function generateAllSections(
  data: ReportData,
  onStage?: StageCallback,
): Promise<ReportSections> {
  await onStage?.("llm_parts");

  // maxTokens 는 한글 출력 특성(글자당 1~2토큰)을 감안해 넉넉히 — 12288에서 PART III가
  // 배열 중간에 잘려 3회 연속 파싱 실패한 실측 사례 있음.
  const [p1, p2, p3, p4] = await Promise.all([
    callWithRetry("PART I", () => buildReportPart1Prompt(data), parseReportPart1Sections, 20000, validatePart1),
    callWithRetry("PART II", () => buildReportPart2Prompt(data), parseReportPart2Sections, 12288, validatePart2),
    callWithRetry("PART III", () => buildReportPart3Prompt(data), parseReportPart3Sections, 20000, validatePart3),
    callWithRetry("PART IV·V", () => buildReportPart4Prompt(data), parseReportPart4Sections, 20000, validatePart4),
  ]);

  return {
    part1: p1.sections,
    part2: p2.sections,
    part3: p3.sections,
    part4: p4.sections,
    llmProvider: p4.provider,
    llmModel: p4.model,
  };
}
