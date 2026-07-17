// =====================================================
// /free-fortune — 로그인 사용자의 "오늘의 무료 운세" 매일 진입점
// =====================================================
// 지시문_무료운세일일제한_20260717.md §② — 온보딩을 이미 마친 사용자도 홈/
// 마이페이지에서 매일 무료 운세를 받을 수 있게 한다. 저장된 생년월일이 있으면
// 재입력 없이 바로 받고, 없으면(첫 방문) 그 자리에서 한 번만 입력받아 저장한다.
// 비로그인 사용자의 최초 유입 경로는 기존 /onboarding 퍼널 그대로 유지 — 이
// 페이지는 로그인 사용자 전용.

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { DailyFreeFortune } from "@/components/saju/DailyFreeFortune";

export default async function FreeFortunePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/free-fortune");

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, birth_date, gender, calendar")
    .eq("id", user.id)
    .maybeSingle();

  const hasSavedBirthInfo = !!(profile?.birth_date && profile.gender && profile.calendar);

  return (
    <div className="container max-w-md py-16 text-center">
      <DailyFreeFortune hasSavedBirthInfo={hasSavedBirthInfo} displayName={profile?.display_name ?? null} />
    </div>
  );
}
