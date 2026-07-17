// =====================================================
// POST /api/couple-reports/[id]/generate
// =====================================================
// 커플 궁합 리포트(20페이지 PDF) 생성 파이프라인 — 인생 애널리스트 리포트
// (/api/reports/[id]/generate)와 동일한 비동기 구조를 그대로 복제.
// 즉시 202 응답 후 after() 콜백으로 백그라운드 실행.
//
// Phase B(2026-07-17) — 실제 23필드 LLM 콘텐츠 + §5/§9 진실 원천 게이트 +
// 20페이지 NAVY/GOLD 템플릿(couple-report.hbs)으로 Phase A 더미를 교체했다.
//
// ⚠️ Vercel 미배포 상태 — maxDuration 실효성은 실배포 후 재검증 필요.

import { after, NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { fetchMyeongsikWithFallback, toBirthInfo, type BirthInputLike } from "@/lib/saju/fetch-myeongsik";
import { COUPLE_MATCH_FIELDS, formatSajuToManseryeok, type SajuAnalysisResponse } from "@/lib/saju/saju-api";
import { computeCoupleRelationMatrix } from "@/lib/report/couple/relation-matrix";
import { computeCoupleSeunSeries } from "@/lib/report/couple/couple-seun-data";
import { computeCoupleWolunHighlight } from "@/lib/report/couple/couple-wolun-data";
import { resolveCoupleNames } from "@/lib/report/couple/prompts";
import { generateCoupleContentWithRetry } from "@/lib/report/couple/generate";
import { computeCoupleTypeNames } from "@/lib/report/couple/type-names";
import { judgeRelationshipType } from "@/lib/report/couple/section9";
import { buildCoupleTemplateContext } from "@/lib/report/couple/build-couple-template-context";
import { renderCoupleReportHtml } from "@/lib/report/couple/render-couple-html";
import { renderPdf } from "@/lib/report/template/render-pdf";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_ATTEMPTS = 3;

// weolun 필드는 COUPLE_MATCH_FIELDS 예산 절약을 위해 프롬프트 텍스트(만세력)에서는
// 제외하고 코드 계산(온도 타이밍)에만 쓴다 — saju-api.ts COUPLE_MATCH_FIELDS 주석 참고.
function stripWeolun(a: SajuAnalysisResponse | null): SajuAnalysisResponse | null {
  if (!a) return null;
  const { weolun: _weolun, ...rest } = a;
  return rest;
}

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

    const selfInput: BirthInputLike = {
      birth_date: input.birth_date,
      birth_time: input.birth_time,
      time_unknown: input.time_unknown,
      gender: input.gender,
      calendar: input.calendar,
      is_leap_month: input.is_leap_month,
    };
    const partnerInput: BirthInputLike = {
      birth_date: input.partner_birth_date,
      birth_time: input.partner_birth_time ?? null,
      time_unknown: input.partner_time_unknown ?? false,
      gender: input.partner_gender,
      calendar: input.partner_calendar,
      is_leap_month: input.partner_is_leap_month ?? false,
    };

    // 본인+상대방 2회 fetch(기존과 동일 호출 횟수 — luckyloveme 소진 방어) + weolun
    // 추가(온도 타이밍 코드 계산용, 프롬프트 텍스트에는 넣지 않음).
    const [self, partner] = await Promise.all([
      fetchMyeongsikWithFallback(selfInput, [...COUPLE_MATCH_FIELDS, "weolun"]),
      fetchMyeongsikWithFallback(partnerInput, [...COUPLE_MATCH_FIELDS, "weolun"]),
    ]);

    const selfManseryeokText = self.fullAnalysis
      ? formatSajuToManseryeok(stripWeolun(self.fullAnalysis)!, toBirthInfo(selfInput))
      : (self.manseryeokText ?? "");
    const partnerManseryeokText = partner.fullAnalysis
      ? formatSajuToManseryeok(stripWeolun(partner.fullAnalysis)!, toBirthInfo(partnerInput))
      : (partner.manseryeokText ?? "");

    const reportJson = {
      self: { myeongsik: self.myeongsik, manseryeokText: selfManseryeokText },
      partner: { myeongsik: partner.myeongsik, manseryeokText: partnerManseryeokText },
    };
    await service
      .from("couple_reports")
      .update({ report_json: reportJson as never, updated_at: new Date().toISOString() })
      .eq("id", reportId);

    const matrix = computeCoupleRelationMatrix(
      { myeongsik: self.myeongsik, fullAnalysis: self.fullAnalysis },
      { myeongsik: partner.myeongsik, fullAnalysis: partner.fullAnalysis },
    );
    const seunSeries = computeCoupleSeunSeries(self.fullAnalysis, partner.fullAnalysis, new Date().getFullYear());
    const wolunHighlight = computeCoupleWolunHighlight(
      self.fullAnalysis,
      partner.fullAnalysis,
      matrix.selfView.pillars.day.jiji,
      matrix.partnerView.pillars.day.jiji,
    );
    const names = resolveCoupleNames(input.name, input.partner_name);

    await setStage("llm_parts", 25);
    const result = await generateCoupleContentWithRetry({
      names,
      selfManseryeokText,
      partnerManseryeokText,
      matrix,
      seunSeries,
      wolunHighlight,
    });
    if (result.remainingIssues.length > 0) {
      console.warn(`[couple-report] ${reportId} 잔여 게이트 위반 ${result.remainingIssues.length}건:`, result.remainingIssues);
    }

    const typeNames = computeCoupleTypeNames(matrix.selfView, matrix.partnerView);
    // §9 코드 판정 — buildCoupleContentPrompt가 프롬프트 생성 시 이미 계산한 값과
    // 반드시 같은 로직(judgeRelationshipType)을 재사용해야 본문 표기와 템플릿
    // 표기가 어긋나지 않는다.
    const relationshipType = judgeRelationshipType(matrix);

    await service
      .from("couple_reports")
      .update({
        sections_part1: result.sections as never,
        sections_part2: { typeNames, relationshipType, wolunHighlight, remainingIssues: result.remainingIssues } as never,
        llm_provider: result.provider,
        llm_model: result.model,
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

    const context = buildCoupleTemplateContext({
      names,
      matrix,
      selfFullAnalysis: self.fullAnalysis,
      partnerFullAnalysis: partner.fullAnalysis,
      seunSeries,
      wolunHighlight,
      sections: result.sections,
      relationshipType: judgeRelationshipType(matrix),
      typeNames,
      meta: { reportDateLabel: today },
    });
    const html = renderCoupleReportHtml(context);

    await setStage("rendering_pdf", 92);
    const { buffer, pageCount } = await renderPdf(html);
    if (pageCount !== 20) {
      console.warn(`[couple-report] ${reportId} 페이지수 ${pageCount} (기대값 20) — 콘텐츠 길이 편차로 발생 가능, 배포 전 육안 확인 필요`);
    }

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
