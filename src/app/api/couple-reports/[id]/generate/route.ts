// =====================================================
// POST /api/couple-reports/[id]/generate
// =====================================================
// 커플 궁합 리포트(20페이지 PDF) 생성 파이프라인 — 인생 애널리스트 리포트
// (/api/reports/[id]/generate)와 동일한 비동기 구조를 그대로 복제.
// 즉시 202 응답 후 after() 콜백으로 백그라운드 실행.
//
// ⚠️ Phase A(파이프라인 골격) — 5파트 콘텐츠는 더미 텍스트다. 실제 LLM 프롬프트
// 설계·용신 게이트·20페이지 NAVY/GOLD 템플릿은 Phase B에서 교체한다
// (기획_궁합리포트_합병리서치_20260715.md §7). 그래서 life-analyst-report와 달리
// pdf_page_count 를 20으로 엄격 검증하지 않는다 — Phase B에서 정식 템플릿이
// 들어오면 활성화.
//
// ⚠️ Vercel 미배포 상태 — maxDuration 실효성은 실배포 후 재검증 필요.

import { after, NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchMyeongsikWithFallback } from "@/lib/saju/fetch-myeongsik";
import { COUPLE_MATCH_FIELDS } from "@/lib/saju/saju-api";
import { renderDummyCoupleReportHtml } from "@/lib/report/couple/render-dummy-html";
import { renderPdf } from "@/lib/report/template/render-pdf";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_ATTEMPTS = 3;

async function runPipeline(reportId: string) {
  const service = createServiceClient();

  const setStage = async (stage: string, progress_pct: number) => {
    await service
      .from("couple_reports")
      .update({ stage, progress_pct, updated_at: new Date().toISOString() })
      .eq("id", reportId);
  };

  try {
    const { data: report } = await service
      .from("couple_reports")
      .select("order_id")
      .eq("id", reportId)
      .single();
    if (!report) throw new Error("리포트 행을 찾을 수 없습니다.");

    const { data: input } = await service
      .from("saju_inputs")
      .select(
        "name, birth_date, birth_time, time_unknown, gender, calendar, is_leap_month, partner_name, partner_birth_date, partner_birth_time, partner_time_unknown, partner_gender, partner_calendar, partner_is_leap_month",
      )
      .eq("order_id", report.order_id)
      .single();
    if (!input) throw new Error("사주 입력을 찾을 수 없습니다.");
    if (!input.partner_birth_date || !input.partner_gender || !input.partner_calendar) {
      throw new Error("상대방 정보가 없어 궁합 리포트를 생성할 수 없습니다.");
    }

    await setStage("normalizing", 5);

    // 본인+상대방 2회 fetch — couple-match 채팅형 시절과 동일 로직 재사용
    // (fetch-myeongsik.ts, COUPLE_MATCH_FIELDS 경량 필드셋).
    const [self, partner] = await Promise.all([
      fetchMyeongsikWithFallback(
        {
          birth_date: input.birth_date,
          birth_time: input.birth_time,
          time_unknown: input.time_unknown,
          gender: input.gender,
          calendar: input.calendar,
          is_leap_month: input.is_leap_month,
        },
        COUPLE_MATCH_FIELDS,
      ),
      fetchMyeongsikWithFallback(
        {
          birth_date: input.partner_birth_date,
          birth_time: input.partner_birth_time ?? null,
          time_unknown: input.partner_time_unknown ?? false,
          gender: input.partner_gender,
          calendar: input.partner_calendar,
          is_leap_month: input.partner_is_leap_month ?? false,
        },
        COUPLE_MATCH_FIELDS,
      ),
    ]);

    const reportJson = {
      self: { myeongsik: self.myeongsik, manseryeokText: self.manseryeokText ?? null },
      partner: { myeongsik: partner.myeongsik, manseryeokText: partner.manseryeokText ?? null },
    };

    await service
      .from("couple_reports")
      .update({
        report_json: reportJson as never,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId);

    // Phase A — 5파트 전부 더미 텍스트. Phase B에서 실제 프롬프트(§3 페이지맵,
    // §5 진실 원천 게이트)로 교체.
    await setStage("llm_parts", 25);
    const dummyParts = {
      part1: "[Phase A 더미] 관계 개요 — 실제 콘텐츠는 Phase B에서 생성됩니다.",
      part2: "[Phase A 더미] 시너지·리스크 공시 — 실제 콘텐츠는 Phase B에서 생성됩니다.",
      part3: "[Phase A 더미] 리스크 관리·케미스트리 — 실제 콘텐츠는 Phase B에서 생성됩니다.",
      part4: "[Phase A 더미] 재무·장기 적합성·백테스트 — 실제 콘텐츠는 Phase B에서 생성됩니다.",
      part5: "[Phase A 더미] 캘린더·위기 시나리오·로드맵·총평 — 실제 콘텐츠는 Phase B에서 생성됩니다.",
    };

    await service
      .from("couple_reports")
      .update({
        sections_part1: dummyParts.part1 as never,
        sections_part2: dummyParts.part2 as never,
        sections_part3: dummyParts.part3 as never,
        sections_part4: dummyParts.part4 as never,
        sections_part5: dummyParts.part5 as never,
        llm_provider: "dummy",
        llm_model: "phase-a-placeholder",
        updated_at: new Date().toISOString(),
      })
      .eq("id", reportId);

    await setStage("rendering", 88);
    const html = renderDummyCoupleReportHtml({
      selfName: input.name || "본인",
      partnerName: input.partner_name || "상대방",
      parts: dummyParts,
    });

    await setStage("rendering_pdf", 92);
    const { buffer, pageCount } = await renderPdf(html);

    await setStage("uploading", 96);
    const pdfPath = `${report.order_id}/couple-report.pdf`;
    const { error: uploadErr } = await service.storage
      .from("reports")
      .upload(pdfPath, buffer, { contentType: "application/pdf", upsert: true });
    if (uploadErr) throw new Error(`PDF 업로드 실패: ${uploadErr.message}`);

    await service
      .from("couple_reports")
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
    console.error("[couple-report] 생성 실패:", err);
    await service
      .from("couple_reports")
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
    .from("couple_reports")
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
    .from("couple_reports")
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
