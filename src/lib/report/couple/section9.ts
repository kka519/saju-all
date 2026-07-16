// =====================================================
// 커플 궁합 리포트 — §9 본편 보강 4종 (진실 원천)
// =====================================================
// 기획_궁합리포트_합병리서치_20260715.md §9 "추가 로직(전부 코드 계산, LLM은 해설만)"
// 중 코드 계산이 필요한 4가지:
//   2. 병(病)-치유 매트릭스 (p7~8) — 각자 기신·구신 글자를 상대가 합으로 해소하는가
//   3. 끌림의 숨은 장치 (p6) — 천을귀인 교차 + 공망 교차
//   4. 관계 유형 태그 (p2) — 일간끼리 오행 관계로 3분류
//   5. 배우자궁 자체 진단 (p15) — 각자 일지가 자기 원국 안에서 충·형·원진을 맞는지
// (1번 "도입 훅"은 코드 계산이 필요 없는 고정 문구 지시라 prompts.ts에서 직접 처리.)

import type { CoupleRelationMatrix, PillarKey } from "./relation-matrix";
import { PILLAR_KEYS, PILLAR_LABEL } from "./relation-matrix";
import type { MyeongsikViewModel } from "@/lib/saju/build-myeongsik-view";
import { getCheoneulJiji } from "@/lib/report/cheoneul-table";
import { getGongmang } from "@/lib/report/gongmang";

// ── 4. 관계 유형 태그 ────────────────────────────────────
export const RELATIONSHIP_TYPES = ["관-재형", "식상-인성형", "비겁형"] as const;
export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];

const OHAENG_GENERATES: Record<string, string> = { 목: "화", 화: "토", 토: "금", 금: "수", 수: "목" };

/** 두 일간의 오행 관계만으로 판정 — 같으면 비겁형, 상생(양방향)이면 식상-인성형,
 *  나머지(5원소 순환상 남는 경우는 항상 상극)는 관-재형. */
export function judgeRelationshipType(matrix: CoupleRelationMatrix): RelationshipType {
  const selfEl = matrix.selfView.pillars.day.cheonganOhaeng;
  const partnerEl = matrix.partnerView.pillars.day.cheonganOhaeng;
  if (!selfEl || !partnerEl || selfEl === partnerEl) return "비겁형";
  if (OHAENG_GENERATES[selfEl] === partnerEl || OHAENG_GENERATES[partnerEl] === selfEl) return "식상-인성형";
  return "관-재형";
}

const RELATIONSHIP_TYPE_DEF: Record<RelationshipType, string> = {
  "관-재형": "한쪽이 상대를 다스리고 상대는 그를 통해 자원을 얻는 정배열 구조",
  "식상-인성형": "한쪽이 상대를 길러주고 상대는 그로부터 자양분을 얻는 모자(母子)형 구조",
  비겁형: "같은 기운끼리 만난 남매형 구조 — 경쟁과 동료 의식이 공존",
};

export function formatRelationshipTypeForPrompt(type: RelationshipType): string {
  return `[관계 유형 태그 — execSummary 등급 옆에 이 유형명만 표기]\n${type}(${RELATIONSHIP_TYPE_DEF[type]})`;
}

// ── 2. 병(病)-치유 매트릭스 ──────────────────────────────
export type HealItem = {
  pillarLabel: string;
  pillarKey: PillarKey;
  char: string;
  charType: "천간" | "지지";
  element: string;
  role: "기신" | "구신";
};
export type HealVerdict = { item: HealItem; resolvedByPillar: string | null };
export type CoupleHealMatrix = { selfIllness: HealVerdict[]; partnerIllness: HealVerdict[] };

function findIllnessChars(view: MyeongsikViewModel): HealItem[] {
  const g = view.gyeokguk as unknown as { 기신오행?: string; 구신오행?: string } | undefined;
  if (!g?.기신오행 && !g?.구신오행) return [];
  const roleOf = (el: string | undefined): "기신" | "구신" | null => {
    if (!el) return null;
    if (el === g.기신오행) return "기신";
    if (el === g.구신오행) return "구신";
    return null;
  };
  const items: HealItem[] = [];
  for (const key of PILLAR_KEYS) {
    const p = view.pillars[key];
    if (!p) continue;
    const ganRole = roleOf(p.cheonganOhaeng);
    if (ganRole) items.push({ pillarLabel: PILLAR_LABEL[key], pillarKey: key, char: p.cheongan, charType: "천간", element: p.cheonganOhaeng!, role: ganRole });
    const jiRole = roleOf(p.jijiOhaeng);
    if (jiRole) items.push({ pillarLabel: PILLAR_LABEL[key], pillarKey: key, char: p.jiji, charType: "지지", element: p.jijiOhaeng!, role: jiRole });
  }
  return items;
}

/** illness 가 self 소속이면 partner 쪽 합을, partner 소속이면 self 쪽 합을 찾는다. */
function findHealer(matrix: CoupleRelationMatrix, item: HealItem, illnessIsSelf: boolean): string | null {
  for (const r of matrix.crossRelations) {
    const ownerKey = illnessIsSelf ? r.selfPillarKey : r.partnerPillarKey;
    if (ownerKey !== item.pillarKey) continue;
    const hasHap = item.charType === "천간" ? r.cheonganRelations.includes("합") : r.jijiRelations.some((x) => x === "합" || x === "삼합");
    if (hasHap) return illnessIsSelf ? r.partnerPillar : r.selfPillar;
  }
  return null;
}

export function computeCoupleHealMatrix(matrix: CoupleRelationMatrix): CoupleHealMatrix {
  const selfItems = findIllnessChars(matrix.selfView);
  const partnerItems = findIllnessChars(matrix.partnerView);
  return {
    selfIllness: selfItems.map((item) => ({ item, resolvedByPillar: findHealer(matrix, item, true) })),
    partnerIllness: partnerItems.map((item) => ({ item, resolvedByPillar: findHealer(matrix, item, false) })),
  };
}

export function formatCoupleHealMatrixForPrompt(
  hm: CoupleHealMatrix,
  names: { self: string; partner: string },
): string {
  if (hm.selfIllness.length === 0 && hm.partnerIllness.length === 0) {
    return `[병-치유 매트릭스] 두 사람 모두 원국 4기둥에 기신·구신 글자가 뚜렷이 드러나지 않음 — 이 장치는 언급하지 말고 synergy를 일반적인 보완 관계로만 서술하라.`;
  }
  const line = (v: HealVerdict, who: string) =>
    `  ${who}의 ${v.item.pillarLabel}(${v.item.char}, ${v.item.role}) — ${
      v.resolvedByPillar ? `상대 ${v.resolvedByPillar}가 합으로 해소함(치유됨)` : "해소하는 글자 없음(미해소)"
    }`;
  return [
    `[병-치유 매트릭스 — 이 판정만 사용. synergy 섹션의 중심 질문 "이 사람은 당신에게 약입니까"에 활용하라]`,
    ...hm.selfIllness.map((v) => line(v, names.self)),
    ...hm.partnerIllness.map((v) => line(v, names.partner)),
  ].join("\n");
}

// ── 3. 끌림의 숨은 장치 (천을귀인 교차 + 공망 교차) ─────────
export type AttractionDevices = {
  selfGuiinInPartner: { guiinJi: string; foundInPillar: string }[];
  partnerGuiinInSelf: { guiinJi: string; foundInPillar: string }[];
  sharedGongmang: string[];
};

function findGuiinInOther(dayGan: string, otherView: MyeongsikViewModel): { guiinJi: string; foundInPillar: string }[] {
  const guiinJi = getCheoneulJiji(dayGan);
  if (guiinJi.length === 0) return [];
  const found: { guiinJi: string; foundInPillar: string }[] = [];
  for (const key of PILLAR_KEYS) {
    const p = otherView.pillars[key];
    if (!p) continue;
    if (guiinJi.includes(p.jiji)) found.push({ guiinJi: p.jiji, foundInPillar: PILLAR_LABEL[key] });
  }
  return found;
}

export function computeAttractionDevices(matrix: CoupleRelationMatrix): AttractionDevices {
  const selfGuiinInPartner = findGuiinInOther(matrix.selfView.pillars.day.cheongan, matrix.partnerView);
  const partnerGuiinInSelf = findGuiinInOther(matrix.partnerView.pillars.day.cheongan, matrix.selfView);
  const selfGongmang = getGongmang(matrix.selfView.pillars.day.cheongan, matrix.selfView.pillars.day.jiji);
  const partnerGongmang = getGongmang(matrix.partnerView.pillars.day.cheongan, matrix.partnerView.pillars.day.jiji);
  const sharedGongmang = selfGongmang.filter((j) => partnerGongmang.includes(j));
  return { selfGuiinInPartner, partnerGuiinInSelf, sharedGongmang };
}

export function formatAttractionDevicesForPrompt(
  devices: AttractionDevices,
  names: { self: string; partner: string },
): string {
  const lines: string[] = [`[끌림의 숨은 장치 — 이 판정만 사용, attractionStructure(p6)에 반영]`];
  if (devices.selfGuiinInPartner.length > 0) {
    lines.push(
      `  ${names.partner}의 ${devices.selfGuiinInPartner.map((g) => g.foundInPillar).join("·")}에 ${names.self}의 천을귀인 지지가 있음 — "설명 안 되는 끌림·이별하기 어려움"의 근거로 언급 가능(본문에서는 번역어 "귀한 도움을 부르는 기운"으로 표현)`,
    );
  }
  if (devices.partnerGuiinInSelf.length > 0) {
    lines.push(
      `  ${names.self}의 ${devices.partnerGuiinInSelf.map((g) => g.foundInPillar).join("·")}에 ${names.partner}의 천을귀인 지지가 있음 — 동일하게 언급 가능`,
    );
  }
  if (devices.selfGuiinInPartner.length === 0 && devices.partnerGuiinInSelf.length === 0) {
    lines.push(`  천을귀인 교차 없음 — 이 장치는 언급하지 마라`);
  }
  if (devices.sharedGongmang.length > 0) {
    lines.push(`  두 사람의 공망이 같음(${devices.sharedGongmang.join("·")}) — "묘한 동질감"의 근거로 언급 가능(본문에서는 번역어 "기운이 비어 있는 자리"로 표현)`);
  } else {
    lines.push(`  공망 교차 없음 — 이 장치는 언급하지 마라`);
  }
  return lines.join("\n");
}

// ── 5. 배우자궁 자체 진단 ────────────────────────────────
export type SpousePalaceDiagnosis = {
  stable: boolean;
  issues: { type: string; withPosition: string }[];
};

/** 원국 내 다른 기둥과 일주(배우자궁) 사이에 충·형·원진이 있는지 — 합/삼합 등
 *  긍정 관계는 제외, 불안정 신호만 카운트. */
function diagnoseSpousePalace(view: MyeongsikViewModel): SpousePalaceDiagnosis {
  const hapchung = view.hapchung ?? [];
  const issues = hapchung
    .filter((h) => (h.sourcePosition === "일주" || h.targetPosition === "일주") && (h.type.includes("충") || h.type.includes("형") || h.type === "원진"))
    .map((h) => ({ type: h.type, withPosition: h.sourcePosition === "일주" ? h.targetPosition : h.sourcePosition }));
  return { stable: issues.length === 0, issues };
}

export function computeSpousePalaceDiagnoses(
  matrix: CoupleRelationMatrix,
): { self: SpousePalaceDiagnosis; partner: SpousePalaceDiagnosis } {
  return { self: diagnoseSpousePalace(matrix.selfView), partner: diagnoseSpousePalace(matrix.partnerView) };
}

export function formatSpousePalaceDiagnosesForPrompt(
  d: { self: SpousePalaceDiagnosis; partner: SpousePalaceDiagnosis },
  names: { self: string; partner: string },
): string {
  const line = (name: string, diag: SpousePalaceDiagnosis) =>
    diag.stable
      ? `  ${name}: 배우자궁(일지) 자체 안정 — 원국 내 다른 자리와 충·형·원진 없음`
      : `  ${name}: 배우자궁(일지)이 ${diag.issues.map((i) => `${i.withPosition}와(과) ${i.type}`).join(", ")} 관계 — 자체적으로 흔들리는 자리`;
  return [
    `[배우자궁 자체 진단 — longTermFit(p15)에서 상대와의 교차를 보기 전에 먼저 언급, 이 판정만 사용]`,
    line(names.self, d.self),
    line(names.partner, d.partner),
  ].join("\n");
}
