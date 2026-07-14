// =====================================================
// 인생 애널리스트 리포트 — 공용 타입
// =====================================================

/** 채점된 단일 기간(대운/세운/월운 한 칸). 차트·표·prompt 입력 공통 단위. */
export type ScoredPeriod = {
  /** 표시용 라벨. 대운 "37~46세", 세운 "2026년", 월운 "2026년 7월" */
  label: string;
  /** 간지 한글 (예: "을유") */
  ganji: string;
  /** 간지 한자 (예: "乙酉") */
  ganjiHanja: string;
  /** 0~100 표시 지수 (v1: 30~85 클램프) */
  score: number;
  /** 직전 기간 대비 상승/하락 (차트 색상 결정에 사용) */
  direction: "up" | "down" | "flat";
  /** golden(귀인/대길) · 변동(충 발생) · caution(대흉) · neutral */
  tag: "golden" | "변동" | "caution" | "neutral";
  /** 현재 진행 중인 기간 여부 */
  isCurrent: boolean;
  /** 십신 라벨 "정재·편인" (천간·지지). raw 응답의 sipseong/sipseongRelation 에서 주입, 없으면 undefined. */
  sipseong?: string;
  /** luckyloveme 원 판정 라벨 (대길/소길/평/소흉/대흉 등) — 리포트 문구에 참고용 인용 */
  rawJudgment?: string;
  /** luckyloveme 원 종합점수 (rescale 전 원본값) — 디버그/검증용 */
  rawScore?: number;
  /** 실제 캘린더 연/월 (월운 전용) — p.13/p.14 실캘린더 라벨 계산에 사용. */
  year?: number;
  month?: number;
};
