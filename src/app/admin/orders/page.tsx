import Link from "next/link";
import { requireAdminPassword } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { Badge } from "@/components/ui/badge";
import { formatKRW, formatDate } from "@/lib/utils";

export const metadata = { title: "관리자 - 결제 내역" };

type SearchParams = Promise<{ status?: string }>;

const STATUS_LABEL: Record<string, string> = {
  paid: "결제완료",
  pending: "결제대기",
  failed: "실패",
};

type OrderRow = {
  id: string;
  order_id: string;
  amount: number;
  status: string;
  created_at: string;
  user_id: string | null;
  guest_email: string | null;
  product_id: string;
  toss_payment_key: string | null;
};

export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdminPassword("/admin/orders");

  const { status } = await searchParams;
  const demoMode = !isSupabaseConfigured();

  let orders: OrderRow[] = [];
  let productMap = new Map<string, string>();
  let resultMap = new Map<string, string>();

  if (!demoMode) {
    const service = createServiceClient();

    let query = service
      .from("orders")
      .select("id, order_id, amount, status, created_at, user_id, guest_email, product_id, toss_payment_key")
      .order("created_at", { ascending: false })
      .limit(200);
    if (status && ["pending", "paid", "failed"].includes(status)) {
      query = query.eq("status", status as "pending" | "paid" | "failed");
    }
    const { data } = await query;
    orders = (data ?? []) as OrderRow[];

    const productIds = Array.from(new Set(orders.map((o) => o.product_id)));
    const { data: products } = productIds.length
      ? await service.from("products").select("id, name").in("id", productIds)
      : { data: [] };
    productMap = new Map((products ?? []).map((p) => [p.id, p.name]));

    const orderIds = orders.map((o) => o.id);
    const { data: results } = orderIds.length
      ? await service.from("saju_results").select("id, order_id").in("order_id", orderIds)
      : { data: [] };
    resultMap = new Map((results ?? []).map((r) => [r.order_id, r.id]));
  }

  const filters = [
    { key: "", label: "전체" },
    { key: "paid", label: "결제완료" },
    { key: "pending", label: "결제대기" },
    { key: "failed", label: "실패" },
  ];

  return (
    <div className="container py-12">
      <header className="mb-8">
        <p className="text-xs font-mono text-night-fg-muted mb-2">ADMIN / ORDERS</p>
        <h1 className="text-2xl font-semibold tracking-tight">결제 내역</h1>
      </header>

      {demoMode ? (
        <div className="mb-6 rounded-lg border border-hairline bg-canvas p-4 text-xs text-body leading-relaxed">
          <p className="font-semibold text-ink mb-1">데모 모드 — DB 미연결</p>
          <code className="font-mono text-ink">.env.local</code> 의 <code className="font-mono text-ink">NEXT_PUBLIC_SUPABASE_URL</code> 가 placeholder 입니다.
          실제 결제 내역을 보려면 Supabase 프로젝트를 연결하고 마이그레이션을 적용하세요.
        </div>
      ) : null}

      <div className="flex gap-2 mb-6">
        {filters.map((f) => {
          const active = (status ?? "") === f.key;
          return (
            <Link
              key={f.key || "all"}
              href={f.key ? `/admin/orders?status=${f.key}` : "/admin/orders"}
              className={`px-4 h-8 inline-flex items-center rounded-full text-sm border transition-colors ${active ? "bg-ink text-canvas border-ink" : "border-hairline text-night-fg hover:border-night-fg"}`}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <p className="text-xs text-night-fg-muted font-mono mb-3">{orders.length} ROWS</p>

      <div className="border border-hairline rounded-lg overflow-hidden">
        {orders.length === 0 ? (
          <div className="py-16 text-center text-sm text-night-fg-muted">
            {demoMode ? "데모 모드에서는 결제 내역이 비어 있습니다." : "조건에 맞는 결제 내역이 없습니다."}
          </div>
        ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-hairline">
              <th className="px-4 py-3 text-left text-[11px] font-mono uppercase tracking-wider text-night-fg-muted">생성일</th>
              <th className="px-4 py-3 text-left text-[11px] font-mono uppercase tracking-wider text-night-fg-muted">주문번호</th>
              <th className="px-4 py-3 text-left text-[11px] font-mono uppercase tracking-wider text-night-fg-muted">상품</th>
              <th className="px-4 py-3 text-left text-[11px] font-mono uppercase tracking-wider text-night-fg-muted">고객</th>
              <th className="px-4 py-3 text-right text-[11px] font-mono uppercase tracking-wider text-night-fg-muted">금액</th>
              <th className="px-4 py-3 text-left text-[11px] font-mono uppercase tracking-wider text-night-fg-muted">상태</th>
              <th className="px-4 py-3 text-left text-[11px] font-mono uppercase tracking-wider text-night-fg-muted">결과</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-hairline last:border-0">
                <td className="px-4 py-3 text-xs text-night-fg-soft">{formatDate(o.created_at)}</td>
                <td className="px-4 py-3 font-mono text-xs">{o.order_id}</td>
                <td className="px-4 py-3">{productMap.get(o.product_id) ?? "-"}</td>
                <td className="px-4 py-3 text-xs">{o.user_id ? "회원" : o.guest_email}</td>
                <td className="px-4 py-3 text-right font-mono">{formatKRW(o.amount)}</td>
                <td className="px-4 py-3">
                  <Badge
                    variant={
                      o.status === "paid" ? "success" : o.status === "failed" ? "destructive" : "secondary"
                    }
                  >
                    {STATUS_LABEL[o.status] ?? o.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  {resultMap.get(o.id) ? (
                    <Link href={`/results/${resultMap.get(o.id)}`} className="text-xs underline underline-offset-2">
                      보기
                    </Link>
                  ) : (
                    <span className="text-xs text-night-fg-muted">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
    </div>
  );
}
