// =====================================================
// POST /api/reports/[id]/generate
// =====================================================
// 인생 애널리스트 리포트 생성 파이프라인 트리거.
// 즉시 202 응답 후 after() 콜백으로 백그라운드 실행 — 결제 확인(confirm) 요청을
// 블로킹하지 않기 위해 이미 pending 행이 생성된 뒤 클라이언트(progress 페이지)가
// 별도로 호출하는 라우트. 클라이언트는 응답을 기다리지 않고 /status 폴링만 함.
//
// ⚠️ Vercel 미배포 상태 — maxDuration 실효성은 실배포 후 재검증 필요(Hobby 플랜이면
//    이 값이 무의미하며 오케스트레이션을 여러 개의 짧은 호출로 재설계해야 함).

import { after, NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchSajuAnalysis, ganjiToMyeongsik } from "@/lib/saju/saju-api";
import { buildMyeongsikView } from "@/lib/saju/build-myeongsik-view";
import { buildReportData } from "@/lib/report/normalize";
import { generateAllSections } from "@/lib/report/prompts/build-sections";
import { buildTemplateContext } from "@/lib/report/template/build-template-context";
import { renderReportHtml } from "@/lib/report/template/render-html";
import { renderPdf } from "@/lib/report/template/render-pdf";
import type { BirthInfo } from "@/lib/saju/saju-api";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_ATTEMPTS = 3;

function toBirthInfo(input: {
  birth_date: string;
  birth_time: string | null;
  time_unknown: boolean;
  gender: "male" | "female";
  calendar: "solar" | "lunar";
}): BirthInfo {
  const [y, m, d] = input.birth_date.split("-");
  const hasTime = !input.time_unknown && !!input.birth_time;
  const [hh, mm] = hasTime ? input.birth_time!.split(":") : [undefined, undefined];
  return {
    birthYear: y,
    birthMonth: String(parseInt(m, 10)),
    birthDay: String(parseInt(d, 10)),
    ...(hasTime ? { birthHour: String(parseInt(hh!, 10)), birthMinute: String(parseInt(mm!, 10)) } : {}),
    calendarType: input.calendar === "lunar" ? "음력" : "양력",
    gender: input.gender,
  };
}

async function runPipeline(reportId: string) {
  const service = createServiceClient();

  const setStage = async (stage: string, progress_pct: number) => {
    await service
      .from("life_analyst_reports")
      .update({ stage, progress_pct, updated_at: new Date().toISOString() })
      .eq("id", reportId);
  };

  try {
    const { data: report } = await service
      .from("life_analyst_reports")
      .select("order_id")
      .eq("id", reportId)
      .single();
    if (!report) throw new Error("리포트 행을 찾을 수 없습니다.");

    const { data: input } = await service
      .from("saju_inputs")
      .select("birth_date, birth_time, time_unknown, gender, calendar")
      .eq("order_id", report.order_id)
      .single();
    if (!input) throw new Error("사주 입력을 찾을 수 없습니다.");

    await setStage("normalizing", 5);
    const birthInfo = toBirthInfo(input);
    const analysis = await fetchSajuAnalysis(birthInfo, [], { source: "confirm" });
    const myeongsik = ganjiToMyeongsik(analysis);
    if (!myeongsik) throw new Error("명식 변환 실패 (ganji 데이터 누락)");
    const view = buildMyeongsikView(myeongsik, analysis);
    const data = buildReportData(view, analysis);

    await service
      .from("life_analyst_reports")
      .update({ report_json: data as never, updated_at: new Date().toISOString() })
      .eq("id", reportId);

    // 4파트 병렬 호출 — 개별 파트 진행률은 알 수 없으므로 시작 시점 한 번만 갱신.
    // (레퍼런스 대조 후 파트별 분량을 늘리며 순차 호출로는 maxDuration 위험 → 병렬 전환)
    await setStage("llm_parts", 25);
    const sections = await generateAllSections(data, async (stage) => {
      await setStage(stage, 30);
    });

    await service
      .from("life_analyst_reports")
      .update({
        sections_part1: sections.part1 as never,
        sections_part2: sections.part2 as never,
        sections_part3: sections.part3 as never,
        sections_part4: sections.part4 as never,
        llm_provider: sections.llmProvider,
        llm_model: sections.llmModel,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId);

    await setStage("rendering", 88);
    const today = new Date().toLocaleDateString("ko-KR", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const birthDateLabel = `${input.calendar === "lunar" ? "음력" : "양력"} ${input.birth_date}`;
    const birthTimeLabel = !input.time_unknown && input.birth_time ? input.birth_time.slice(0, 5) : "시 미상";
    const context = buildTemplateContext(data, sections, {
      reportDateLabel: today,
      myeongsikId: reportId.slice(0, 8).toUpperCase(),
      birthDateLabel,
      birthTimeLabel,
      genderLabel: input.gender === "female" ? "여성" : "남성",
    });
    const html = renderReportHtml(context);

    await setStage("rendering_pdf", 92);
    const { buffer, pageCount } = await renderPdf(html);

    if (pageCount !== 20) {
      throw new Error(`페이지수 불일치: ${pageCount} (목표 20) — 발송 보류, 관리자 확인 필요`);
    }

    await setStage("uploading", 96);
    const pdfPath = `${report.order_id}/report.pdf`;
    const { error: uploadErr } = await service.storage
      .from("reports")
      .upload(pdfPath, buffer, { contentType: "application/pdf", upsert: true });
    if (uploadErr) throw new Error(`PDF 업로드 실패: ${uploadErr.message}`);

    await service
      .from("life_analyst_reports")
      .update({
        status: "done",
        stage: "done",
        progress_pct: 100,
        pdf_path: pdfPath,
        pdf_page_count: pageCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId);
  } catch (err) {
    console.error("[life-analyst-report] 생성 실패:", err);
    await service
      .from("life_analyst_reports")
      .update({
        status: "failed",
        error_message: err instanceof Error ? err.message : String(err),
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId);
  }
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const service = createServiceClient();

  const { data: report } = await service
    .from("life_analyst_reports")
    .select("status, attempt_count")
    .eq("id", id)
    .maybeSingle();

  if (!report) {
    return NextResponse.json({ error: "리포트를 찾을 수 없습니다" }, { status: 404 });
  }
  if (report.status === "generating" || report.status === "done") {
    return NextResponse.json({ ok: true, status: report.status });
  }
  if (report.attempt_count >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "재시도 횟수를 초과했습니다. 고객센터로 문의해 주세요." }, { status: 429 });
  }

  await service
    .from("life_analyst_reports")
    .update({
      status: "generating",
      stage: "queued",
      progress_pct: 1,
      attempt_count: report.attempt_count + 1,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  after(() => runPipeline(id));

  return NextResponse.json({ ok: true, status: "generating" }, { status: 202 });
}
