import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "마이페이지" };

export default async function MyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/mypage");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const items = [
    { href: "/free-fortune", label: "오늘의 무료 운세" },
    { href: "/mypage/orders", label: "결제 내역 / 결과지" },
    { href: "/mypage/reviews", label: "내 후기" },
  ];

  return (
    <div className="container py-12 max-w-xl">
      <header className="mb-10">
        <p className="text-xs font-mono text-night-fg-muted mb-2">ACCOUNT</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {profile?.display_name ?? user.email}
        </h1>
        <p className="text-sm text-night-fg-soft mt-1">{profile?.email ?? user.email}</p>
      </header>

      <ul className="divide-y divide-hairline border-y border-hairline">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="flex items-center justify-between py-4 text-[15px] font-medium text-night-fg hover:text-night-fg-soft"
            >
              <span>{item.label}</span>
              <span className="text-night-fg-muted">→</span>
            </Link>
          </li>
        ))}
        <li>
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="w-full flex items-center justify-between py-4 text-[15px] font-medium text-night-fg-soft hover:text-night-fg"
            >
              <span>로그아웃</span>
            </button>
          </form>
        </li>
      </ul>
    </div>
  );
}
