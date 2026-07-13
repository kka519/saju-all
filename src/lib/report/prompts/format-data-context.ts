// =====================================================
// ReportData → LLM 입력용 텍스트 블록
// =====================================================
// 4개 prompt 파트가 공통으로 재사용하는 "확정 데이터" 요약. 코드가 계산한 값만
// 담는다 — LLM 은 이 블록의 숫자/간지/오행을 그대로 인용해야 하며 재계산 금지
// (system prompt 의 [입력] 절과 짝).

import type { ReportData } from "../normalize";
import type { ScoredPeriod } from "../types";

function periodLine(p: ScoredPeriod): string {
  const tagLabel = { golden: "골든", 변동: "변동", caution: "주의", neutral: "" }[p.tag];
  return `${p.label} ${p.ganji}(${p.ganjiHanja}) — 지수 ${p.score} ${p.isCurrent ? "[현재]" : ""}${tagLabel ? ` [${tagLabel}]` : ""}`;
}

export function formatReportDataContext(data: ReportData): string {
  const { view, dayGan, dayJi, gongmang, ohaengCount, daeun, seun, wolun, currentDaeun } = data;

  const pillarLine = (label: string, p: typeof view.pillars.year | null) =>
    p
      ? `${label}: ${p.cheongan}${p.cheonganHanja ?? ""}${p.jiji}${p.jijiHanja ?? ""} · 십성(간)${p.sipseongCheongan ?? "-"}/십성(지)${p.sipseongJiji ?? "-"} · 지장간 ${p.jijanggan.join("")} · 12운성 ${p.twelveFortune ?? "-"}`
      : `${label}: (시 미상)`;

  const sinsalLine = view.sinsals.length
    ? view.sinsals.map((s) => `${s.name}(${s.position})`).join(", ")
    : "없음";
  const guiinLine = view.guiins.length
    ? view.guiins.map((g) => `${g.name}(${g.position})`).join(", ")
    : "없음";
  const hapchungLine = data.view.hapchung?.length
    ? data.view.hapchung.map((h) => `${h.type} ${h.sourcePosition}-${h.targetPosition}`).join(", ")
    : "없음";

  return `[명식 원국]
${pillarLine("년주", view.pillars.year)}
${pillarLine("월주", view.pillars.month)}
${pillarLine("일주", view.pillars.day)}
${pillarLine("시주", view.pillars.hour)}
일간: ${dayGan} / 일지: ${dayJi}
오행 카운트: 목${ohaengCount.목} 화${ohaengCount.화} 토${ohaengCount.토} 금${ohaengCount.금} 수${ohaengCount.수}
공망: ${gongmang.join("·") || "없음"}

[격국·신강약·용신]
격국: ${view.gyeokguk?.name ?? "-"}
신강여부: ${view.gyeokguk?.신강여부 ? "신강" : "신약"} (점수 ${view.gyeokguk?.신강점수 ?? "-"})
용신: ${view.yongsin?.오행 ?? "-"} (${view.yongsin?.십신 ?? "-"})
희신: ${view.gyeokguk?.희신오행 ?? "-"} / 기신: ${view.gyeokguk?.기신오행 ?? "-"} / 구신: ${view.gyeokguk?.구신오행 ?? "-"}
격국 종합설명: ${view.gyeokguk?.종합설명 ?? "-"}

[신살] ${sinsalLine}
[귀인] ${guiinLine}
[합충] ${hapchungLine}

[대운 전체 사이클 (10년 단위, 전 생애)]
${daeun.map(periodLine).join("\n")}
현재 대운: ${currentDaeun ? `${currentDaeun.label} ${currentDaeun.ganji} (지수 ${currentDaeun.score})` : "-"}

[세운 (연간, 향후 6개년)]
${seun.map(periodLine).join("\n")}

[월운 (향후 12개월)]
${wolun.map(periodLine).join("\n")}
`;
}
