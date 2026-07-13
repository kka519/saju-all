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
import { buildReportPart1Prompt, parseReportPart1Sections, type ReportPart1Sections } from "./part1-overview";
import { buildReportPart2Prompt, parseReportPart2Sections, type ReportPart2Sections } from "./part2-backtest";
import { buildReportPart3Prompt, parseReportPart3Sections, type ReportPart3Sections } from "./part3-cycle";
import { buildReportPart4Prompt, parseReportPart4Sections, type ReportPart4Sections } from "./part4-strategy";

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
): Promise<{ sections: T; provider: string; model: string }> {
  let lastText = "";
  let lastError: unknown;
  let provider = "";
  let model = "";
  const MAX_ATTEMPTS = 3;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const { system, user } = build();
      const llm = await generateInterpretation({
        system,
        user,
        maxTokens,
        provider: REPORT_LLM_PROVIDER,
        model: REPORT_LLM_MODEL,
      });
      lastText = llm.text;
      provider = llm.provider;
      model = llm.model;
      const obj = extractJsonObject(llm.text);
      const parsed = obj ? parse(obj) : null;
      if (parsed) return { sections: parsed, provider, model };
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
    callWithRetry("PART I", () => buildReportPart1Prompt(data), parseReportPart1Sections, 20000),
    callWithRetry("PART II", () => buildReportPart2Prompt(data), parseReportPart2Sections, 12288),
    callWithRetry("PART III", () => buildReportPart3Prompt(data), parseReportPart3Sections, 20000),
    callWithRetry("PART IV·V", () => buildReportPart4Prompt(data), parseReportPart4Sections, 20000),
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
