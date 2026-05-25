import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

// Ollama-style hero: paper-white canvas, 36px centered headline,
// single black pill CTA, monospace inline tag as "command pill".
export function Hero() {
  return (
    <section className="container py-24 md:py-32 text-center">
      <Image
        src="/characters/doori/doori-saju.png"
        alt="두리"
        width={220}
        height={220}
        priority
        className="mx-auto mb-8"
      />
      <h1 className="text-[34px] md:text-[44px] font-semibold tracking-tight leading-[1.1] text-ink">
        {siteConfig.tagline}
      </h1>
      <p className="mt-5 text-[15px] text-body max-w-md mx-auto">
        {siteConfig.description}
      </p>

      <div className="mt-8 flex flex-col items-center gap-3">
        {/* 진입 미끼: 매일 무료 운세 */}
        <Link
          href="/signup"
          className="inline-flex items-center gap-2 rounded-full bg-rose-100 px-5 h-11 text-[15px] font-medium text-rose-700 hover:bg-rose-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 focus-visible:ring-offset-2"
        >
          <span className="inline-flex items-center justify-center rounded-full bg-rose-500 px-2 h-5 text-[10px] font-semibold tracking-wide text-white">
            FREE
          </span>
          매일 무료 운세 받기 ✨
        </Link>

        {/* 기존 2개 버튼 */}
        <div className="flex items-center justify-center gap-3">
          <Link href="/products" className={cn(buttonVariants({ size: "lg" }))}>
            상품 보기
          </Link>
          <Link
            href="#how-it-works"
            className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
          >
            작동 방식
          </Link>
        </div>
      </div>
    </section>
  );
}
