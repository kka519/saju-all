// =====================================================
// 인생 애널리스트 리포트 — luckyloveme raw 응답 타입 (report 모듈 전용)
// =====================================================
// full-analysis-types.ts 의 기존 타입들은 yongsinJudgment/wongukInteraction 을
// 커버하지 않음(실측 후 이번에 처음 확인된 필드) — report 모듈에서만 쓰는
// 확장 타입을 별도로 둔다. 기존 saju/ 쪽 타입은 건드리지 않음(영향 범위 최소화).
//
// 실측(2026-07-12, 1990-05-15 14:30 양력 남성) 기준으로 필드명 확정.

import type { HapChungRelationRaw, YongsinJudgment } from "./score-engine";

export type RawDaeunItem = {
  sequence: number;
  age_start: number;
  age_end: number;
  ganji: string;
  ganji_hanja: string;
  start_date?: string;
  year_start?: number;
  year_end?: number;
  sipseong?: { gan: string; ji: string; ganCategory?: string; jiCategory?: string; interpretation?: string };
  wongukInteraction?: { hapChungRelations?: HapChungRelationRaw[] };
  twelveFortune?: { fortune?: string };
  yongsinJudgment?: YongsinJudgment;
};

export type RawDaeunRoot = {
  direction?: string;
  current_daeun: RawDaeunItem;
  all_daeun: RawDaeunItem[];
};

export type RawSeunItem = {
  year: number;
  age?: number;
  ganji: string;
  ganji_hanja: string;
  hapChungRelations?: HapChungRelationRaw[];
  twelveFortune?: { fortune?: string };
  yongsinJudgment?: YongsinJudgment;
};

export type RawSeunRoot = {
  currentSeun: RawSeunItem;
  upcomingSeuns?: RawSeunItem[];
};

/** 월운 — 실측 응답 기준 신규 타이핑 (full-analysis-types.ts 에는 아직 없음). */
export type RawWeolunItem = {
  year: number;
  month: number;
  monthLabel: string;
  isCurrentMonth: boolean;
  ganji: string;
  ganji_hanja: string;
  gan: string;
  ji: string;
  ganElement?: string;
  jiElement?: string;
  sipseongRelation?: { gan: string; ji: string };
  interpretation?: string;
  yongsinJudgment?: YongsinJudgment;
};

export type RawWeolunRoot = {
  currentWeolun: RawWeolunItem;
  nextWeolun?: RawWeolunItem;
  recentWeoluns?: RawWeolunItem[];
  /** 실측 미확인 — 향후 12개월 배열이 있다면 이 키로 존재할 가능성 (없으면 currentWeolun 부터 순차 계산 필요). */
  upcomingWeoluns?: RawWeolunItem[];
};
