// =====================================================
// /demo — DB 없이 명식 → 결과지 흐름 데모
// =====================================================
// 결제/Supabase 없이도 결과지가 어떻게 나오는지 확인할 수 있는 페이지.
// luckyloveme API 키만 있으면 실명식 + 풀 분석 표시.
// LLM 키 있으면 실제 해석 / 없으면 안내 메시지 + 풀 명식 텍스트 미리보기.

import Link from "next/link";
import { MyeongsikTable } from "@/components/saju/MyeongsikTable";
import { ResultBody } from "@/components/saju/ResultBody";
import {
  fetchSajuAnalysis,
  formatSajuToManseryeok,
  ganjiToMyeongsik,
  isSajuApiConfigured,
  type BirthInfo,
} from "@/lib/saju/saju-api";
import { buildSajuPrompt } from "@/lib/saju/prompt";
import { generateInterpretation } from "@/lib/saju/llm";

export const metadata = { title: "데모 — 명식·결과지" };
export const dynamic = "force-dynamic"; // 항상 서버에서 새로 생성

type SearchParams = Promise<{
  y?: string; m?: string; d?: string;
  h?: string; min?: string;
  cal?: string; g?: string;
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
    ...(sp.h ? { birthHour: sp.h, birthMinute: sp.min || "0" } : { birthHour: DEFAULTS.h, birthMinute: DEFAULTS.min }),
    calendarType: (sp.cal === "음력" ? "음력" : "양력") as "양력" | "음력",
    gender: (sp.g === "female" ? "female" : "male") as "male" | "female",
  };

  // 1. 명식 호출
  let stage: "ok" | "api-missing" | "api-error" = "ok";
  let stageDetail = "";
  let myeongsik: Awaited<ReturnType<typeof ganjiToMyeongsik>> = null;
  let manseryeokText = "";
  let elapsedApi = 0;

  if (!isSajuApiConfigured()) {
    stage = "api-missing";
    stageDetail = "SAJU_API_KEY 가 .env.local 에 없습니다. 키를 채우고 서버를 재시작하세요.";
  } else {
    const t0 = Date.now();
    try {
      const analysis = await fetchSajuAnalysis(birthInfo, [], { source: "demo" });
      elapsedApi = Date.now() - t0;
      myeongsik = ganjiToMyeongsik(analysis);
      manseryeokText = formatSajuToManseryeok(analysis, birthInfo);
    } catch (err) {
      stage = "api-error";
      stageDetail = err instanceof Error ? err.message : String(err);
    }
  }

  // 2. LLM 해석 호출 (있으면)
  let interpretation = "";
  let llmInfo: { provider: string; model: string } | null = null;
  let llmError = "";
  let elapsedLlm = 0;

  if (myeongsik && manseryeokText) {
    try {
      const { system, user } = buildSajuPrompt({
        productSlug: "basic-saju",
        productName: "데모 — 기본 사주 풀이",
        myeongsik,
        manseryeokText,
        birthDate: `${birthInfo.birthYear}-${birthInfo.birthMonth.padStart(2, "0")}-${birthInfo.birthDay.padStart(2, "0")}`,
        birthTime: birthInfo.birthHour ? `${birthInfo.birthHour.padStart(2, "0")}:${(birthInfo.birthMinute ?? "00").padStart(2, "0")}` : null,
        timeUnknown: !birthInfo.birthHour,
        gender: birthInfo.gender,
        concerns: [],
      });
      const t0 = Date.now();
      const llm = await generateInterpretation({ system, user });
      elapsedLlm = Date.now() - t0;
      interpretation = llm.text;
      llmInfo = { provider: llm.provider, model: llm.model };
    } catch (err) {
      llmError = err instanceof Error ? err.message : String(err);
    }
  }

  return (
    <div className="container py-12 max-w-3xl text-night-fg">
      <header className="mb-8">
        <p className="text-xs font-mono text-mute mb-2">DEMO</p>
        <h1 className="text-3xl font-semibold tracking-tight">명식 → 결과지 흐름 데모</h1>
        <p className="mt-2 text-sm text-body">
          DB 없이 명식 + LLM 해석이 어떻게 나오는지 확인하는 페이지입니다. 결제/저장은 일어나지 않습니다.
        </p>
      </header>

      <DemoForm initial={sp} />

      {/* 상태 배지 */}
      <div className="mt-6 flex flex-wrap gap-2 text-xs font-mono">
        <Badge ok={stage === "ok"} label={`명식 API · ${stage === "ok" ? `${elapsedApi}ms` : stage}`} />
        <Badge
          ok={!!interpretation}
          label={
            interpretation
              ? `LLM · ${llmInfo?.provider}/${llmInfo?.model} · ${elapsedLlm}ms`
              : llmError ? "LLM 키 미설정/오류" : "LLM 대기"
          }
        />
      </div>

      {/* 명식 결과 */}
      <section className="mt-10">
        <h2 className="text-sm font-semibold mb-3 text-ink">사주 명식</h2>
        {myeongsik ? (
          <MyeongsikTable myeongsik={myeongsik} />
        ) : (
          <ErrorBox title={stage === "api-missing" ? "사주 API 가 설정되지 않았어요" : "사주 API 호출 실패"} detail={stageDetail} />
        )}
      </section>

      {/* LLM 해석 */}
      <section className="mt-12">
        <h2 className="text-sm font-semibold mb-3 text-ink">AI 해석</h2>
        {interpretation ? (
          <article><ResultBody markdown={interpretation} /></article>
        ) : (
          <ErrorBox
            title="LLM 해석을 생성하지 못했어요"
            detail={
              llmError ||
              `.env.local 에 ANTHROPIC_API_KEY (또는 OPENAI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY) 를 설정하고 서버를 재시작하면 실제 해석이 나옵니다.`
            }
          />
        )}
      </section>

      {/* 풀 명식 텍스트 (LLM 프롬프트에 들어가는 그대로) */}
      {manseryeokText ? (
        <section className="mt-12">
          <h2 className="text-sm font-semibold mb-3 text-ink">풀 명식 텍스트 (LLM 프롬프트 입력)</h2>
          <p className="text-xs text-mute mb-3">
            luckyloveme 16종 분석 결과를 LLM 프롬프트용 텍스트로 변환한 모습. 결과지 본문은 이 텍스트를 보고 생성됩니다.
          </p>
          <pre className="text-[11px] leading-relaxed bg-surface-soft p-4 rounded-lg border border-hairline overflow-x-auto whitespace-pre-wrap break-words max-h-[500px]">
            {manseryeokText}
          </pre>
        </section>
      ) : null}

      <footer className="mt-16 pt-8 border-t border-hairline text-xs text-mute space-y-1">
        <p>※ 이 페이지는 데모용입니다. 실제 결제 흐름은 <Link className="underline" href="/products">/products</Link> 에서 시작됩니다.</p>
        <p>※ 결제 confirm 라우트(`/api/orders/confirm`)도 동일한 어댑터(`saju-api.ts` + `prompt.ts` + `llm.ts`)를 사용합니다.</p>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────
// 폼 (GET 방식 — URL 파라미터로 재진입)
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
    <form method="GET" className="rounded-lg border border-hairline p-5 bg-canvas">
      <div className="grid grid-cols-3 gap-3 text-sm">
        <FormField name="y" label="년" defaultValue={v.y} />
        <FormField name="m" label="월" defaultValue={v.m} />
        <FormField name="d" label="일" defaultValue={v.d} />
        <FormField name="h" label="시(0-23)" defaultValue={v.h} />
        <FormField name="min" label="분(0-59)" defaultValue={v.min} />
        <div className="space-y-1">
          <label className="block text-[11px] font-mono uppercase tracking-wider text-mute">달력</label>
          <select name="cal" defaultValue={v.cal} className="w-full h-9 px-3 rounded border border-hairline bg-canvas text-ink">
            <option value="양력">양력</option>
            <option value="음력">음력</option>
          </select>
        </div>
        <div className="space-y-1 col-span-2">
          <label className="block text-[11px] font-mono uppercase tracking-wider text-mute">성별</label>
          <select name="g" defaultValue={v.g} className="w-full h-9 px-3 rounded border border-hairline bg-canvas text-ink">
            <option value="male">남성</option>
            <option value="female">여성</option>
          </select>
        </div>
        <button type="submit" className="h-9 px-4 rounded-full bg-ink text-canvas text-sm font-medium">
          명식 + 해석 생성
        </button>
      </div>
    </form>
  );
}

function FormField({ name, label, defaultValue }: { name: string; label: string; defaultValue: string }) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] font-mono uppercase tracking-wider text-mute">{label}</label>
      <input
        name={name}
        defaultValue={defaultValue}
        className="w-full h-9 px-3 rounded border border-hairline bg-canvas text-ink"
      />
    </div>
  );
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 h-7 rounded-full border ${ok ? "border-ink text-ink" : "border-hairline text-mute"}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-ink" : "bg-mute"}`} />
      {label}
    </span>
  );
}

function ErrorBox({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-lg border border-hairline bg-canvas p-4 text-sm text-body">
      <p className="font-semibold text-ink mb-1">{title}</p>
      <p className="text-xs leading-relaxed">{detail}</p>
    </div>
  );
}
