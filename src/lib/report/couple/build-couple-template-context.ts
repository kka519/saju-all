// =====================================================
// 커플 궁합 리포트 — Handlebars 템플릿 컨텍스트 빌더
// =====================================================
// build-template-context.ts(인생 리포트)와 동일 원칙 — "계산은 코드가, 해석만
// AI가". CoupleRelationMatrix + CoupleSeunSeries + CoupleWolunHighlight +
// CoupleSections(LLM 23필드) + 비주얼 3종 + §9 장치를 couple-report.hbs가 그대로
// 렌더할 수 있는 평평한 컨텍스트로 합친다.
//
// 2026-07-17 실물 PDF 렌더 검증에서 여러 페이지(종목 A/B 심층, 합병근거, 시너지,
// 리스크 관리 등)가 단일 LLM 필드(400~550자)만으로는 A4 한 페이지를 채우지 못해
// 여백이 크게 남는 문제가 실측 확인됐다 — 페이지마다 코드 계산 보조 콘텐츠(핵심
// 근거 요약·오행/용신 요약·회복시계 배지·끌림의 숨은 장치 표)를 추가해 "글 반
// 그림 반" 원칙을 지키도록 20페이지 구성을 재설계했다.

import type { CoupleRelationMatrix } from "./relation-matrix";
import type { CoupleSeunSeries } from "./couple-seun-data";
import type { CoupleWolunHighlight } from "./couple-wolun-data";
import type { CoupleSections, CoupleNames } from "./prompts";
import { formatOhaengDistribution } from "./prompts";
import type { CoupleTypeNames } from "./type-names";
import type { RelationshipType } from "./section9";
import {
  computeCoupleHealMatrix,
  computeAttractionDevices,
  computeSpousePalaceDiagnoses,
  withGwaJosa,
  type SpousePalaceDiagnosis,
} from "./section9";
import { renderCoupleMyeongsikTableHtml } from "./couple-myeongsik-table";
import { renderCoupleRelationsChart } from "../charts/couple-relations-chart";
import { renderCoupleSeunChart } from "../charts/couple-seun-chart";
import { renderPaceGaugeSvg } from "../charts/couple-pace-gauge-chart";
import { renderOhaengOverlapChart, computeOhaengOverlap, formatOhaengOverlapNote } from "../charts/couple-ohaeng-overlap-chart";
import { renderHealMatrixTable, formatHealMatrixCaption } from "./heal-matrix-table";
import { renderAttractionDevicesTable } from "./attraction-devices-table";
import { renderReconciliationCard } from "./reconciliation-card";
import { COUPLE_UPSELL_ROWS, COUPLE_COMPLIANCE_NOTICE } from "./couple-fixed-sections";
import { extractPullQuote, extractConclusion } from "./text-extract";
import { renderStatSidebar } from "./stat-sidebar";
import type { SajuAnalysisResponse } from "@/lib/saju/saju-api";

function spousePalaceText(diag: SpousePalaceDiagnosis): string {
  if (diag.stable) return "배우자궁(일지) 자체 안정 — 원국 내 다른 자리와 충·형·원진 없음";
  return `배우자궁(일지)이 ${diag.issues.map((i) => `${withGwaJosa(i.withPosition)} ${i.type}`).join(", ")} 관계 — 자체적으로 흔들리는 자리`;
}

export function buildCoupleTemplateContext(params: {
  names: CoupleNames;
  matrix: CoupleRelationMatrix;
  selfFullAnalysis: SajuAnalysisResponse | null;
  partnerFullAnalysis: SajuAnalysisResponse | null;
  seunSeries: CoupleSeunSeries;
  wolunHighlight: CoupleWolunHighlight;
  sections: CoupleSections;
  relationshipType: RelationshipType;
  typeNames: CoupleTypeNames;
  meta: { reportDateLabel: string };
}) {
  const { names, matrix, selfFullAnalysis, partnerFullAnalysis, seunSeries, wolunHighlight, sections, relationshipType, typeNames, meta } = params;

  const healMatrix = computeCoupleHealMatrix(matrix);
  const attractionDevices = computeAttractionDevices(matrix);
  const spousePalace = computeSpousePalaceDiagnoses(matrix);

  const seunHighlightLabel =
    seunSeries.highlightYear !== null
      ? `${seunSeries.highlightYear}년 (${seunSeries.highlightReason})`
      : "데이터 없음";

  const wolunHighlightLabel = wolunHighlight
    ? `${wolunHighlight.ganji}월 · ${wolunHighlight.monthsFromNow === 0 ? "이번 달" : `약 ${wolunHighlight.monthsFromNow}개월 후`}`
    : "데이터 없음";

  const seunTable = seunSeries.years.map((year, i) => {
    const s = seunSeries.self[i];
    const p = seunSeries.partner[i];
    const isHighlight = year === seunSeries.highlightYear;
    return {
      year,
      selfScore: `${s.score >= 0 ? "+" : ""}${s.score}`,
      partnerScore: `${p.score >= 0 ? "+" : ""}${p.score}`,
      note: isHighlight ? seunSeries.highlightReason ?? "" : "",
      isHighlight,
    };
  });

  // p5/p6 "핵심 근거" 하이라이트 — 일간·배우자궁 관계는 대칭이라 양쪽 페이지에
  // 동일 사실을 재확인하는 용도로 재사용한다(코드 계산, LLM 개입 없음).
  const dayGanRelText =
    matrix.dayGanRelation.cheonganRelations.length > 0
      ? `일간끼리 ${matrix.dayGanRelation.cheonganRelations.join("·")}`
      : "일간끼리 직접 합충 없음";
  const dayJiRelText =
    matrix.dayJiRelation.jijiRelations.length > 0
      ? `배우자궁(일지)은 ${matrix.dayJiRelation.jijiRelations.join("·")}`
      : "배우자궁(일지)은 직접 합충 없음";
  const crossHighlightNote = `핵심 근거 — ${dayGanRelText}, ${dayJiRelText}.`;

  // p10 리스크 공시① 인트로 보강 — 관계도에 표시된 관계 개수를 코드가 직접 센다.
  const hapCount = matrix.crossRelations.filter(
    (r) => r.cheonganRelations.includes("합") || r.jijiRelations.includes("합") || r.jijiRelations.includes("삼합"),
  ).length;
  const chungCount = matrix.crossRelations.filter(
    (r) => r.cheonganRelations.includes("충") || r.jijiRelations.includes("충"),
  ).length;
  const riskDisclosureIntro = `아래 관계도는 두 명식 4기둥×4기둥 교차 중 합충파형이 있는 조합만 표시한 것이다 — 골드 실선(합) ${hapCount}건, 붉은 점선(충) ${chungCount}건이 핵심 신호, 회색 점선은 파·형·해·삼합 보조 관계다.`;


  // p11 리스크 공시② 보강 — 충·형만 걸러 어느 기둥끼리 부딪히는지 표로 재확인
  // (p10 관계도의 축약판, 실측 채움률 33%로 프로즈 700~900자만으로도 부족).
  const clashRelations = matrix.crossRelations.filter(
    (r) => r.cheonganRelations.includes("충") || r.jijiRelations.includes("충") || r.jijiRelations.includes("형"),
  );
  const riskDisclosureEvidenceHtml =
    clashRelations.length === 0
      ? ""
      : `<table class="grid small"><tr><th style="width:34%">기둥</th><th>충돌 유형</th></tr>${clashRelations
          .map((r) => {
            const parts = [
              ...(r.cheonganRelations.includes("충") ? ["천간 충"] : []),
              ...(r.jijiRelations.includes("충") ? ["지지 충"] : []),
              ...(r.jijiRelations.includes("형") ? ["지지 형"] : []),
            ];
            return `<tr><td>${names.selfLabel} ${r.selfPillar} ↔ ${names.partnerLabel} ${r.partnerPillar}</td><td class="l">${parts.join(" · ")}</td></tr>`;
          })
          .join("")}</table>`;

  // ── 페이지 골격 재설계(2026-07-17, 콘텐츠 추가 대신 레이아웃 전환) ──────────
  // 채움률 실측 평균 53%에도 사장님이 "여전히 여백" 판정 — 이후로는 새 문장을
  // 더 만드는 대신, 이미 생성된 프로즈에서 문장을 뽑아 풀쿼트(큰 활자)·결론
  // 배너로 재배치하고, 본문 컬럼을 좁혀(사이드바 추가) 같은 글자 수가 더 많은
  // 줄로 자연스럽게 흐르게 한다. 사이드바 값은 전부 이미 계산된 값 재구성.
  const selfPersonaLine = `${typeNames.self.persona} · ${typeNames.self.pace}`;
  const partnerPersonaLine = `${typeNames.partner.persona} · ${typeNames.partner.pace}`;

  const selfScores = seunSeries.self.map((s) => s.score);
  const partnerScores = seunSeries.partner.map((s) => s.score);
  const selfPeakIdx = selfScores.indexOf(Math.max(...selfScores));
  const selfTroughIdx = selfScores.indexOf(Math.min(...selfScores));
  const partnerPeakIdx = partnerScores.indexOf(Math.max(...partnerScores));
  const partnerTroughIdx = partnerScores.indexOf(Math.min(...partnerScores));

  const sidebarExec = renderStatSidebar([
    { label: "관계 유형 태그", value: relationshipType },
    { label: "세운 하이라이트", value: seunHighlightLabel },
    { label: "온도 타이밍", value: wolunHighlightLabel },
    { label: "합충 신호", value: `합 ${hapCount}건 · 충 ${chungCount}건` },
    { label: `${names.selfLabel} 배우자궁`, value: spousePalace.self.stable ? "안정" : "불안정", who: "self" },
    { label: `${names.partnerLabel} 배우자궁`, value: spousePalace.partner.stable ? "안정" : "불안정", who: "partner" },
  ]);

  const sidebarSelfDeep = renderStatSidebar([
    { label: "오행 분포", value: formatOhaengDistribution(matrix.selfView, names.selfLabel), who: "self" },
    { label: "밤의 페르소나 · 예열-지속", value: selfPersonaLine, who: "self" },
    { label: "회복 시계", value: typeNames.self.clock, who: "self" },
  ]);
  const sidebarPartnerDeep = renderStatSidebar([
    { label: "오행 분포", value: formatOhaengDistribution(matrix.partnerView, names.partnerLabel), who: "partner" },
    { label: "밤의 페르소나 · 예열-지속", value: partnerPersonaLine, who: "partner" },
    { label: "회복 시계", value: typeNames.partner.clock, who: "partner" },
  ]);

  const sidebarAttraction = renderStatSidebar([
    { label: "합 신호", value: `${hapCount}건` },
    {
      label: "귀한 도움을 부르는 기운 교차",
      value: attractionDevices.selfGuiinInPartner.length + attractionDevices.partnerGuiinInSelf.length > 0 ? "있음" : "없음",
    },
    { label: "기운이 비어 있는 자리 교차", value: attractionDevices.sharedGongmang.length > 0 ? "있음" : "없음" },
  ]);

  const sidebarRiskDisclosure = renderStatSidebar([
    { label: "충·형 충돌", value: `${clashRelations.length}건` },
    { label: `${names.selfLabel} 회복 시계`, value: typeNames.self.clock, who: "self" },
    { label: `${names.partnerLabel} 회복 시계`, value: typeNames.partner.clock, who: "partner" },
  ]);

  const sidebarFinance = renderStatSidebar([
    { label: "관계 유형 태그", value: relationshipType },
    { label: `${names.selfLabel} 배우자궁`, value: spousePalace.self.stable ? "안정" : "불안정", who: "self" },
    { label: `${names.partnerLabel} 배우자궁`, value: spousePalace.partner.stable ? "안정" : "불안정", who: "partner" },
  ]);

  const sidebarBacktest = renderStatSidebar([
    { label: "세운 하이라이트", value: seunHighlightLabel },
    { label: `${names.selfLabel} 최고/최저`, value: `${seunSeries.years[selfPeakIdx]}년 ${seunSeries.self[selfPeakIdx].score >= 0 ? "+" : ""}${seunSeries.self[selfPeakIdx].score} / ${seunSeries.years[selfTroughIdx]}년 ${seunSeries.self[selfTroughIdx].score}`, who: "self" },
    { label: `${names.partnerLabel} 최고/최저`, value: `${seunSeries.years[partnerPeakIdx]}년 ${seunSeries.partner[partnerPeakIdx].score >= 0 ? "+" : ""}${seunSeries.partner[partnerPeakIdx].score} / ${seunSeries.years[partnerTroughIdx]}년 ${seunSeries.partner[partnerTroughIdx].score}`, who: "partner" },
  ]);

  const sidebarCalendar = renderStatSidebar([
    { label: "온도 타이밍", value: wolunHighlightLabel },
    { label: "세운 하이라이트", value: seunHighlightLabel },
  ]);

  const sidebarHealMatrix = renderStatSidebar([
    {
      label: `${names.selfLabel} 병 해소`,
      value: `${healMatrix.selfIllness.filter((v) => v.resolvedByPillar !== null).length} / ${healMatrix.selfIllness.length}곳`,
      who: "self",
    },
    {
      label: `${names.partnerLabel} 병 해소`,
      value: `${healMatrix.partnerIllness.filter((v) => v.resolvedByPillar !== null).length} / ${healMatrix.partnerIllness.length}곳`,
      who: "partner",
    },
  ]);

  const sidebarFinal = renderStatSidebar([
    { label: "관계 유형 태그", value: relationshipType },
    { label: `${names.selfLabel} 회복 시계`, value: typeNames.self.clock, who: "self" },
    { label: `${names.partnerLabel} 회복 시계`, value: typeNames.partner.clock, who: "partner" },
  ]);

  return {
    meta: { brand: "LUNA LIFE RESEARCH", reportDate: meta.reportDateLabel },
    names: { self: names.selfLabel, partner: names.partnerLabel },
    relationshipType,

    ticker: {
      selfHanja: matrix.selfView.pillars.day.cheonganHanja ?? matrix.selfView.pillars.day.cheongan,
      partnerHanja: matrix.partnerView.pillars.day.cheonganHanja ?? matrix.partnerView.pillars.day.cheongan,
      dealName: `${names.selfLabel} × ${names.partnerLabel} 합병 실사 보고서`,
    },

    clockLabels: { self: typeNames.self.clock, partner: typeNames.partner.clock },
    seunHighlightLabel,
    wolunHighlightLabel,

    execSummary: sections.execSummary,
    execPullQuote: extractPullQuote(sections.execSummary),
    execConclusion: extractConclusion(sections.execSummary),
    sidebarExec,

    myeongsikTableHtml: renderCoupleMyeongsikTableHtml(
      { view: matrix.selfView, fullAnalysis: selfFullAnalysis },
      { view: matrix.partnerView, fullAnalysis: partnerFullAnalysis },
      { self: names.selfLabel, partner: names.partnerLabel },
    ),
    spousePalace: {
      self: spousePalaceText(spousePalace.self),
      partner: spousePalaceText(spousePalace.partner),
    },

    selfSeenByPartner: sections.selfSeenByPartner,
    partnerSeenBySelf: sections.partnerSeenBySelf,
    selfCrossNote: crossHighlightNote,
    partnerCrossNote: crossHighlightNote,
    selfPullQuote: extractPullQuote(sections.selfSeenByPartner),
    selfConclusion: extractConclusion(sections.selfSeenByPartner),
    partnerPullQuote: extractPullQuote(sections.partnerSeenBySelf),
    partnerConclusion: extractConclusion(sections.partnerSeenBySelf),
    sidebarSelfDeep,
    sidebarPartnerDeep,

    attractionStructure: sections.attractionStructure,
    attractionDevicesHtml: renderAttractionDevicesTable(attractionDevices, { self: names.selfLabel, partner: names.partnerLabel }),
    attractionPullQuote: extractPullQuote(sections.attractionStructure),
    attractionConclusion: extractConclusion(sections.attractionStructure),
    sidebarAttraction,

    synergy: sections.synergy,
    ohaengSelfSummary: formatOhaengDistribution(matrix.selfView, names.selfLabel),
    ohaengPartnerSummary: formatOhaengDistribution(matrix.partnerView, names.partnerLabel),
    yongsinCrossSelfNote: matrix.selfYongsinInPartner.note,
    yongsinCrossPartnerNote: matrix.partnerYongsinInSelf.note,
    ohaengOverlapChartSvg: renderOhaengOverlapChart(matrix.selfView, matrix.partnerView, { self: names.selfLabel, partner: names.partnerLabel }),
    ohaengOverlapNote: formatOhaengOverlapNote(computeOhaengOverlap(matrix.selfView, matrix.partnerView), { self: names.selfLabel, partner: names.partnerLabel }),

    healMatrixHtml: renderHealMatrixTable(healMatrix, { self: names.selfLabel, partner: names.partnerLabel }),
    healMatrixCaption: formatHealMatrixCaption(healMatrix, { self: names.selfLabel, partner: names.partnerLabel }),
    sidebarHealMatrix,

    relationsChartSvg: renderCoupleRelationsChart(matrix, { self: names.selfLabel, partner: names.partnerLabel }),
    riskDisclosureIntro,
    dayGanRelationNote: dayGanRelText,
    dayJiRelationNote: dayJiRelText,
    riskDisclosureBody: sections.riskDisclosure,
    riskDisclosureEvidenceHtml,
    riskDisclosurePullQuote: extractPullQuote(sections.riskDisclosure),
    riskDisclosureConclusion: extractConclusion(sections.riskDisclosure),
    sidebarRiskDisclosure,

    riskManagementSelf: sections.riskManagementSelf,
    riskManagementPartner: sections.riskManagementPartner,
    reconciliationCardSelf: renderReconciliationCard(typeNames.self.clock, names.selfLabel, "self"),
    reconciliationCardPartner: renderReconciliationCard(typeNames.partner.clock, names.partnerLabel, "partner"),
    riskMgmtSelfPullQuote: extractPullQuote(sections.riskManagementSelf),
    riskMgmtPartnerPullQuote: extractPullQuote(sections.riskManagementPartner),

    chemistryHook: sections.chemistryHook,
    chemistryPersona: sections.chemistryPersona,
    chemistryDesireGauge: sections.chemistryDesireGauge,
    paceGaugeSvg: renderPaceGaugeSvg(typeNames.self.pace, typeNames.partner.pace, { self: names.selfLabel, partner: names.partnerLabel }),
    chemistryLeadStructure: sections.chemistryLeadStructure,
    chemistryPaceCurve: sections.chemistryPaceCurve,
    chemistrySkinshipLanguage: sections.chemistrySkinshipLanguage,
    chemistrySignalDictionary: sections.chemistrySignalDictionary,
    chemistryTimingPreview: sections.chemistryTimingPreview,

    financialOutlook: sections.financialOutlook,
    longTermFit: sections.longTermFit,
    financePullQuote: extractPullQuote(sections.longTermFit),
    financeConclusion: extractConclusion(sections.longTermFit),
    sidebarFinance,

    seunChartSvg: renderCoupleSeunChart(seunSeries, { self: names.selfLabel, partner: names.partnerLabel }),
    backtest: sections.backtest,
    backtestPullQuote: extractPullQuote(sections.backtest),
    sidebarBacktest,

    seunTable,
    futureCalendar: sections.futureCalendar,
    calendarPullQuote: extractPullQuote(sections.futureCalendar),
    sidebarCalendar,

    crisisScenario: sections.crisisScenario,
    roadmap: sections.roadmap,
    finalOpinion: sections.finalOpinion,
    finalPullQuote: extractPullQuote(sections.finalOpinion),
    sidebarFinal,

    upsellRows: COUPLE_UPSELL_ROWS,
    complianceNotice: COUPLE_COMPLIANCE_NOTICE,
  };
}
