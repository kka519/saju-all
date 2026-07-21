import Link from "next/link";
import { requireAdminPassword } from "@/lib/admin-auth";
import { getTotalUsage, TOTAL_LIMIT, type UsageStat } from "@/lib/saju/usage";

export const metadata = { title: "관리자" };

export default async function AdminHome() {
  await requireAdminPassword("/admin");

  const usage = await getTotalUsage();

  return (
    <div className="container py-12 max-w-xl">
      <header className="mb-10 flex items-start justify-between">
        <div>
          <p className="text-xs font-mono text-night-fg-muted mb-2">ADMIN</p>
          <h1 className="text-2xl font-semibold tracking-tight">관리자</h1>
        </div>
        <form action="/admin/logout" method="post">
          <button type="submit" className="text-xs text-night-fg-soft hover:text-night-fg underline underline-offset-2">
            로그아웃
          </button>
        </form>
      </header>

      <UsageCard usage={usage} />

      <ul className="divide-y divide-hairline border-y border-hairline mt-8">
        <li>
          <Link
            href="/admin/orders"
            className="flex items-center justify-between py-4 text-[15px] font-medium text-night-fg hover:text-night-fg-soft"
          >
            <span>결제 내역</span>
            <span className="text-night-fg-muted">→</span>
          </Link>
        </li>
      </ul>

      <p className="mt-8 text-xs text-night-fg-soft leading-relaxed">
        환불 / 결제 취소는{" "}
        <a
          href="https://app.tosspayments.com"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 text-night-fg"
        >
          토스페이먼츠 대시보드
        </a>
        에서 진행하세요.
      </p>
    </div>
  );
}

// 사주 API 누적 사용량 카드 — Supabase 미설정(데모) 시 안내 박스로 대체
function UsageCard({ usage }: { usage: UsageStat | null }) {
  if (!usage) {
    return (
      <div className="rounded-lg border border-hairline bg-canvas p-5 text-xs text-body leading-relaxed">
        <p className="font-semibold text-ink mb-1">사주 API 누적 사용량 — 데모 모드</p>
        <code className="font-mono text-ink">.env.local</code> 의 Supabase 가 placeholder 라 카운터를 표시할 수 없습니다.
        Supabase 연결 + <code className="font-mono text-ink">supabase/migrations/0004_api_usage.sql</code> 적용 후 자동으로 표시됩니다.
      </div>
    );
  }

  const pct = Math.min(100, Math.round((usage.used / usage.limit) * 100));
  const isWarn = pct >= 80 && pct < 100;
  const isOver = pct >= 100;

  // 누적 사용량 카드 — 80% amber, 100% red
  const borderClass = isOver
    ? "border-red-500"
    : isWarn
      ? "border-amber-500"
      : "border-hairline";
  const fillClass = isOver ? "bg-red-500" : isWarn ? "bg-amber-500" : "bg-ink";

  return (
    <div className={`rounded-lg border ${borderClass} bg-canvas p-5`}>
      <p className="text-xs font-mono text-mute uppercase tracking-wider mb-2">
        사주 API 누적 사용량
      </p>
      <p className="text-2xl font-semibold text-ink font-mono">
        {usage.used.toLocaleString()}{" "}
        <span className="text-base text-body">/ {usage.limit.toLocaleString()}회</span>
      </p>

      {/* 진행 바 */}
      <div className="mt-3 h-2 rounded-full bg-surface-soft overflow-hidden">
        <div className={`h-full ${fillClass}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[11px] font-mono text-mute">{pct}%</p>

      {/* source 별 breakdown */}
      <ul className="mt-4 space-y-1 text-xs text-body">
        <SourceRow label="confirm" hint="결제 후 결과지" count={usage.bySource.confirm} />
        <SourceRow label="demo" hint="/demo 페이지" count={usage.bySource.demo} />
        <SourceRow label="manual" hint="/api/generate-manseryeok" count={usage.bySource.manual} />
      </ul>

      {isOver ? (
        <p className="mt-4 text-xs text-red-600 leading-relaxed">
          한도 초과 — luckyloveme 콘솔에서 한도 증액을 요청하세요.
        </p>
      ) : isWarn ? (
        <p className="mt-4 text-xs text-amber-600 leading-relaxed">
          80% 도달 — 한도 도달 전 luckyloveme 콘솔 확인 권장.
        </p>
      ) : null}

      {/* 무한 캐시 방지용 안내 */}
      <p className="mt-4 text-[11px] text-mute">
        한도 {TOTAL_LIMIT.toLocaleString()}회는{" "}
        <code className="font-mono">src/lib/saju/usage.ts</code> 의{" "}
        <code className="font-mono">TOTAL_LIMIT</code> 에서 조정.
      </p>
    </div>
  );
}

function SourceRow({ label, hint, count }: { label: string; hint: string; count: number }) {
  return (
    <li className="flex items-baseline gap-2">
      <span className="font-mono text-ink min-w-[60px]">{label}</span>
      <span className="font-mono text-ink tabular-nums min-w-[60px] text-right">
        {count.toLocaleString()}
      </span>
      <span className="text-mute text-[11px]">{hint}</span>
    </li>
  );
}
