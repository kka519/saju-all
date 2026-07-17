// =====================================================
// LLM 프로바이더 스위치
// =====================================================
// LLM_PROVIDER 환경변수로 openai | anthropic | gemini 선택.
// 각 SDK는 lazy import 하여 미사용 패키지의 init 비용을 줄임.

import { serverEnv } from "@/lib/env";

export type LlmProvider = "openai" | "anthropic" | "gemini";

export type LlmRequest = {
  system: string;
  user: string;
  /** 기본 2048(Anthropic 하드코딩 값과 동일 유지). 인생 애널리스트 리포트처럼 긴 출력이 필요하면 상향. */
  maxTokens?: number;
  /** 기본은 LLM_PROVIDER 환경변수. 특정 호출만 다른 프로바이더로 고정하고 싶을 때만 지정
   *  (예: 나머지는 Gemini, 인생 애널리스트 리포트만 Anthropic 고정). */
  provider?: LlmProvider;
  /** provider 를 오버라이드할 때 함께 지정 — env.LLM_MODEL 은 기본 provider용 모델명이라
   *  다른 provider 로 강제할 땐 그 provider 에 맞는 모델명을 반드시 같이 넘길 것. */
  model?: string;
};

export type LlmResponse = {
  text: string;
  provider: string;
  model: string;
};

// Gemini 2.5 계열은 maxOutputTokens 예산을 내부 thinking에도 쓰기 때문에, 2048로는
// 가시 출력(600~2000자대)이 중간에 잘려 JSON 파싱 실패/내용 절단이 실측 확인됨(2026-07-15).
// 4096도 marginal(같은 프롬프트로도 성공/실패가 갈림) — 8192에서 couple-match 반복 테스트
// 전부 안정적으로 완결. 단, love-consulting/premium-saju(1500~2000자 타깃)는 8192에서도
// 절단 가능성이 남아 있어 추가 튜닝이 필요할 수 있음(별도 확인 필요).
const DEFAULT_MAX_TOKENS = 8192;

export async function generateInterpretation(req: LlmRequest): Promise<LlmResponse> {
  const env = serverEnv();
  const provider = req.provider ?? env.LLM_PROVIDER;
  const model = req.model ?? env.LLM_MODEL;
  switch (provider) {
    case "openai":
      return callOpenAI(req, model, env.OPENAI_API_KEY);
    case "anthropic":
      return callAnthropic(req, model, env.ANTHROPIC_API_KEY);
    case "gemini":
      return callGemini(req, model, env.GOOGLE_GENERATIVE_AI_API_KEY);
  }
}

async function callOpenAI(req: LlmRequest, model: string, key: string | undefined): Promise<LlmResponse> {
  if (!key) throw new Error("OPENAI_API_KEY is required when LLM_PROVIDER=openai");
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: key });
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: req.system },
      { role: "user", content: req.user },
    ],
    temperature: 0.7,
    max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
  });
  const text = completion.choices[0]?.message?.content ?? "";
  return { text, provider: "openai", model };
}

async function callAnthropic(req: LlmRequest, model: string, key: string | undefined): Promise<LlmResponse> {
  if (!key) throw new Error("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic");
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: key });
  // non-streaming 요청은 SDK가 10분 제한을 걸어 대형 리포트 생성(수만 토큰)에서
  // 에러가 난다(2026-07-15, SDK 0.111.0 업그레이드 후 확인) — 스트림으로 받아
  // finalMessage()로 완결된 응답을 기다린다.
  const stream = client.messages.stream({
    model,
    max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: req.system,
    // extended thinking이 요청 안 해도 켜져 있어(SDK 업그레이드 후 확인) max_tokens
    // 예산을 통째로 thinking에 써버리고 가시 텍스트가 0자로 나오는 문제가 실측
    // 확인됨(2026-07-15, 커플 리포트 23필드 생성 시 output_tokens=32000 전부
    // thinking_tokens). 이 앱의 용도(정해진 JSON 스키마 서술)엔 깊은 추론이 불필요해
    // 명시적으로 꺼서 예산 전량을 가시 출력에 쓰게 한다.
    thinking: { type: "disabled" },
    messages: [{ role: "user", content: req.user }],
  });
  const message = await stream.finalMessage();
  const text = message.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n");
  return { text, provider: "anthropic", model };
}

// ── 네트워크/일시적 API 오류 재시도(2026-07-17, 배포 전 보완) ────────────────
// 대용량 스트리밍 호출 도중 ECONNRESET("terminated")으로 연결이 끊기거나 Anthropic이
// 429(rate limit)/500/503/529(overloaded) 를 반환하는 경우가 실측 확인됨 — 콘텐츠
// 품질과 무관한 일시적 장애라 리포트 파이프라인들의 "품질 재시도" 예산(파트/섹션 재생성
// 횟수)을 소모시키지 않고 이 레이어에서 별도로 흡수한다. couple-report/life-analyst-report
// 양쪽이 이 함수를 공유한다 — 지금까지 couple/generate.ts 에만 로컬로 있던 로직을 여기로
// 승격하고 Anthropic APIError.status 판정을 추가했다.
const NETWORK_RETRY_ATTEMPTS = 3;
const RETRYABLE_ANTHROPIC_STATUS = new Set([429, 500, 503, 529]);

async function isRetryableTransientError(err: unknown): Promise<boolean> {
  const msg = err instanceof Error ? err.message : String(err);
  const cause = err instanceof Error ? (err.cause as { code?: string } | undefined) : undefined;
  if (msg.includes("terminated") || cause?.code === "ECONNRESET") return true;
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  if (err instanceof Anthropic.APIError && typeof err.status === "number") {
    return RETRYABLE_ANTHROPIC_STATUS.has(err.status);
  }
  return false;
}

export async function generateInterpretationWithNetworkRetry(req: LlmRequest): Promise<LlmResponse> {
  let lastErr: unknown;
  for (let i = 1; i <= NETWORK_RETRY_ATTEMPTS; i++) {
    try {
      return await generateInterpretation(req);
    } catch (err) {
      if (!(await isRetryableTransientError(err)) || i === NETWORK_RETRY_ATTEMPTS) throw err;
      lastErr = err;
      console.warn(
        `[llm] 네트워크/일시적 오류(${i}/${NETWORK_RETRY_ATTEMPTS}) — 재시도:`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  throw lastErr;
}

async function callGemini(req: LlmRequest, model: string, key: string | undefined): Promise<LlmResponse> {
  if (!key) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is required when LLM_PROVIDER=gemini");
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const client = new GoogleGenerativeAI(key);
  const m = client.getGenerativeModel({
    model,
    systemInstruction: req.system,
    generationConfig: { maxOutputTokens: req.maxTokens ?? DEFAULT_MAX_TOKENS },
  });
  const result = await m.generateContent(req.user);
  const text = result.response.text();
  return { text, provider: "gemini", model };
}
