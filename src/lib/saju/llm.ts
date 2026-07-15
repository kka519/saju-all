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
  const message = await client.messages.create({
    model,
    max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: req.system,
    messages: [{ role: "user", content: req.user }],
  });
  const text = message.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n");
  return { text, provider: "anthropic", model };
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
