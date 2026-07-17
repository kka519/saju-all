// =====================================================
// 무료 운세 하루 1회 제한 (지시문_무료운세일일제한_20260717.md)
// =====================================================
// ① 계정(로그인) 또는 쿠키(비로그인) 기준 하루 1회
// ③ IP 기준 하루 5회 상한(시크릿창·다계정 우회 방어) — 병행 적용, 둘 중 하나만
//    걸려도 차단. 어느 쪽이 걸렸는지는 고객에게 구분해서 알리지 않는다(우회 힌트 방지).
//
// free_fortune_usage 테이블은 RLS 활성 + 정책 없음(service_role 전용) — 반드시
// createServiceClient() 로만 접근한다.

import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";
import { getTodayKST } from "@/lib/kst-date";

const COOKIE_NAME = "ffid";
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 400; // 400일(브라우저 쿠키 상한 관례치)
const IP_DAILY_CAP = 5;

/** 비로그인 사용자 식별용 쿠키 id — 없으면 발급하고 응답에 실어 보낸다. */
export async function getOrCreateFortuneCookieId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(COOKIE_NAME)?.value;
  if (existing) return existing;
  const id = randomUUID();
  cookieStore.set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SEC,
  });
  return id;
}

/** Vercel/프록시가 붙인 x-forwarded-for 첫 값 — 없으면(로컬 개발 등) 고정 폴백. */
export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}

export type FortuneLimitCheck = { allowed: boolean };

/** 생성 시도 전에 호출 — identity(계정/쿠키) 1일 1회, IP 1일 5회 둘 다 통과해야 허용. */
export async function checkFreeFortuneLimit(params: {
  identityKey: string;
  ip: string;
}): Promise<FortuneLimitCheck> {
  const service = createServiceClient();
  const day = getTodayKST();

  const { count: identityCount } = await service
    .from("free_fortune_usage")
    .select("id", { count: "exact", head: true })
    .eq("day", day)
    .eq("identity_key", params.identityKey);
  if ((identityCount ?? 0) > 0) return { allowed: false };

  const { count: ipCount } = await service
    .from("free_fortune_usage")
    .select("id", { count: "exact", head: true })
    .eq("day", day)
    .eq("ip", params.ip);
  if ((ipCount ?? 0) >= IP_DAILY_CAP) return { allowed: false };

  return { allowed: true };
}

/** 생성 성공 후에만 호출 — 실패한 시도는 하루 소진으로 치지 않는다. */
export async function recordFreeFortuneUsage(params: {
  identityKey: string;
  ip: string;
}): Promise<void> {
  const service = createServiceClient();
  const day = getTodayKST();
  // identity_key 유니크 제약과 동시에 걸리는 경합은 무시(어차피 하루 1회 의도와 부합).
  await service.from("free_fortune_usage").insert({ day, identity_key: params.identityKey, ip: params.ip });
}
