// =====================================================
// GET /api/reports/[id]/download
// =====================================================
// Supabase Storage private 버킷(reports)의 서명 URL을 발급해 리다이렉트.
// 결과 페이지(results/[resultId])와 동일 관례 — UUID 자체를 접근 토큰으로 취급,
// 별도 소유자 인증 없음(게스트 결제 흐름 지원).

import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

const SIGNED_URL_TTL_SECONDS = 60 * 5;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = createServiceClient();

  const { data: report } = await service
    .from("life_analyst_reports")
    .select("status, pdf_path")
    .eq("id", id)
    .maybeSingle();

  if (!report || report.status !== "done" || !report.pdf_path) {
    return NextResponse.json({ error: "아직 준비되지 않은 리포트예요" }, { status: 404 });
  }

  const { data: signed, error } = await service.storage
    .from("reports")
    .createSignedUrl(report.pdf_path, SIGNED_URL_TTL_SECONDS);

  if (error || !signed) {
    return NextResponse.json({ error: "다운로드 링크 생성 실패", detail: error?.message }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
