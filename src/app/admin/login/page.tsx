import { redirect } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { setAdminCookie, isAdminAuthenticated, isAdminConfigured } from "@/lib/admin-auth";

export const metadata = { title: "관리자 로그인" };

type SearchParams = Promise<{ from?: string; error?: string; unconfigured?: string }>;

export default async function AdminLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { from, error, unconfigured } = await searchParams;
  const dest = from && from.startsWith("/admin") ? from : "/admin";

  // 이미 인증돼 있으면 바로 통과
  if (await isAdminAuthenticated()) redirect(dest);

  async function login(formData: FormData) {
    "use server";
    const password = String(formData.get("password") ?? "");
    const fromField = String(formData.get("from") ?? "/admin");
    const target = fromField.startsWith("/admin") ? fromField : "/admin";
    const ok = await setAdminCookie(password);
    if (!ok) {
      redirect(`/admin/login?from=${encodeURIComponent(target)}&error=1`);
    }
    redirect(target);
  }

  const configured = isAdminConfigured();

  return (
    <div className="container py-16 max-w-sm">
      <header className="mb-8">
        <p className="text-xs font-mono text-night-fg-muted mb-2">ADMIN</p>
        <h1 className="text-2xl font-semibold tracking-tight">관리자 로그인</h1>
        <p className="mt-2 text-sm text-night-fg-soft">
          <code className="font-mono text-night-fg">.env.local</code> 에 설정한{" "}
          <code className="font-mono text-night-fg">ADMIN_PASSWORD</code> 를 입력하세요.
        </p>
      </header>

      {unconfigured === "1" || !configured ? (
        <div className="mb-6 rounded-lg border border-hairline bg-canvas p-4 text-xs text-body leading-relaxed">
          <p className="font-semibold text-ink mb-1">ADMIN_PASSWORD 가 비어있어요</p>
          <code className="font-mono text-ink">.env.local</code> 에{" "}
          <code className="font-mono text-ink">ADMIN_PASSWORD=원하는비밀번호</code> 를 추가하고 서버를
          다시 시작해 주세요.
        </div>
      ) : null}

      <form action={login} className="space-y-4">
        <input type="hidden" name="from" value={dest} />
        <div>
          <Input
            type="password"
            name="password"
            placeholder="관리자 비밀번호"
            required
            autoFocus
            disabled={!configured}
          />
          {error === "1" ? (
            <p className="mt-2 text-xs text-red-600">비밀번호가 일치하지 않습니다.</p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" disabled={!configured}>
          로그인
        </Button>
      </form>
    </div>
  );
}
