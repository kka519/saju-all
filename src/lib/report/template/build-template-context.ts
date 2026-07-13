// =====================================================
// Handlebars 템플릿 컨텍스트 빌더
// =====================================================
// "계산은 코드가, 해석만 AI가" 원칙의 코드 축. ReportData(정규화 데이터) +
// ReportSections(LLM 4파트 출력) + 차트 SVG 를 합쳐 report.hbs 가 그대로
// 렌더할 수 있는 평평한(flat) 컨텍스트 객체로 만든다.
//
// p.1 ratingbox, p.10/12/14 표의 수치·간지·십신, 골든윈도우 등은 score-engine
// 결과에서 100% 코드로 도출 — LLM 필드 아님.

import type { ReportData } from "../normalize";
import type { ReportSections } from "../prompts/build-sections";
import { renderDaeunCandleChart } from "../charts/daeun-chart";
import { renderOhaengPortfolioChart } from "../charts/ohaeng-chart";
import { renderSeunLineChart } from "../charts/seun-chart";
import { renderWolunBarChart } from "../charts/wolun-chart";
import {
  buildRiskDisclosure,
  TERM_TRANSLATION_ROWS,
  SCORING_GUIDE_ROWS,
  FAQ_ROWS,
  READING_PRINCIPLES,
  UPSELL_ROWS,
  COMPLIANCE_NOTICE,
  ACCURACY_STATEMENT,
} from "./fixed-sections";
import type { ScoredPeriod } from "../types";

/** 투자의견(BUY/HOLD/SELL) 은유 — 현재 지수 기반. */
function ratingLabel(score: number): { opinion: string; sub: string } {
  if (score >= 65) return { opinion: "BUY", sub: "비중확대" };
  if (score >= 50) return { opinion: "HOLD", sub: "중립 유지" };
  return { opinion: "SELL", sub: "방어 운전" };
}

function findGoldenPeriod(periods: ScoredPeriod[]): ScoredPeriod | undefined {
  return periods.find((p) => p.tag === "golden") ?? periods.reduce((max, p) => (p.score > (max?.score ?? -Infinity) ? p : max), undefined as ScoredPeriod | undefined);
}

function tagBadge(tag: ScoredPeriod["tag"]): { label: string; cls: string } {
  switch (tag) {
    case "golden":
      return { label: "골든", cls: "t-gd" };
    case "변동":
      return { label: "변동", cls: "t-dn" };
    case "caution":
      return { label: "주의", cls: "t-dn" };
    default:
      return { label: "보합", cls: "t-md" };
  }
}

export function buildTemplateContext(
  data: ReportData,
  sections: ReportSections,
  meta: {
    reportDateLabel: string;
    myeongsikId: string;
    /** 실제 생년월일 표시용 (예: "음력 1971-04-25") — 리포트 발행일과 다름. */
    birthDateLabel: string;
    /** 실제 출생 시각 (예: "10:30") 또는 "시 미상". */
    birthTimeLabel: string;
    /** "여성" | "남성" — 표지/스펙 시트 표기용. */
    genderLabel: string;
  },
) {
  const { view, daeun, seun, wolun, currentDaeun, ohaengCount, gongmang } = data;

  const currentScore = currentDaeun?.score ?? 60;
  const futureDaeun = daeun.filter((d) => !d.isCurrent);
  const targetScore = futureDaeun.length ? Math.max(...futureDaeun.map((d) => d.score)) : currentScore;
  const upsidePct = (((targetScore - currentScore) / currentScore) * 100).toFixed(1);
  const rating = ratingLabel(currentScore);
  const goldenSeun = findGoldenPeriod(seun);
  const goldenWolun = findGoldenPeriod(wolun);

  const pillar = (p: typeof view.pillars.year | null) =>
    p
      ? {
          cheongan: p.cheongan,
          cheonganHanja: p.cheonganHanja,
          jiji: p.jiji,
          jijiHanja: p.jijiHanja,
          // 한자 옆 한글 발음 (예: 己→"기토", 巳→"사화") — 한글+오행 조합, 레퍼런스 p.4 스타일.
          cheonganReading: `${p.cheongan}${p.cheonganOhaeng ?? ""}`,
          jijiReading: `${p.jiji}${p.jijiOhaeng ?? ""}`,
          sipseongCheongan: p.sipseongCheongan ?? "-",
          sipseongJiji: p.sipseongJiji ?? "-",
          jijanggan: p.jijanggan.join(""),
          twelveFortune: p.twelveFortune ?? "-",
        }
      : null;

  const birthLabel = `${meta.birthDateLabel} ${meta.birthTimeLabel} 生 · ${meta.genderLabel}`;
  const birthNote =
    meta.birthTimeLabel === "시 미상"
      ? "출생 시각 미상 — 시주 제외 3주 기준 분석"
      : `${meta.birthTimeLabel} 출생 — 시주 반영 완료`;

  // p.13 분기 표의 "월운 (절기)" 컬럼 — 월운 배열은 "현재 달부터 12개월" 순서이므로
  // 달력 분기가 아니라 배열 순서대로 3개월씩 묶는다 (Q1 = 앞 3개월 = 예: 7~9월).
  // prompt 도 같은 정의("그 해를 4분기로" = 향후 12개월을 4등분)로 서술하므로 정합.
  const quarterGanji = (qi: number) => {
    const parts = wolun.slice(qi * 3, qi * 3 + 3).map((w) => w.ganji);
    return parts.length ? parts.join(" → ") : "—";
  };

  return {
    meta: {
      brand: "LUNA LIFE RESEARCH",
      reportDate: meta.reportDateLabel,
      myeongsikId: meta.myeongsikId,
      birthLabel,
    },
    birthNote,

    rating: {
      opinion: rating.opinion,
      sub: rating.sub,
      currentScore,
      targetScore,
      upsidePct,
      currentDaeunLabel: currentDaeun ? `${currentDaeun.ganjiHanja}(${currentDaeun.ganji}) '${currentDaeun.label}` : "-",
      cyclePosition: currentDaeun?.direction === "up" ? "상승 전환 구간" : currentDaeun?.direction === "down" ? "조정 구간" : "보합 구간",
      goldenSeunLabel: goldenSeun ? goldenSeun.label : "-",
      goldenWolunLabel: goldenWolun ? goldenWolun.label.replace("\n", " ") : "-",
    },

    headline: sections.part1.headline,
    execSummary: sections.part1.execSummary,
    keySentence: sections.part1.keySentence,

    pillars: {
      year: pillar(view.pillars.year),
      month: pillar(view.pillars.month),
      day: pillar(view.pillars.day),
      hour: pillar(view.pillars.hour),
    },
    dayGan: data.dayGan,
    dayJi: data.dayJi,
    ohaengCount,
    gongmang: gongmang.join("·") || "없음",
    gyeokgukName: view.gyeokguk?.name ?? "-",
    sinKang: view.gyeokguk?.신강여부 ? "신강" : "신약",
    sinKangScore: view.gyeokguk?.신강점수 ?? "-",
    yongsinOheng: view.yongsin?.오행 ?? "-",
    huisinOheng: view.gyeokguk?.희신오행 ?? "-",
    gisinOheng: view.gyeokguk?.기신오행 ?? "-",
    cheoneulJiji: view.guiins.find((g) => g.name.includes("천을"))?.position ?? "-",

    specComment: sections.part1.specComment,
    specNotes: sections.part1.specNotes,
    ilganEpithet: sections.part1.ilganEpithet,
    ilganSecTitle: sections.part1.ilganSecTitle,
    ilganDeep: sections.part1.ilganDeep,
    decisionStyle: sections.part1.decisionStyle,
    pattern: sections.part1.pattern,
    strengthSummary: sections.part1.strengthSummary,
    complementTasks: sections.part1.complementTasks,
    valuechainComment: sections.part1.valuechainComment,
    jaedaWarning: sections.part1.jaedaWarning,
    sinsalRows: sections.part1.sinsalRows,

    ohaengChartSvg: renderOhaengPortfolioChart(ohaengCount),

    backtest: sections.part2.backtest,
    checklistStructure: sections.part2.checklist.slice(0, 6),
    checklistTiming: sections.part2.checklist.slice(6, 10),
    scoringGuide: SCORING_GUIDE_ROWS,

    daeunChartSvg: renderDaeunCandleChart(daeun),
    daeunTable: daeun.map((d, i) => ({
      ...d,
      badge: tagBadge(d.tag),
      sipseongLabel: d.sipseong ?? "-",
      comment: sections.part3.daeunComments[i] ?? "",
    })),
    daeunNarrative: sections.part3.daeunNarrative,
    daeunDeep: sections.part3.daeunDeep,
    daeunCaveats: sections.part3.daeunCaveats,

    seunChartSvg: renderSeunLineChart(seun),
    seunTable: seun.map((s, i) => ({
      ...s,
      badge: tagBadge(s.tag),
      sipseongLabel: s.sipseong ?? "-",
      strategy: sections.part3.seunRows[i]?.strategy ?? "",
    })),
    fiveYearSummary: sections.part3.fiveYearSummary,
    quarterIntro: sections.part3.quarterIntro,
    quarterRows: sections.part3.quarterRows.map((text, i) => ({
      label: `Q${i + 1}`,
      wolunGanji: quarterGanji(i),
      text,
    })),
    goldenWindowNote: sections.part3.goldenWindowNote,
    donts: sections.part3.donts,
    goldenWolunLabel: goldenWolun ? goldenWolun.label.replace("\n", " ") : "-",

    wolunChartSvg: renderWolunBarChart(wolun),
    wolunTable: wolun.map((w, i) => ({
      ...w,
      badge: tagBadge(w.tag),
      monthLabel: w.label.replace("\n", " ").split(" ")[0] ?? w.label,
      sipseongLabel: w.sipseong ?? "-",
      note: sections.part3.monthRows[i] ?? "",
    })),

    profitIntro: sections.part4.profitIntro,
    portfolioRows: sections.part4.portfolioRows,
    profitChannels: sections.part4.profitChannels,
    riskTypes: sections.part4.riskTypes,
    riskCalendar: sections.part4.riskCalendar,
    healthNote: sections.part4.healthNote,
    riskCallout: sections.part4.riskCallout,
    relationIntro: sections.part4.relationIntro,
    helperRows: sections.part4.helperRows,
    relationPrinciples: sections.part4.relationPrinciples,
    relationCallout: sections.part4.relationCallout,
    actions30days: sections.part4.actions30days,
    actions1year: sections.part4.actions1year,
    actions10year: sections.part4.actions10year,

    termTranslationRows: TERM_TRANSLATION_ROWS,
    readingPrinciples: READING_PRINCIPLES,
    riskDisclosure: buildRiskDisclosure({
      birthDateLabel: meta.birthDateLabel,
      birthTimeLabel: meta.birthTimeLabel,
      hourPillarHanja: view.pillars.hour ? `${view.pillars.hour.cheonganHanja}${view.pillars.hour.jijiHanja}` : "—",
    }),
    faqRows: FAQ_ROWS,
    accuracyStatement: ACCURACY_STATEMENT,

    closing: sections.part4.closing,
    upsellRows: UPSELL_ROWS,
    complianceNotice: COMPLIANCE_NOTICE,
  };
}
