// =====================================================
// 4파트 LLM 호출 오케스트레이터
// =====================================================
// 파트별 JSON 파싱 실패 시 재시도(IMPLEMENTATION_SPEC.md §3-3).
//
// 병렬 호출(Promise.all) — 레퍼런스 대조 후 파트별 출력 분량을 대폭 늘리면서
// 순차 실행으로는 Claude 기준 LLM만 4~7분이 걸려 Vercel maxDuration(300s)을
// 초과할 위험이 생김. 병렬이면 벽시계 시간 = 가장 긴 파트 1개 분량으로 압축.
// 진행률은 파트별 세분화 대신 "llm_parts" 단일 스테이지로 보고.
//
// 재시도 정책(2026-07 개편):
// - 용어 위반은 재생성하지 않는다 — sanitize 단계에서 자동 치환 후 통과시킨다.
// - 분량 미달만 재생성 대상. 재시도 시 직전 실패 필드/실제 글자수를 프롬프트에 명시.
// - 파트당 재시도 최대 2회(총 3회 시도). 그래도 미달이면 시도본 중 이슈가 가장
//   적은(동률이면 더 긴) 것을 "최선본"으로 채택하고 경고 로그만 남긴다 — 생성
//   실패로 전체를 막지 않는다. JSON 파싱 자체가 매 시도 실패한 경우에만 예외를 던진다.

import * as fs from "node:fs";
import * as path from "node:path";
import { generateInterpretation } from "@/lib/saju/llm";
import type { ReportData } from "../normalize";
import { extractJsonObject } from "./extract-json";
import { buildReportPart1Prompt, parseReportPart1Sections, sanitizePart1, type ReportPart1Sections } from "./part1-overview";
import { buildReportPart2Prompt, parseReportPart2Sections, sanitizePart2, type ReportPart2Sections } from "./part2-backtest";
import { buildReportPart3Prompt, parseReportPart3Sections, sanitizePart3, type ReportPart3Sections } from "./part3-cycle";
import { buildReportPart4Prompt, parseReportPart4Sections, sanitizePart4, type ReportPart4Sections } from "./part4-strategy";

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

type CallResult<T> = { sections: T; provider: string; model: string };

// 초기 시도 1회 + 재시도 2회 = 총 3회.
const MAX_ATTEMPTS = 3;

async function callWithRetry<T>(
  partName: string,
  build: () => { system: string; user: string },
  parse: (obj: unknown) => T | null,
  maxTokens: number,
  sanitize: (parsed: T) => { sections: T; issues: string[] },
): Promise<CallResult<T>> {
  let lastText = "";
  let everParsed = false;
  let provider = "";
  let model = "";
  // 직전 시도의 분량 미달 사유 — 재시도 프롬프트에 [재생성 지시]로 주입.
  let prevIssues: string[] = [];
  // 시도들 중 이슈가 가장 적은(동률이면 총 글자수가 더 긴) 것을 최선본으로 보관.
  let best: { sections: T; issues: string[]; totalChars: number } | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const { system, user } = build();
      const userFinal =
        prevIssues.length > 0
          ? `${user}

[재생성 지시 — 직전 응답이 아래 분량 하한을 충족하지 못했다. 해당 필드만 목표 분량에 맞게 다시 작성하라]
- ${prevIssues.join("\n- ")}
일반론·수사로 채우지 말고 입력 JSON의 수치·간지·십신 근거를 더 인용해 구체적으로 서술하라.`
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
      everParsed = true;
      const { sections, issues } = sanitize(parsed);
      if (issues.length === 0) return { sections, provider, model };

      const totalChars = JSON.stringify(sections).length;
      if (!best || issues.length < best.issues.length || (issues.length === best.issues.length && totalChars > best.totalChars)) {
        best = { sections, issues, totalChars };
      }
      prevIssues = issues;
    } catch {
      // 네트워크/일시적 API 오류(fetch failed, 503 등) — JSON 파싱 실패와 동일하게 재시도 대상.
      prevIssues = [];
    }
  }

  if (best) {
    console.warn(
      `[report retry] ${partName} — ${MAX_ATTEMPTS}회 시도 후에도 분량 미달 ${best.issues.length}건 잔존. 최선본 채택: ${best.issues.join(" / ")}`,
    );
    return { sections: best.sections, provider, model };
  }

  const detail = everParsed
    ? "sanitize 단계 이상 — best 후보가 존재해야 하는데 없음(내부 로직 오류)"
    : `JSON 파싱 실패. 마지막 응답 앞 500자: ${lastText.slice(0, 500)}`;
  throw new Error(`리포트 ${partName} 생성 실패 — ${MAX_ATTEMPTS}회 연속 실패. ${detail}`);
}

export type StageCallback = (stage: string) => Promise<void> | void;

/**
 * cacheDir 를 넘기면 파트별 성공 결과를 sections_part*.json 으로 캐시하고,
 * 다음 실행에서 이미 캐시된 파트는 LLM 재호출 없이 재사용한다 — 특정 파트만
 * 실패했을 때 성공한 나머지 파트까지 전부 재생성하는 낭비를 막기 위함.
 */
async function withCache<T>(
  cacheDir: string | undefined,
  key: string,
  run: () => Promise<CallResult<T>>,
): Promise<CallResult<T>> {
  if (cacheDir) {
    const file = path.join(cacheDir, `sections_${key}.json`);
    if (fs.existsSync(file)) {
      console.warn(`[report cache] ${key} 캐시 재사용: ${file}`);
      return JSON.parse(fs.readFileSync(file, "utf-8")) as CallResult<T>;
    }
  }
  const result = await run();
  if (cacheDir) {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, `sections_${key}.json`), JSON.stringify(result, null, 2));
  }
  return result;
}

export async function generateAllSections(
  data: ReportData,
  onStage?: StageCallback,
  opts?: { cacheDir?: string },
): Promise<ReportSections> {
  await onStage?.("llm_parts");
  const cacheDir = opts?.cacheDir;

  // maxTokens 는 한글 출력 특성(글자당 1~2토큰)을 감안해 넉넉히 — 12288에서 PART III가
  // 배열 중간에 잘려 3회 연속 파싱 실패한 실측 사례 있음.
  const [p1, p2, p3, p4] = await Promise.all([
    withCache(cacheDir, "part1", () =>
      callWithRetry("PART I", () => buildReportPart1Prompt(data), parseReportPart1Sections, 20000, sanitizePart1),
    ),
    withCache(cacheDir, "part2", () =>
      callWithRetry("PART II", () => buildReportPart2Prompt(data), parseReportPart2Sections, 12288, sanitizePart2),
    ),
    withCache(cacheDir, "part3", () =>
      callWithRetry("PART III", () => buildReportPart3Prompt(data), parseReportPart3Sections, 20000, (parsed) =>
        sanitizePart3(parsed, data.wolun),
      ),
    ),
    withCache(cacheDir, "part4", () =>
      callWithRetry("PART IV·V", () => buildReportPart4Prompt(data), parseReportPart4Sections, 20000, sanitizePart4),
    ),
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
