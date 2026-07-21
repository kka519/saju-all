import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

// Ollama-style hero: paper-white canvas, 36px centered headline,
// single black pill CTA, monospace inline tag as "command pill".
export function Hero({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="container py-24 md:py-32 text-center">
      {/* 두리 + 별빛 글로우 — 두리 영역만 따로 빛나게 */}
      <div className="relative mx-auto mb-8 h-[220px] w-[220px]">
        <div
          aria-hidden
          className="absolute inset-0 rounded-full bg-starlight/20 blur-3xl"
        />
        <Image
          src="/characters/doori/doori-saju.png"
          alt="두리"
          width={220}
          height={220}
          priority
          className="relative rounded-full"
        />
      </div>
      <h1 className="text-[34px] md:text-[44px] font-semibold tracking-tight leading-[1.1] text-night-fg">
        {siteConfig.tagline.split(", ").map((line, i) => (
          <span key={i} className="block">
            {i === 0 ? `${line},` : line}
          </span>
        ))}
      </h1>
      <p className="mt-5 text-[15px] text-night-fg-soft max-w-md mx-auto">
        {siteConfig.description}
      </p>

      <div className="mt-8 flex flex-col items-center gap-3">
        {/* 진입 미끼: 매일 무료 운세 (파스텔 핑크, 다크 위에서도 따뜻한 톤 유지)
            로그인 사용자는 /free-fortune(저장된 생년월일 재사용)로, 비로그인은
            기존 온보딩 퍼널(/signup)로 — "매일" 문구가 실제로 매일 되게 한다(②). */}
        <Link
          href={isLoggedIn ? "/free-fortune" : "/signup"}
          className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-5 h-11 text-[15px] font-medium text-rose-700 hover:bg-rose-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2"
        >
          <span className="inline-flex items-center justify-center rounded-full bg-rose-500 px-2 h-5 text-[10px] font-semibold tracking-wide text-white">
            FREE
          </span>
          매일 무료 운세 받기 ✨
        </Link>

        {/* 기존 2개 버튼 — 다크용 inline override (시스템 button.tsx 미변경) */}
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/products"
            className={cn(
              buttonVariants({ size: "lg" }),
              "bg-starlight text-night-primary hover:bg-starlight-soft",
            )}
          >
            상품 보기
          </Link>
          <Link
            href="#how-it-works"
            className={cn(
              buttonVariants({ size: "lg", variant: "outline" }),
              "border-night-border bg-transparent text-night-fg hover:bg-night-elevated",
            )}
          >
            작동 방식
          </Link>
        </div>
      </div>
    </section>
  );
}
