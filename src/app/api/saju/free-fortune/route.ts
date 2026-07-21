// =====================================================
// POST /api/saju/free-fortune
// =====================================================
// 회원가입 퍼널 화면 6 — 무료 운세 미리보기(비로그인) + 로그인 사용자의 "오늘의
// 무료 운세" 매일 진입점(지시문_무료운세일일제한_20260717.md) 공용 엔드포인트.
//
// 2026-07-21 재작성 — 기존엔 SYSTEM_BASE + 임시 지시문(FREE_FORTUNE_INSTRUCTION)으로
// 평생 원국 풀이(격국·신살·십성)를 내보내고 있었다(사양 위반, 실측 확인됨).
// 지금은 유료 today-fortune(₩880)과 동일한 오늘 일진 기반 8블록 파이프라인을
// today-fortune-prompt.ts의 free variant로 재사용한다 — 오늘 일진·톤·골든타임·
// 오행 비유는 전부 코드가 계산해 확정값으로 주입하고(진실 원천 단일화),
// LLM은 초등학교 3학년도 이해할 수 있는 언어로 해석만 한다.
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
  ganjiToMyeongsik,
  isSajuApiConfigured,
  SajuApiError,
  type BirthInfo,
} from "@/lib/saju/saju-api";
import { fetchDayGanji, analyzeDayTone, findGoldenSijin } from "@/lib/saju/today-ganji";
import { computeSijinTable } from "@/lib/saju/sijin";
import { buildMyeongsikView } from "@/lib/saju/build-myeongsik-view";
import { computeElementMetaphor } from "@/lib/saju/element-metaphor";
import { generateTodayFortuneWithRetry, makeLockedPlaceholder } from "@/lib/saju/today-fortune-prompt";
import type { Oheng } from "@/lib/saju/derived";
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

  let { birthInfo } = parsed.data;
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

  // 1) 만세력 API — 오늘 일진 파이프라인이 필요로 하는 4기둥(Myeongsik)까지 함께 뽑는다.
  let manseryeokText: string;
  let myeongsik: ReturnType<typeof ganjiToMyeongsik>;
  let fullAnalysis: Awaited<ReturnType<typeof fetchSajuAnalysis>>;
  try {
    fullAnalysis = await fetchSajuAnalysis(birthInfo, [], { source: "demo" });
    manseryeokText = formatSajuToManseryeok(fullAnalysis, birthInfo);
    myeongsik = ganjiToMyeongsik(fullAnalysis);
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
  if (!myeongsik) {
    // 결제 후 확정 경로(confirm/route.ts)는 mock 명식으로 폴백하지만, 무료 미리보기는
    // 결제 전이라 억지로 결과를 만들어낼 이유가 없다 — 실패로 처리하고 재시도를 유도한다.
    return NextResponse.json(
      {
        ok: false as const,
        stage: "api-error" as const,
        error: "두리가 잠시 별을 못 찾았어요. 다시 시도해주세요.",
        detail: "ganji missing in saju API response",
      },
      { status: 502 },
    );
  }

  // 2) 오늘 일진·톤·골든타임·오행 비유 — 전부 코드가 계산(유료 today-fortune과 동일 파이프라인).
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const [todayGanji, tomorrowGanji] = await Promise.all([fetchDayGanji(today), fetchDayGanji(tomorrow)]);
  const sijinTable = computeSijinTable(todayGanji.cheongan);
  const view = buildMyeongsikView(myeongsik, fullAnalysis);
  const { tone: dayTone, relations, ohengNote } = analyzeDayTone(todayGanji, myeongsik, {
    yongsinOheng: view.yongsin?.오행 as Oheng | undefined,
    huisinOheng: view.gyeokguk?.희신오행 as Oheng | undefined,
    gisinOheng: view.gyeokguk?.기신오행 as Oheng | undefined,
  });
  const goldenSijin = findGoldenSijin(sijinTable, myeongsik, {
    yongsinOheng: view.yongsin?.오행 as Oheng | undefined,
    huisinOheng: view.gyeokguk?.희신오행 as Oheng | undefined,
    gisinOheng: view.gyeokguk?.기신오행 as Oheng | undefined,
  });
  const elementMetaphor = computeElementMetaphor(myeongsik.day.cheongan, todayGanji.cheongan);
  const birthDate = `${birthInfo.birthYear}-${birthInfo.birthMonth.padStart(2, "0")}-${birthInfo.birthDay.padStart(2, "0")}`;

  // 3) LLM — free variant(초3 언어 + 본문 전체 용어 0개 + 오행 비유), CTA 없음(화면에 별도 버튼).
  try {
    const { result, provider, model, attempts } = await generateTodayFortuneWithRetry({
      myeongsik,
      manseryeokText,
      birthDate,
      gender: birthInfo.gender,
      todayGanji,
      tomorrowGanji,
      sijinTable,
      dayTone,
      relations,
      ohengNote,
      goldenSijin,
      ctaTemplateId: "NONE",
      variant: "free",
      elementMetaphor,
    });

    // 원가 관측(지시문_무료운세_잠금티저_20260721.md §5) — 무료/유료 공통 구조화 로그.
    console.log(JSON.stringify({
      event: "today-fortune-generated", variant: "free", attempts, provider, model, dayTone: result.dayTone,
    }));

    // 실컨텐츠는 DB에만(§1) — 응답에는 잠금 블록을 더미로 치환해 내려보낸다.
    await recordFreeFortuneUsage({ identityKey, ip, sections: result, attemptCount: attempts, provider, model });

    return NextResponse.json({
      ok: true as const,
      fortune: {
        dayTone: result.dayTone,
        headline: result.headline,
        psychSnipe: result.psychSnipe,
        weatherReason: result.weatherReason,
        goldenTimeLabel: result.goldenTimeLabel,
        locked: {
          flowMorning: makeLockedPlaceholder(result.flow.morning.length),
          flowAfternoon: makeLockedPlaceholder(result.flow.afternoon.length),
          flowEvening: makeLockedPlaceholder(result.flow.evening.length),
          pointTake: makeLockedPlaceholder(result.point.take.length),
          pointAvoid: makeLockedPlaceholder(result.point.avoid.length),
          tomorrow: makeLockedPlaceholder(result.tomorrow.length),
        },
      },
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
