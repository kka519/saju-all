import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/server";

export const metadata = { title: "인생 애널리스트 리포트" };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = createServiceClient();

  const { data: report } = await service
    .from("life_analyst_reports")
    .select("status, pdf_page_count, error_message, sections_part1")
    .eq("id", id)
    .maybeSingle();

  if (!report) notFound();

  if (report.status !== "done") {
    return (
      <div className="container py-16 max-w-md text-center">
        <p className="text-night-fg-soft">
          아직 준비되지 않은 리포트예요.{" "}
          <Link href={`/reports/${id}/progress`} className="text-starlight underline">
            진행 상황 보기
          </Link>
        </p>
      </div>
    );
  }

  const headline = (report.sections_part1 as { headline?: string } | null)?.headline;

  return (
    <div className="container py-16 max-w-md">
      <div className="rounded-2xl border border-night-border bg-night-secondary p-8 text-center">
        <Image
          src="/characters/doori/doori-magic.png"
          alt="두리"
          width={96}
          height={96}
          className="mx-auto rounded-full ring-2 ring-starlight/40"
        />
        <h1 className="mt-6 text-xl font-semibold text-night-fg">인생 애널리스트 리포트가 완성됐어요</h1>
        {headline && <p className="mt-3 text-sm text-night-fg-soft">{headline}</p>}
        <p className="mt-1 text-xs text-night-fg-muted font-mono">{report.pdf_page_count}페이지</p>

        <a
          href={`/api/reports/${id}/download`}
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
