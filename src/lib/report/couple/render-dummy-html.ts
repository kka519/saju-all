// =====================================================
// 커플 궁합 리포트 — Phase A 더미 HTML 렌더러
// =====================================================
// Phase A(파이프라인 골격) 전용 — 실제 20페이지 NAVY/GOLD 템플릿은 Phase B에서
// report.hbs 변형으로 새로 작성한다(기획_궁합리포트_합병리서치_20260715.md §7).
// 여기서는 파트별 더미 텍스트를 페이지로 펼쳐 status/stage/progress_pct 폴링,
// PDF 렌더링, storage 업로드, 다운로드까지 파이프라인 전체가 실제로 동작하는지만
// 증명한다 — 정식 레이아웃·차트·용신 게이트는 Phase B 범위.

import Handlebars from "handlebars";
import { getFontFaceCss } from "@/lib/report/template/font-face";

export type DummyCoupleReportParts = {
  part1: string;
  part2: string;
  part3: string;
  part4: string;
  part5: string;
};

export function renderDummyCoupleReportHtml(params: {
  selfName: string;
  partnerName: string;
  parts: DummyCoupleReportParts;
}): string {
  const { selfName, partnerName, parts } = params;
  const pageLabels: Array<{ label: string; body: string }> = [
    { label: "표지", body: `COUPLE MERGER RESEARCH<br>${escapeHtml(selfName)} × ${escapeHtml(partnerName)}` },
    { label: "PART 1 — 관계 개요 (더미)", body: escapeHtml(parts.part1) },
    { label: "PART 2 — 시너지·리스크 공시 (더미)", body: escapeHtml(parts.part2) },
    { label: "PART 3 — 리스크 관리·케미스트리 (더미)", body: escapeHtml(parts.part3) },
    { label: "PART 4 — 재무·장기 적합성·백테스트 (더미)", body: escapeHtml(parts.part4) },
    { label: "PART 5 — 캘린더·위기·로드맵·총평 (더미)", body: escapeHtml(parts.part5) },
  ];

  const pagesHtml = pageLabels
    .map(
      (p) => `
    <div class="page">
      <div class="band"><span class="brand">LUNA LIFE RESEARCH</span><span class="doctype">COUPLE MERGER RESEARCH</span></div>
      <h1 class="title">${p.label}</h1>
      <p class="body">${p.body.replace(/\n/g, "<br>")}</p>
    </div>`,
    )
    .join("\n");

  const template = Handlebars.compile(
    `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<style>
{{{fontFaceCss}}}
* { margin:0; padding:0; box-sizing:border-box; }
@page { size:A4; margin:0; }
body { font-family:'NotoKR', "Apple SD Gothic Neo", sans-serif; color:#222; font-size:9pt; line-height:1.55; counter-reset:rpage; }
.page { width:210mm; height:297mm; padding:13mm 16mm; page-break-after:always; position:relative; overflow:hidden; counter-increment:rpage; }
.page:last-child { page-break-after:auto; }
.band { background:#1A1A2E; color:#fff; margin:-13mm -16mm 7mm -16mm; padding:6mm 16mm 5mm 16mm; }
.band .brand { font-size:8pt; letter-spacing:2.5px; color:#C9A84C; font-weight:bold; }
.band .doctype { float:right; font-size:8pt; color:#aab; }
h1.title { font-family:'NotoSerifKR', serif; font-weight:bold; font-size:16pt; color:#1A1A2E; margin:4mm 0; }
p.body { text-align:justify; white-space:pre-wrap; }
</style>
</head>
<body>
{{{pages}}}
</body>
</html>`,
    { noEscape: false },
  );

  return template({
    fontFaceCss: new Handlebars.SafeString(getFontFaceCss()),
    pages: new Handlebars.SafeString(pagesHtml),
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
