import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";

export const metadata = { title: "커플 궁합 리포트" };

export default async function CoupleReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = createServiceClient();

  const { data: report } = await service
    .from("couple_reports")
    .select("status, pdf_page_count")
    .eq("id", id)
    .maybeSingle();

  if (!report) notFound();

  if (report.status !== "done") {
    return (
      <div className="container py-16 max-w-md text-center">
        <p className="text-night-fg-soft">
          아직 준비되지 않은 리포트입니다.{" "}
          <Link href={`/couple-reports/${id}/progress`} className="text-starlight underline">
            진행 상황 보기
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="container py-16 max-w-md">
      <div className="rounded-2xl border border-night-border bg-night-secondary p-8 text-center">
        <p className="text-xs font-mono tracking-[0.2em] text-[#C9A84C]">LUNA LIFE RESEARCH</p>
        <h1 className="mt-3 text-xl font-semibold text-night-fg">커플 궁합 리포트가 완성됐습니다</h1>
        <p className="mt-1 text-xs text-night-fg-muted font-mono">{report.pdf_page_count}페이지</p>

        <a
          href={`/api/couple-reports/${id}/download`}
          className="mt-8 inline-flex h-11 w-full items-center justify-center rounded-full bg-starlight px-5 text-sm font-medium text-night-primary hover:bg-starlight-soft transition-colors"
        >
          PDF 다운로드
        </a>
        <Link
          href="/"
          className="mt-3 inline-flex h-11 w-full items-center justify-center rounded-full border border-night-border text-sm font-medium text-night-fg-soft hover:bg-night-elevated transition-colors"
        >
          홈으로
        </Link>
      </div>
    </div>
  );
}
