// =====================================================
// 인생 애널리스트 리포트 — 데이터 정규화
// =====================================================
// MyeongsikViewModel(이미 정규화된 4기둥/신살/귀인/합충/격국) + luckyloveme
// fullAnalysis(raw) 를 합쳐 리포트 파이프라인 전체(차트/프롬프트/템플릿)가
// 공유하는 단일 ReportData 로 만든다. 새 API 호출 없음 — 이미 받은 데이터만 재가공.

import type { MyeongsikViewModel } from "@/lib/saju/build-myeongsik-view";
import type { SajuAnalysisResponse } from "@/lib/saju/saju-api";
import type { Oheng } from "@/lib/saju/derived";
import type { ScoredPeriod } from "./types";
import { scorePeriods, type ScorablePeriod } from "./score-engine";
import { getGongmang } from "./gongmang";
import type { RawDaeunRoot, RawSeunRoot, RawWeolunRoot } from "./raw-types";

export type ReportData = {
  view: MyeongsikViewModel;
  dayGan: string;
  dayJi: string;
  gongmang: string[];
  ohaengCount: Record<Oheng, number>;
  daeun: ScoredPeriod[];
  seun: ScoredPeriod[];
  wolun: ScoredPeriod[];
  /** 현재 진행 중인 대운 (daeun 배열 내 isCurrent=true 항목의 축약 참조) */
  currentDaeun: ScoredPeriod | undefined;
};

function sipseongLabel(s: { gan?: string; ji?: string } | undefined): string | undefined {
  if (!s?.gan || !s?.ji) return undefined;
  return `${s.gan}·${s.ji}`;
}

function toDaeunPeriods(root: RawDaeunRoot): ScorablePeriod[] {
  return root.all_daeun.map((d) => ({
    label: `${d.age_start}~${d.age_end}세`,
    ganji: d.ganji,
    ganjiHanja: d.ganji_hanja,
    isCurrent: d.sequence === root.current_daeun.sequence,
    yongsinJudgment: d.yongsinJudgment,
    hapChungRelations: d.wongukInteraction?.hapChungRelations,
    sipseong: sipseongLabel(d.sipseong),
  }));
}

function toSeunPeriods(root: RawSeunRoot, limit = 6): ScorablePeriod[] {
  const raw = [root.currentSeun, ...(root.upcomingSeuns ?? [])].slice(0, limit);
  return raw.map((s, i) => ({
    label: `${s.year}년`,
    ganji: s.ganji,
    ganjiHanja: s.ganji_hanja,
    isCurrent: i === 0,
    yongsinJudgment: s.yongsinJudgment,
    hapChungRelations: s.hapChungRelations,
    sipseong: sipseongLabel((s as { sipseongRelation?: { gan?: string; ji?: string } }).sipseongRelation),
  }));
}

function toWolunPeriods(root: RawWeolunRoot, limit = 12): ScorablePeriod[] {
  const raw = [root.currentWeolun, ...(root.upcomingWeoluns ?? [])].slice(0, limit);
  return raw.map((w, i) => ({
    label: `${w.month}월\n${w.ganji}`,
    ganji: w.ganji,
    ganjiHanja: w.ganji_hanja,
    isCurrent: i === 0,
    yongsinJudgment: w.yongsinJudgment,
    hapChungRelations: undefined, // 월운 응답엔 hapChungRelations 없음 (실측 확인)
    sipseong: sipseongLabel(w.sipseongRelation),
  }));
}

export function buildReportData(
  view: MyeongsikViewModel,
  fullAnalysis: SajuAnalysisResponse,
): ReportData {
  const dayGan = view.pillars.day.cheongan;
  const dayJi = view.pillars.day.jiji;
  const gongmang = getGongmang(dayGan, dayJi);

  const daeunRoot = fullAnalysis.daeun as RawDaeunRoot | undefined;
  const seunRoot = fullAnalysis.seun as RawSeunRoot | undefined;
  const wolunRoot = fullAnalysis.weolun as RawWeolunRoot | undefined;

  const daeun = daeunRoot ? scorePeriods(toDaeunPeriods(daeunRoot), dayGan, 1) : [];
  const seun = seunRoot ? scorePeriods(toSeunPeriods(seunRoot), dayGan, 0.7) : [];
  const wolun = wolunRoot ? scorePeriods(toWolunPeriods(wolunRoot), dayGan, 0.7) : [];

  return {
    view,
    dayGan,
    dayJi,
    gongmang,
    ohaengCount: view.ohaengCount,
    daeun,
    seun,
    wolun,
    currentDaeun: daeun.find((d) => d.isCurrent),
  };
}
