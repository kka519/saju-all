// =====================================================
// GET /api/reports/[id]/status
// =====================================================
// progress 페이지가 3초 간격으로 폴링하는 저비용 상태 조회.

import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = createServiceClient();

  const { data: report } = await service
    .from("life_analyst_reports")
    .select("status, stage, progress_pct, pdf_page_count, error_message, attempt_count, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (!report) {
    return NextResponse.json({ error: "리포트를 찾을 수 없습니다" }, { status: 404 });
  }

  // 큐 인프라가 없어 인스턴스가 재활용되며 중간에 끊기는 경우를 대비 —
  // generating 상태인데 6분 이상 갱신이 없으면 클라이언트에 stalled 로 알려
  // "다시 시도" 버튼을 띄우게 한다 (§7 계획의 방어선).
  const STALL_MS = 6 * 60 * 1000;
  const isStalled =
    report.status === "generating" &&
    Date.now() - new Date(report.updated_at).getTime() > STALL_MS;

  return NextResponse.json({
    status: isStalled ? "failed" : report.status,
    stage: report.stage,
    progressPct: report.progress_pct,
    pdfPageCount: report.pdf_page_count,
    errorMessage: isStalled ? "생성이 중단된 것으로 보여요. 다시 시도해 주세요." : report.error_message,
    attemptCount: report.attempt_count,
  });
}
