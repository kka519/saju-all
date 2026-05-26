// =====================================================
// /demo — DB 없이 명식 → 결과지 흐름 데모
// =====================================================
// 2-A 단계: SSR → CSR 분리.
// SSR은 페이지 골격 + URL 파라미터 검증만. 무거운 만세력 API + LLM 호출은
// <SajuResult>가 mount 후 /api/saju/interpret 으로 진행.

import Link from "next/link";
import { SajuResult } from "@/components/saju/SajuResult";
import type { BirthInfo } from "@/lib/saju/saju-api";

export const metadata = { title: "데모 — 명식·결과지" };

type SearchParams = Promise<{
  y?: string; m?: string; d?: string;
  h?: string; min?: string;
  cal?: string; g?: string;
  slug?: string;
}>;

const DEFAULTS = {
  y: "1990", m: "5", d: "15",
  h: "14", min: "30",
  cal: "양력" as const, g: "male" as const,
};

export default async function DemoPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const birthInfo: BirthInfo = {
    birthYear: sp.y || DEFAULTS.y,
    birthMonth: sp.m || DEFAULTS.m,
    birthDay: sp.d || DEFAULTS.d,
    ...(sp.h
      ? { birthHour: sp.h, birthMinute: sp.min || "0" }
      : { birthHour: DEFAULTS.h, birthMinute: DEFAULTS.min }),
    calendarType: (sp.cal === "음력" ? "음력" : "양력") as "양력" | "음력",
    gender: (sp.g === "female" ? "female" : "male") as "male" | "female",
  };

  // /demo 슬러그 (검증용). 기본 basic-saju. love-saju 등 임의 슬러그 전달 시 두리 매핑 분기.
  const slug = sp.slug || "basic-saju";

  // 입력 폼이 URL 기반(GET)이라 searchParams가 바뀔 때마다 SajuResult가 새로 마운트되도록
  // birth params + slug 기반 key를 사용.
  const resultKey = `${slug}-${birthInfo.birthYear}-${birthInfo.birthMonth}-${birthInfo.birthDay}-${birthInfo.birthHour ?? "X"}-${birthInfo.birthMinute ?? "X"}-${birthInfo.calendarType}-${birthInfo.gender}`;

  return (
    <div className="container py-12 max-w-3xl text-night-fg">
      <header className="mb-8">
        <p className="text-xs font-mono text-night-fg-muted mb-2">DEMO</p>
        <h1 className="text-3xl font-semibold tracking-tight">명식 → 결과지 흐름 데모</h1>
        <p className="mt-2 text-sm text-night-fg-soft">
          DB 없이 명식 + LLM 해석이 어떻게 나오는지 확인하는 페이지예요. 결제/저장은 일어나지 않아요.
        </p>
      </header>

      <DemoForm initial={sp} />

      <SajuResult
        key={resultKey}
        birthInfo={birthInfo}
        slug={slug}
        productName={`데모 — ${slug}`}
        concerns={[]}
      />

      <footer className="mt-16 pt-8 border-t border-night-border text-xs text-night-fg-muted space-y-1">
        <p>
          ※ 이 페이지는 데모용이에요. 실제 결제 흐름은{" "}
          <Link className="underline hover:text-night-fg" href="/products">
            /products
          </Link>{" "}
          에서 시작돼요.
        </p>
        <p>※ API 응답은 <code className="font-mono">/api/saju/interpret</code> 에서 왔어요. 새로고침 시 다시 호출됩니다.</p>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// 폼 (GET — URL 파라미터로 재진입). 다크 톤 매핑 적용.
// ─────────────────────────────────────────────────────
function DemoForm({ initial }: { initial: Awaited<SearchParams> }) {
  const v = {
    y: initial.y || DEFAULTS.y,
    m: initial.m || DEFAULTS.m,
    d: initial.d || DEFAULTS.d,
    h: initial.h || DEFAULTS.h,
    min: initial.min || DEFAULTS.min,
    cal: initial.cal || DEFAULTS.cal,
    g: initial.g || DEFAULTS.g,
  };
  return (
    <form
      method="GET"
      className="rounded-lg border border-night-border p-5 bg-night-secondary"
    >
      <div className="grid grid-cols-3 gap-3 text-sm">
        <FormField name="y" label="년" defaultValue={v.y} />
        <FormField name="m" label="월" defaultValue={v.m} />
        <FormField name="d" label="일" defaultValue={v.d} />
        <FormField name="h" label="시(0-23)" defaultValue={v.h} />
        <FormField name="min" label="분(0-59)" defaultValue={v.min} />
        <div className="space-y-1">
          <label className="block text-[11px] font-mono uppercase tracking-wider text-night-fg-muted">
            달력
          </label>
          <select
            name="cal"
            defaultValue={v.cal}
            className="w-full h-9 px-3 rounded border border-night-border bg-night-elevated text-night-fg"
          >
            <option value="양력">양력</option>
            <option value="음력">음력</option>
          </select>
        </div>
        <div className="space-y-1 col-span-2">
          <label className="block text-[11px] font-mono uppercase tracking-wider text-night-fg-muted">
            성별
          </label>
          <select
            name="g"
            defaultValue={v.g}
            className="w-full h-9 px-3 rounded border border-night-border bg-night-elevated text-night-fg"
          >
            <option value="male">남성</option>
            <option value="female">여성</option>
          </select>
        </div>
        <button
          type="submit"
          className="h-9 px-4 rounded-full bg-starlight text-night-primary text-sm font-medium hover:bg-starlight-soft transition-colors"
        >
          명식 + 해석 생성
        </button>
      </div>
    </form>
  );
}

function FormField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-mono uppercase tracking-wider text-night-fg-muted">
        {label}
      </label>
      <input
        name={name}
        defaultValue={defaultValue}
        className="w-full h-9 px-3 rounded border border-night-border bg-night-elevated text-night-fg"
      />
    </div>
  );
}
