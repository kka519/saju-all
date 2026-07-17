// =====================================================
// POST /api/saju/free-fortune
// =====================================================
// 회원가입 퍼널 화면 6 — 무료 운세 미리보기(비로그인) + 로그인 사용자의 "오늘의
// 무료 운세" 매일 진입점(지시문_무료운세일일제한_20260717.md) 공용 엔드포인트.
// 호기심 자극 톤 한 문단(5~7문장) 마크다운 텍스트 반환.
// SYSTEM_BASE는 그대로(두리 톤) + user 프롬프트에 호기심 자극 instruction append.
// buildSajuPrompt(5섹션 JSON 강제)는 사용하지 않음 — 무료 미리보기엔 한 문단 텍스트가 적합.
//
// 하루 1회 제한(①③): 로그인은 계정, 비로그인은 쿠키(ffid) 기준 1일 1회 + IP 기준
// 1일 5회 상한을 병행 — 둘 중 하나만 걸려도 동일한 안내 문구로 차단한다(어느 쪽
// 한도인지 고객에게 구분해서 알리지 않음, 우회 힌트 방지).
// 저장된 생년월일 재사용(②): 로그인 사용자가 birthInfo를 함께 보내면 profiles에
// 저장하고, 다음부터는 birthInfo 생략 시 저장된 값을 자동으로 쓴다.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  fetchSajuAnalysis,
  formatSajuToManseryeok,
  isSajuApiConfigured,
  SajuApiError,
  type BirthInfo,
} from "@/lib/saju/saju-api";
import { SYSTEM_BASE } from "@/lib/saju/prompt";
import { generateInterpretation } from "@/lib/saju/llm";
import { getCurrentUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import {
  getOrCreateFortuneCookieId,
  getClientIp,
  checkFreeFortuneLimit,
  recordFreeFortuneUsage,
} from "@/lib/free-fortune-limit";

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
  // 로그인 사용자가 저장된 생년월일을 재사용할 때는 생략 가능 — 이 경우 profiles에서 읽는다.
  birthInfo: birthInfoSchema.optional(),
  concerns: z.array(z.string()).optional().default([]),
  name: z.string().optional(),
});

const FREE_FORTUNE_INSTRUCTION = `

[무료 운세 미리보기 — 호기심 자극 톤]
한 문단 5~7문장으로 작성하세요. 다음 톤을 반드시 준수합니다:

- 두리가 깜짝 놀란 듯한 인사로 시작 (예: "어머!", "와!", "잠깐!").
- 사용자가 "오, 진짜 내 얘기네!" 라고 느끼게 구체적으로 풀어주세요.
- 명리학 용어(천간지지, 일주, 격국, 신살, 십성 등)는 자연스럽게 포함하고 반드시 **굵게** 강조합니다.
- **굵게** 마커 안쪽에 공백/줄바꿈을 절대 넣지 마세요. 별표와 내용 사이에 공백이 있으면 렌더가 깨집니다.
  - 맞음: **경금(庚金)** 일간
  - 틀림: ** 경금(庚金) ** 일간
  - 틀림: ** 경금(庚金)** 일간
  - 틀림: **경금(庚金) ** 일간
- 사용자가 선택한 [관심사]가 있다면 그쪽 흐름을 중심으로 풀어주세요.
- 마지막 문장은 호기심을 자극하며 끝냅니다 (예: "...더 자세한 건 두리만 알고 있어요 ✨").
- 결제·가입 유도 문구는 절대 넣지 마세요 (CTA는 별도 UI에서 처리).
- JSON 출력 X. 마크다운 코드블록(\`\`\`) X. 단일 한국어 마크다운 문단만 반환.`;

const RATE_LIMIT_MESSAGE = "오늘의 무료 운세는 이미 받으셨어요. 내일 다시 만나요 🌙 더 깊은 풀이가 궁금하다면 유료 상품도 만나보세요.";

function profileToBirthInfo(profile: {
  birth_date: string;
  birth_time: string | null;
  time_unknown: boolean;
  gender: "male" | "female";
  calendar: "solar" | "lunar";
  is_leap_month: boolean;
}): BirthInfo {
  const [birthYear, birthMonth, birthDay] = profile.birth_date.split("-");
  const [birthHour, birthMinute] = profile.time_unknown ? [undefined, undefined] : (profile.birth_time ?? "").split(":");
  return {
    birthYear: birthYear!,
    birthMonth: String(Number(birthMonth)),
    birthDay: String(Number(birthDay)),
    ...(profile.time_unknown ? {} : { birthHour, birthMinute }),
    calendarType: profile.calendar === "lunar" ? "음력" : "양력",
    gender: profile.gender,
    isLeapMonth: profile.is_leap_month,
  };
}

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

  const currentUser = await getCurrentUser();
  const identityKey = currentUser ? `user:${currentUser.id}` : `cookie:${await getOrCreateFortuneCookieId()}`;
  const ip = getClientIp(req.headers);

  const { allowed } = await checkFreeFortuneLimit({ identityKey, ip });
  if (!allowed) {
    return NextResponse.json(
      { ok: false as const, stage: "rate-limited" as const, error: RATE_LIMIT_MESSAGE },
      { status: 429 },
    );
  }

  let { birthInfo, name } = parsed.data;
  const { concerns } = parsed.data;
  const service = createServiceClient();

  if (currentUser) {
    if (birthInfo) {
      // 로그인 사용자가 생년월일을 함께 보냄 — 다음부터 재사용하도록 저장(②).
      await service
        .from("profiles")
        .update({
          birth_date: `${birthInfo.birthYear}-${birthInfo.birthMonth.padStart(2, "0")}-${birthInfo.birthDay.padStart(2, "0")}`,
          birth_time: birthInfo.birthHour ? `${birthInfo.birthHour.padStart(2, "0")}:${(birthInfo.birthMinute ?? "0").padStart(2, "0")}` : null,
          time_unknown: !birthInfo.birthHour,
          gender: birthInfo.gender,
          calendar: birthInfo.calendarType === "음력" ? "lunar" : "solar",
          is_leap_month: birthInfo.isLeapMonth ?? false,
        })
        .eq("id", currentUser.id);
    } else {
      // birthInfo 생략 — 저장된 값을 읽어 재사용.
      const { data: profile } = await service
        .from("profiles")
        .select("birth_date, birth_time, time_unknown, gender, calendar, is_leap_month, display_name")
        .eq("id", currentUser.id)
        .maybeSingle();
      if (!profile?.birth_date || !profile.gender || !profile.calendar) {
        return NextResponse.json(
          {
            ok: false as const,
            stage: "no-saved-birth-info" as const,
            error: "저장된 생년월일이 없어요. 처음 한 번만 입력해 주시면 다음부터는 바로 받아보실 수 있어요.",
          },
          { status: 400 },
        );
      }
      birthInfo = profileToBirthInfo({
        birth_date: profile.birth_date,
        birth_time: profile.birth_time,
        time_unknown: profile.time_unknown,
        gender: profile.gender,
        calendar: profile.calendar,
        is_leap_month: profile.is_leap_month,
      });
      name = name ?? profile.display_name ?? undefined;
    }
  }

  if (!birthInfo) {
    return NextResponse.json(
      {
        ok: false as const,
        stage: "validation-error" as const,
        error: "생년월일을 입력해 주세요.",
      },
      { status: 400 },
    );
  }

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
    (concerns.length > 0 ? `관심사: ${concerns.join(", ")}\n\n` : "\n") +
    `[명식]\n${manseryeokText}` +
    FREE_FORTUNE_INSTRUCTION;

  try {
    const llm = await generateInterpretation({ system: SYSTEM_BASE, user });
    // 가끔 모델이 코드블록으로 감싸는 경우 안전하게 제거
    const fortune = stripCodeFence(llm.text).trim();
    await recordFreeFortuneUsage({ identityKey, ip });
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
