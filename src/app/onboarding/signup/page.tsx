"use client";

// 화면 8 — 회원가입.
// 기존엔 "준비 중이에요 (Phase C)" 스텁이라 온보딩 퍼널이 여기서 막혀 있었다
// (2026-07-17 사장님 리포트로 발견) — 실제 가입 폼으로 교체.
// 이메일 인증 없이 즉시 세션이 생기므로(SignupPage와 동일 계약), 가입 직후
// 온보딩에서 이미 입력받은 생년월일·성별·달력을 profiles에 저장해 재입력을
// 없앤다 — 무료 운세 하루 1회 제한(②) 재사용 흐름과 동일한 데이터.

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { getData, clearData } from "@/lib/onboarding-storage";

const INPUT_CLS =
  "h-11 w-full px-3 rounded-md border border-night-border bg-night-elevated text-night-fg text-base placeholder:text-night-fg-muted focus-visible:outline-none focus-visible:border-starlight";

export default function OnboardingSignupPage() {
  const d = getData();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState(d.name ?? "");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const canSubmit = !!(email && password.length >= 8 && name);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setErrorMsg("");

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    // 온보딩에서 이미 받은 생년월일을 계정에 저장 — 다음부터 /free-fortune에서
    // 재입력 없이 재사용된다(무료 운세 하루 1회 제한 지시문 §②와 동일 데이터).
    if (data.user && d.birthYear && d.birthMonth && d.birthDay && d.gender) {
      const pad = (v: string) => v.padStart(2, "0");
      await supabase
        .from("profiles")
        .update({
          birth_date: `${d.birthYear}-${pad(d.birthMonth)}-${pad(d.birthDay)}`,
          birth_time: !d.hourUnknown && d.birthHour ? `${pad(d.birthHour)}:${pad(d.birthMinute ?? "0")}` : null,
          time_unknown: !!d.hourUnknown,
          gender: d.gender,
          calendar: d.calendar ?? "solar",
        })
        .eq("id", data.user.id);
    }

    clearData();
    // router.push + router.refresh는 방금 signUp()이 브라우저에 쓴 세션 쿠키가
    // 아직 커밋되기 전에 /mypage의 서버 컴포넌트가 먼저 읽어버리는 레이스가
    // 있었다(재현: 가입 직후 /login?redirect=/mypage로 튕김). 하드 네비게이션은
    // 새 요청이므로 쿠키를 확실히 반영해서 읽는다.
    window.location.href = "/mypage";
  }

  return (
    <div className="w-full space-y-8">
      <Image
        src="/characters/doori/doori-magic-solid.png"
        alt="두리"
        width={160}
        height={160}
        priority
        className="mx-auto rounded-full ring-1 ring-starlight/30"
      />
      <h1 className="text-2xl font-semibold leading-snug">
        {name ? `${name}님,` : ""}
        {name ? <br /> : null}
        계정을 만들어 볼까요?
      </h1>
      <p className="text-sm text-night-fg-soft -mt-4">이메일 인증 없이 바로 가입돼요.</p>

      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <div className="space-y-2">
          <span className="block text-sm text-night-fg-soft">이름</span>
          <input className={INPUT_CLS} required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <span className="block text-sm text-night-fg-soft">이메일</span>
          <input type="email" className={INPUT_CLS} required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <span className="block text-sm text-night-fg-soft">비밀번호 (8자 이상)</span>
          <input type="password" minLength={8} className={INPUT_CLS} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {errorMsg ? <p className="text-xs text-rose-300">{errorMsg}</p> : null}

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="block w-full h-12 rounded-full bg-starlight text-night-primary text-base font-medium hover:bg-starlight-soft transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "가입 중..." : "가입하고 시작하기"}
        </button>
      </form>

      <p className="text-sm text-night-fg-muted">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="text-starlight hover:text-starlight-soft">로그인</Link>
      </p>
    </div>
  );
}
