import { Hero } from "@/components/landing/Hero";
import { ProductLineup } from "@/components/landing/ProductLineup";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { CTA } from "@/components/landing/CTA";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";

export default async function HomePage() {
  // 로그인 사용자는 히어로의 "매일 무료 운세 받기"가 /signup 온보딩 대신
  // /free-fortune(저장된 생년월일 재사용)로 가야 문구가 사실이 된다(②).
  const isLoggedIn = isSupabaseConfigured() ? !!(await getCurrentUser()) : false;

  return (
    <>
      <Hero isLoggedIn={isLoggedIn} />
      <ProductLineup />
      <HowItWorks />
      <CTA />
    </>
  );
}
