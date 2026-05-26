// =====================================================
// POST /api/saju/free-fortune
// =====================================================
// 회원가입 퍼널 화면 6 — 무료 운세 미리보기.
// 호기심 자극 톤 한 문단 (5~7문장) 마크다운 텍스트 반환.
// SYSTEM_BASE는 그대로 (두리 톤) + user 프롬프트에 호기심 자극 instruction append.
// buildSajuPrompt(5섹션 JSON 강제)는 사용하지 않음 — 무료 미리보기엔 한 문단 텍스트가 적합.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  fetchSajuAnalysis,
  formatSajuToManseryeok,
  isSajuApiConfigured,
  SajuApiError,
} from "@/lib/saju/saju-api";
import { SYSTEM_BASE } from "@/lib/saju/prompt";
import { generateInterpretation } from "@/lib/saju/llm";

const birthInfoSchema = z.object({
  birthYear: z.string().regex(/^\d{4}$/),
  birthMonth: z.string().regex(/^(0?[1-9]|1[0-2])$/),
  birthDay: z.string().regex(/^(0?[1-9]|[12]\d|3[01])$/),
  birthHour: z.string().regex(/^(0?\d|1\d|2[0-3])$/).optional(),
  birthMinute: z.string().regex(/^(0?\d|[1-5]\d)$/).optional(),
  calendarType: z.enum(["양력", "음력"]),
  gender: z.enum(["male", "female"]),
  isLeapMonth: z.boolean().optional(),
});

const bodySchema = z.object({
  birthInfo: birthInfoSchema,
  concerns: z.array(z.string()).min(1, "관심사를 1개 이상 선택해 주세요"),
  name: z.string().optional(),
});

const FREE_FORTUNE_INSTRUCTION = `

[무료 운세 미리보기 — 호기심 자극 톤]
한 문단 5~7문장으로 작성하세요. 다음 톤을 반드시 준수합니다:

- 두리가 깜짝 놀란 듯한 인사로 시작 (예: "어머!", "와!", "잠깐!").
- 사용자가 "오, 진짜 내 얘기네!" 라고 느끼게 구체적으로 풀어주세요.
- 명리학 용어(천간지지, 일주, 격국, 신살, 십성 등)는 자연스럽게 포함하고 반드시 **굵게** 강조합니다.
- 사용자가 선택한 [관심사]가 있다면 그쪽 흐름을 중심으로 풀어주세요.
- 마지막 문장은 호기심을 자극하며 끝냅니다 (예: "...더 자세한 건 두리만 알고 있어요 ✨").
- 결제·가입 유도 문구는 절대 넣지 마세요 (CTA는 별도 UI에서 처리).
- JSON 출력 X. 마크다운 코드블록(\`\`\`) X. 단일 한국어 마크다운 문단만 반환.`;

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false as const,
        stage: "validation-error" as const,
        error: "입력값을 다시 확인해 주세요. 생년월일과 관심사가 필요해요.",
        detail: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { birthInfo, concerns, name } = parsed.data;

  if (!isSajuApiConfigured()) {
    return NextResponse.json(
      {
        ok: false as const,
        stage: "api-missing" as const,
        error: "사주 API 키가 설정되지 않았어요. 관리자에게 알려주세요.",
      },
      { status: 503 },
    );
  }

  // 1) 만세력 API
  let manseryeokText: string;
  try {
    const analysis = await fetchSajuAnalysis(birthInfo, [], { source: "demo" });
    manseryeokText = formatSajuToManseryeok(analysis, birthInfo);
  } catch (err) {
    const upstream = err instanceof SajuApiError ? err.status : undefined;
    return NextResponse.json(
      {
        ok: false as const,
        stage: "api-error" as const,
        error: "두리가 잠시 별을 못 찾았어요. 다시 시도해주세요.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: upstream && upstream >= 400 && upstream < 600 ? upstream : 502 },
    );
  }

  // 2) LLM — 호기심 자극 톤 한 문단
  const user =
    `[기본 정보]\n` +
    (name ? `사용자: ${name}님\n` : "") +
    `관심사: ${concerns.join(", ")}\n\n` +
    `[명식]\n${manseryeokText}` +
    FREE_FORTUNE_INSTRUCTION;

  try {
    const llm = await generateInterpretation({ system: SYSTEM_BASE, user });
    // 가끔 모델이 코드블록으로 감싸는 경우 안전하게 제거
    const fortune = stripCodeFence(llm.text).trim();
    return NextResponse.json({
      ok: true as const,
      fortune,
      meta: { provider: llm.provider, model: llm.model },
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false as const,
        stage: "llm-error" as const,
        error: "두리가 잠시 별을 못 찾았어요. 다시 시도해주세요.",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}

// ```...``` 형태로 LLM이 한 번 감싸오는 케이스 흡수.
function stripCodeFence(text: string): string {
  const fence = text.match(/```(?:markdown|md)?\s*([\s\S]*?)```/);
  return fence?.[1] ?? text;
}
