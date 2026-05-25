import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Toaster } from "sonner";
import { siteConfig, businessInfo } from "@/config/site";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: siteConfig.name, template: `%s | ${siteConfig.name}` },
  description: siteConfig.description,
  metadataBase: new URL(siteConfig.url),
  openGraph: {
    title: siteConfig.name,
    description: siteConfig.description,
    type: "website",
    locale: "ko_KR",
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 로그인 여부에 따라 헤더 메뉴 분기. Supabase 미설정(데모) 모드면 무조건 비로그인 취급.
  const isLoggedIn = isSupabaseConfigured() ? !!(await getCurrentUser()) : false;

  return (
    <html lang="ko">
      <body suppressHydrationWarning>
        <SiteHeader isLoggedIn={isLoggedIn} />
        <main className="min-h-[calc(100vh-7rem)]">{children}</main>
        <SiteFooter />
        <Toaster position="top-center" />
      </body>
    </html>
  );
}

// Ollama: 56px utility nav, primary nav on canvas, no shadow.
function SiteHeader({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <header className="border-b border-hairline bg-canvas">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-semibold text-[15px] text-ink">
          <Image
            src="/characters/doori/doori-magic.png"
            alt="두리"
            width={40}
            height={40}
            className="h-8 w-8 md:h-9 md:w-9 rounded-full flex-shrink-0"
          />
          {siteConfig.name}
        </Link>
        <nav className="flex items-center gap-6 text-[13px] font-medium">
          <Link href="/products" className="text-ink hover:text-body">상품</Link>
          {isLoggedIn ? (
            <>
              <Link href="/mypage" className="text-ink hover:text-body">마이페이지</Link>
              <form action="/api/auth/signout" method="post">
                <button type="submit" className="text-ink hover:text-body">로그아웃</button>
              </form>
            </>
          ) : (
            <Link href="/login" className="text-ink hover:text-body">로그인</Link>
          )}
        </nav>
      </div>
    </header>
  );
}

// Ollama: footer is a quiet caption-gray strip with hairline divider.
function SiteFooter() {
  // 사업자정보 한 줄 — 운세위키 푸터 포맷: "회사 | 사업자등록번호: ... | 통신판매업 신고번호: ... | 대표: ... | 주소: ..."
  const businessLine = [
    businessInfo.companyName,
    `사업자등록번호: ${businessInfo.businessNumber}`,
    `통신판매업 신고번호: ${businessInfo.mailOrderNumber}`,
    `대표: ${businessInfo.representative}`,
    `주소: ${businessInfo.address}`,
  ].join(" | ");

  const contactLine = [
    `고객센터: ${businessInfo.email}`,
    businessInfo.phone
      ? `핸드폰${businessInfo.phoneNote ? `(${businessInfo.phoneNote})` : ""}: ${businessInfo.phone}`
      : null,
  ]
    .filter(Boolean)
    .join(" | ");

  return (
    <footer className="border-t border-hairline mt-20">
      <div className="container py-10 text-xs text-body space-y-4">
        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
          <Link href="/legal/terms" className="hover:text-ink">이용약관</Link>
          <Link href="/legal/privacy" className="hover:text-ink">개인정보처리방침</Link>
          <Link href="/legal/refund-policy" className="hover:text-ink">환불정책</Link>
        </div>
        <p className="text-mute leading-relaxed">{businessLine}</p>
        <p className="text-mute leading-relaxed">{contactLine}</p>
        <p className="text-mute">© {new Date().getFullYear()} {siteConfig.name}</p>
      </div>
    </footer>
  );
}
