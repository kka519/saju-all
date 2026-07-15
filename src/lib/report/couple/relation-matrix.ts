// =====================================================
// 커플 궁합 — 관계 매트릭스 계산 (진실 원천)
// =====================================================
// "계산은 코드가, 해석만 AI가" 원칙(today-fortune과 동일) — 천간합충·지지합충형파,
// 용신/기신 교차는 LLM이 지어내지 않고 코드가 계산해 "[이 값만 사용]" 블록으로
// 프롬프트에 주입한다. 정식 등급/지수 산식(§5)은 Phase B 후반에 별도 설계 —
// 지금은 콘텐츠 초안 검토용으로 원시 관계 목록만 계산한다.

import type { Myeongsik } from "@/lib/saju/manseryeok";
import type { SajuAnalysisResponse } from "@/lib/saju/saju-api";
import { buildMyeongsikView, type MyeongsikViewModel } from "@/lib/saju/build-myeongsik-view";
import {
  findCheonganRelations,
  findJijiRelationsExtended,
  type ExtendedRelationType,
} from "@/lib/saju/jiji-relations";

export const PILLAR_KEYS = ["year", "month", "day", "hour"] as const;
export type PillarKey = (typeof PILLAR_KEYS)[number];
const PILLAR_LABEL: Record<PillarKey, string> = { year: "년주", month: "월주", day: "일주", hour: "시주" };

export type PillarCrossRelation = {
  selfPillarKey: PillarKey;
  partnerPillarKey: PillarKey;
  selfPillar: string; // "일주" 등
  partnerPillar: string;
  cheonganRelations: ("합" | "충")[];
  jijiRelations: ExtendedRelationType[];
};

export type CoupleRelationMatrix = {
  selfView: MyeongsikViewModel;
  partnerView: MyeongsikViewModel;
  /** 본인 4기둥 × 상대 4기둥 교차 관계 — 합/충/파/형/삼합/해 있는 조합만 포함(없으면 생략). */
  crossRelations: PillarCrossRelation[];
  /** 일간끼리 관계(가장 중요 — "관계의 핵심 축"). */
  dayGanRelation: { cheonganRelations: ("합" | "충")[] };
  /** 배우자궁(일지)끼리 관계. */
  dayJiRelation: { jijiRelations: ExtendedRelationType[] };
  /** 본인 용신 오행이 상대 사주에 어떻게 작용하는지 — 상대에게 희신/기신/구신/한신 중 무엇인지. */
  selfYongsinInPartner: { selfYongsinOheng: string | undefined; note: string };
  partnerYongsinInSelf: { partnerYongsinOheng: string | undefined; note: string };
};

function pillarOf(m: Myeongsik, key: PillarKey) {
  return key === "hour" ? m.hour : m[key];
}

/** 오행이 상대방에게 희신/기신/구신/한신 중 무엇에 해당하는지 텍스트로 — gyeokguk 오행 4종 비교. */
function ohaengRoleIn(oheng: string | undefined, target: MyeongsikViewModel): string {
  if (!oheng || !target.gyeokguk) return "판단 불가(용신/격국 데이터 없음)";
  const g = target.gyeokguk as unknown as Record<string, string | undefined>;
  if (g["용신오행"] === oheng || target.yongsin?.오행 === oheng) return "용신(핵심 필요 기운)";
  if (g["희신오행"] === oheng) return "희신(도움 되는 기운)";
  if (g["기신오행"] === oheng) return "기신(꺼리는 기운)";
  if (g["구신오행"] === oheng) return "구신(기신을 돕는 기운)";
  return "한신(중립)";
}

export function computeCoupleRelationMatrix(
  self: { myeongsik: Myeongsik; fullAnalysis: SajuAnalysisResponse | null },
  partner: { myeongsik: Myeongsik; fullAnalysis: SajuAnalysisResponse | null },
): CoupleRelationMatrix {
  const selfView = buildMyeongsikView(self.myeongsik, self.fullAnalysis);
  const partnerView = buildMyeongsikView(partner.myeongsik, partner.fullAnalysis);

  const crossRelations: PillarCrossRelation[] = [];
  for (const sk of PILLAR_KEYS) {
    const sp = pillarOf(self.myeongsik, sk);
    if (!sp) continue;
    for (const pk of PILLAR_KEYS) {
      const pp = pillarOf(partner.myeongsik, pk);
      if (!pp) continue;
      const cheonganRelations = findCheonganRelations(sp.cheongan, pp.cheongan);
      const jijiRelations = findJijiRelationsExtended(sp.jiji, pp.jiji);
      if (cheonganRelations.length === 0 && jijiRelations.length === 0) continue;
      crossRelations.push({
        selfPillarKey: sk,
        partnerPillarKey: pk,
        selfPillar: PILLAR_LABEL[sk],
        partnerPillar: PILLAR_LABEL[pk],
        cheonganRelations,
        jijiRelations,
      });
    }
  }

  const dayGanRelation = {
    cheonganRelations: findCheonganRelations(self.myeongsik.day.cheongan, partner.myeongsik.day.cheongan),
  };
  const dayJiRelation = {
    jijiRelations: findJijiRelationsExtended(self.myeongsik.day.jiji, partner.myeongsik.day.jiji),
  };

  const selfYongsinOheng = selfView.yongsin?.오행;
  const partnerYongsinOheng = partnerView.yongsin?.오행;

  return {
    selfView,
    partnerView,
    crossRelations,
    dayGanRelation,
    dayJiRelation,
    selfYongsinInPartner: {
      selfYongsinOheng,
      note: `본인 용신(${selfYongsinOheng ?? "미상"})은 상대방에게 ${ohaengRoleIn(selfYongsinOheng, partnerView)}에 해당`,
    },
    partnerYongsinInSelf: {
      partnerYongsinOheng,
      note: `상대방 용신(${partnerYongsinOheng ?? "미상"})은 본인에게 ${ohaengRoleIn(partnerYongsinOheng, selfView)}에 해당`,
    },
  };
}

/** 프롬프트 주입용 — 매트릭스를 사람이 읽는 한글 텍스트 블록으로. */
export function formatRelationMatrixForPrompt(matrix: CoupleRelationMatrix): string {
  const lines: string[] = [];
  lines.push(
    `[일간 관계] 본인 일간(${matrix.selfView.pillars.day.cheongan}) ↔ 상대 일간(${matrix.partnerView.pillars.day.cheongan}): ${
      matrix.dayGanRelation.cheonganRelations.length > 0 ? matrix.dayGanRelation.cheonganRelations.join("·") : "직접 합충 없음"
    }`,
  );
  lines.push(
    `[배우자궁 관계] 본인 일지(${matrix.selfView.pillars.day.jiji}) ↔ 상대 일지(${matrix.partnerView.pillars.day.jiji}): ${
      matrix.dayJiRelation.jijiRelations.length > 0 ? matrix.dayJiRelation.jijiRelations.join("·") : "직접 합충 없음"
    }`,
  );
  lines.push(`[용신 교차] ${matrix.selfYongsinInPartner.note}`);
  lines.push(`[용신 교차] ${matrix.partnerYongsinInSelf.note}`);
  if (matrix.crossRelations.length > 0) {
    lines.push(`[전체 교차 관계 목록 — 4기둥×4기둥 중 합충파형 있는 조합만]`);
    for (const r of matrix.crossRelations) {
      const parts: string[] = [];
      if (r.cheonganRelations.length > 0) parts.push(`천간 ${r.cheonganRelations.join("·")}`);
      if (r.jijiRelations.length > 0) parts.push(`지지 ${r.jijiRelations.join("·")}`);
      lines.push(`  - 본인 ${r.selfPillar} ↔ 상대 ${r.partnerPillar}: ${parts.join(", ")}`);
    }
  } else {
    lines.push(`[전체 교차 관계 목록] 4기둥×4기둥 중 합충파형 조합 없음`);
  }
  return lines.join("\n");
}
