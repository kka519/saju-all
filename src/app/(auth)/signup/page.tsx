"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { publicEnv } from "@/lib/env";
import { getSajuInputCarryover, clearSajuInputCarryover } from "@/lib/saju-input-carryover";

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const search = useSearchParams();
  const redirectTo = search.get("redirect") ?? "/mypage";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name },
        emailRedirectTo: `${publicEnv.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    // 비로그인 상태에서 무료 운세 등에 입력한 사주 정보를 신규 가입 계정에
    // 이월 저장(지시문_사주입력_프리필_20260721.md §2) — 이후 전 상품에서
    // 재입력 없이 재사용된다. onboarding/signup/page.tsx와 동일 패턴.
    const carryover = getSajuInputCarryover();
    if (data.user && carryover?.birthDate) {
      await supabase
        .from("profiles")
        .update({
          birth_date: carryover.birthDate,
          birth_time: carryover.timeUnknown ? null : carryover.birthTime ?? null,
          time_unknown: carryover.timeUnknown,
          gender: carryover.gender,
          calendar: carryover.calendar ?? "solar",
          is_leap_month: carryover.isLeapMonth,
        })
        .eq("id", data.user.id);
      clearSajuInputCarryover();
    }

    setLoading(false);
    toast.success("가입 완료!");
    // router.push+refresh는 signUp()이 쓴 세션 쿠키가 아직 커밋되기 전에
    // 대상 페이지 서버 컴포넌트가 먼저 읽어 /login으로 튕기는 레이스가 있었다.
    // 하드 네비게이션은 새 요청이라 쿠키를 확실히 반영해서 읽는다.
    window.location.href = redirectTo;
  }

  return (
    <div className="container py-16 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>회원가입</CardTitle>
          <CardDescription>이메일 인증 없이 즉시 가입됩니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">이름</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">이메일</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">비밀번호 (8자 이상)</Label>
              <Input id="password" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "가입 중..." : "가입하기"}
            </Button>
            <p className="text-sm text-center">
              이미 계정이 있으신가요?{" "}
              <Link
                href={search.get("redirect") ? `/login?redirect=${encodeURIComponent(search.get("redirect")!)}` : "/login"}
                className="text-primary hover:underline"
              >
                로그인
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
