import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata = { title: "후기 작성" };

export default async function WriteReviewPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=/mypage/orders/${orderId}/review`);

  const service = createServiceClient();
  const { data: order } = await service
    .from("orders")
    .select("id, status, user_id, product_id")
    .eq("id", orderId)
    .maybeSingle();

  if (!order) notFound();
  if (order.user_id !== user.id) {
    return (
      <div className="container py-16 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>접근 불가</CardTitle>
            <CardDescription>본인 주문만 후기를 작성할 수 있어요.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  if (order.status !== "paid") {
    return (
      <div className="container py-16 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>결제 완료 후 작성 가능</CardTitle>
            <CardDescription>결제가 완료된 주문에만 후기를 작성할 수 있습니다.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // 이미 후기가 있으면 안내
  const { data: existing } = await service
    .from("reviews")
    .select("id")
    .eq("order_id", order.id)
    .maybeSingle();
  if (existing) {
    return (
      <div className="container py-16 max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>이미 후기를 작성했어요</CardTitle>
            <CardDescription>주문당 1개의 후기만 등록할 수 있습니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/mypage/reviews" className="text-sm font-medium underline">
              내 후기 보러 가기 →
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { data: product } = await service
    .from("products")
    .select("name")
    .eq("id", order.product_id)
    .single();

  return (
    <div className="container py-12 max-w-xl">
      <header className="mb-8">
        <p className="text-xs font-mono text-night-fg-muted mb-2">REVIEW</p>
        <h1 className="text-2xl font-semibold tracking-tight">후기 작성</h1>
      </header>
      <Card>
        <CardContent className="pt-6">
          <ReviewForm orderId={order.id} productName={product?.name ?? "-"} />
        </CardContent>
      </Card>
    </div>
  );
}
