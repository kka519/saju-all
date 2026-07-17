// =====================================================
// 커플 궁합 리포트 — 명식표 2단 (p3)
// =====================================================
// 지시문_궁합PDF_비주얼3종_20260715.md §1 — report.hbs P.4 명식 원판 표(시/일/월/년,
// class="grid"/"hanja")를 좌우 2단으로 변형. 좌: 본인(GOLD 헤더), 우: 상대(PARTNER_BLUE
// 헤더). 시 모름이면 시주 칸 "시 미상" 표시. 인라인 스타일은 report.hbs의 .grid/.hanja
// 클래스명과 동일하게 맞춰 나중에 전체 템플릿에 합칠 때 CSS 중복 없이 재사용 가능하게 한다.

import { GOLD, PARTNER_BLUE, NAVY } from "../charts/tokens";
import type { MyeongsikViewModel, PillarView } from "@/lib/saju/build-myeongsik-view";
import type { SajuAnalysisResponse } from "@/lib/saju/saju-api";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function pillarCell(p: PillarView | null, accentColor: string, isDayPillar: boolean): string {
  if (!p) return `<td class="l" style="color:#999">시 미상</td>`;
  const color = isDayPillar ? accentColor : NAVY;
  return `<td class="hanja" style="color:${color}">
    <div>${escapeHtml(p.cheonganHanja ?? p.cheongan)}<br><small>${escapeHtml(p.cheongan)}</small></div>
    <div style="margin-top:1mm;">${escapeHtml(p.jijiHanja ?? p.jiji)}<br><small>${escapeHtml(p.jiji)}</small></div>
  </td>`;
}

function singleTable(
  view: MyeongsikViewModel,
  fullAnalysis: SajuAnalysisResponse | null,
  name: string,
  accentColor: string,
): string {
  const { pillars } = view;
  const sinStrength = (fullAnalysis as Record<string, unknown> | null)?.sinStrength as
    | { strength?: string; score?: number }
    | undefined;
  const sinKang = sinStrength?.strength ? `${sinStrength.strength}(${sinStrength.score}점)` : "";
  const dayOheng = pillars.day.cheonganOhaeng ?? "";

  return `
  <div style="flex:1; min-width:0;">
    <div style="background:${accentColor}; color:${NAVY}; padding:2mm 3mm; border-radius:3px 3px 0 0; font-weight:bold; font-size:9.5pt;">
      ${escapeHtml(name)}의 명식
    </div>
    <table class="grid small" style="margin-top:0;">
      <tr><th style="width:22%"></th><th>시주</th><th>일주</th><th>월주</th><th>년주</th></tr>
      <tr>
        <td class="l"><b>천간·지지</b></td>
        ${pillarCell(pillars.hour, accentColor, false)}
        ${pillarCell(pillars.day, accentColor, true)}
        ${pillarCell(pillars.month, accentColor, false)}
        ${pillarCell(pillars.year, accentColor, false)}
      </tr>
      <tr>
        <td class="l"><b>십성</b></td>
        <td>${pillars.hour ? escapeHtml(pillars.hour.sipseongCheongan ?? "—") : "—"}</td>
        <td style="color:${accentColor}"><b>일간</b></td>
        <td>${escapeHtml(pillars.month.sipseongCheongan ?? "—")}</td>
        <td>${escapeHtml(pillars.year.sipseongCheongan ?? "—")}</td>
      </tr>
    </table>
    <p style="font-size:8pt; color:#666; margin-top:1.5mm;">
      일간 오행 <b>${escapeHtml(dayOheng)}</b> · ${escapeHtml(sinKang || "신강신약 미상")}
    </p>
  </div>`;
}

export function renderCoupleMyeongsikTableHtml(
  self: { view: MyeongsikViewModel; fullAnalysis: SajuAnalysisResponse | null },
  partner: { view: MyeongsikViewModel; fullAnalysis: SajuAnalysisResponse | null },
  names: { self: string; partner: string },
): string {
  return `
<div style="display:flex; gap:4mm; align-items:flex-start;">
  ${singleTable(self.view, self.fullAnalysis, names.self, GOLD)}
  ${singleTable(partner.view, partner.fullAnalysis, names.partner, PARTNER_BLUE)}
</div>`;
}
