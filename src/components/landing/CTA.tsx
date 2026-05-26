import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Ollama-style inverted CTA strip — the single attention-grabbing surface.
export function CTA() {
  return (
    <section className="container py-16">
      <div className="rounded-lg bg-night-elevated border border-night-border px-8 py-12 text-center text-night-fg">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
          지금 바로 시작해 보세요
        </h2>
        <p className="mt-3 text-sm text-night-fg-soft">
          로그인 없이 게스트로도 결제할 수 있어요
        </p>
        <div className="mt-7">
          <Link
            href="/products"
            className={cn(
              buttonVariants({ size: "lg", variant: "onDark" }),
              "bg-starlight text-night-primary hover:bg-starlight-soft",
            )}
          >
            상품 보러 가기
          </Link>
        </div>
      </div>
    </section>
  );
}
