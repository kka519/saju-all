// =====================================================
// src/lib/saju/full-analysis-types.ts
// =====================================================
// luckyloveme API 응답(SajuAnalysisResponse)의 시안 사용분만 타입화.
// inspect-full-analysis-shape.ts 1회 실측(본인 사주 기준) 기반.
//
// 사용 방침:
//   - 화면 렌더링에서 read 시 type assertion 으로 사용 (예: `analysis.ganji as Ganji`).
//   - SajuAnalysisResponse 의 unknown 타입은 그대로 유지 (호환성).
//   - 본 파일은 "읽을 때 쓸 타입"만 제공 — INSERT 시 영향 0.
//
// 느슨함 정책 (1건 실측 기반의 불확실성 고려):
//   - 확신 없는 필드는 optional(?)
//   - 살(煞)·귀인처럼 사주에 따라 키 자체가 빠질 수 있는 항목 optional
//   - 깊은 중첩(personality·hapChungRelations 등)은 unknown 으로 느슨하게
//   - 배열은 빈 배열([]) 허용 (Array(0) 케이스 존재 확인됨)

// ─────────────────────────────────────────────────────
// Ganji — 4기둥 (천간지지)
// ─────────────────────────────────────────────────────

/**
 * 단일 기둥. 한글/한자/음양/오행이 함께 들어 있음.
 * 시안의 명식 카드 한 칸에 필요한 모든 시각 정보가 여기 있음.
 */
export type GanjiPillar = {
  gan: string;
  ji: string;
  ganji: string;        // 예: "갑진" (한글 합본)
  ganHanja: string;     // 예: "甲"
  jiHanja: string;      // 예: "辰"
  fullHangul: string;
  fullHanja: string;    // 예: "甲辰"
  eumyang: { gan: string; ji: string };   // 음양 — 천간/지지 각각
  ohaeng: { gan: string; ji: string };    // 오행 — 천간/지지 각각 (셀 색상에 사용)
};

/** ganji 필드 — 4기둥. hour 는 시 미상 시 undefined. */
export type Ganji = {
  year: GanjiPillar;
  month: GanjiPillar;
  day: GanjiPillar;
  hour?: GanjiPillar;
};

// ─────────────────────────────────────────────────────
// Sipseong — 십성
// ─────────────────────────────────────────────────────

export type SipseongItem = {
  position: string;     // 기둥 위치 ("년주"/"월주" 등 또는 영문 추정)
  ganji: string;
  sipseong: string;     // "정관", "정재" 등
  type: string;
  category: string;
  meaning: string;
};

/** 십성 카테고리별 카운트. 시안의 오행 5색 매트릭스용. */
export type SipseongSummary = {
  bigyeop: number;      // 비겁
  siksang: number;      // 식상
  jaeseong: number;     // 재성
  gwanseong: number;    // 관성
  inseong: number;      // 인성
};

export type Sipseong = {
  /** 실측에선 Array(7) — 일간 제외 7개 위치 추정. 사주에 따라 길이 변동 가능. */
  sipseongs: SipseongItem[];
  summary: SipseongSummary;
  analysis?: string;
  /** 천간합 분석 — 시안에 미사용이면 무시 가능. 깊은 중첩은 unknown. */
  cheonganHap?: {
    haps: unknown[];
    hasAnyHap: boolean;
    hasAnyHaphwa: boolean;
    ohaengImpact?: unknown;
    summary?: string;
  };
};

// ─────────────────────────────────────────────────────
// TwelveFortune — 12운성
// ─────────────────────────────────────────────────────

/** 한 운성의 깊은 해석. 시안엔 fortune 라벨만 표시되므로 대부분 optional. */
export type TwelveFortuneInterpretation = {
  keyword: string;
  energy: string;
  personality: string[];
  strengths: string[];
  weaknesses: string[];
  career: string;
  relationship: string;
  advice: string;
  level: number;
};

/** 한 기둥의 12운성. 시안 명식/대운/연운 카드의 운성 라벨에 사용. */
export type TwelveFortuneItem = {
  position: string;
  gan: string;
  ji: string;
  fortune: string;      // "양", "장생", "관대", "건록" 등 — 시안 카드 라벨
  interpretation?: TwelveFortuneInterpretation;
};

export type TwelveFortune = {
  dayGan?: string;
  /** 실측 Array(4) — 4기둥. */
  fortunes: TwelveFortuneItem[];
  summary?: string;
  iljiAnalysis?: string;
};

// ─────────────────────────────────────────────────────
// Sibisinsals — 12신살
// ─────────────────────────────────────────────────────

export type SibisinsalItem = {
  name: string;
  position: string;
  ji: string;
  description: string;
};

export type Sibisinsals = {
  /** 12신살 본체. 사주에 따라 길이 변동. */
  sibisinsals: SibisinsalItem[];
  /** 백호살 — 사주에 따라 키 자체 미포함 가능. */
  baekhosal?: {
    exists: boolean;
    positions: string[];
    strength: string;
    description: string;
  };
  cheonui?: SibisinsalItem[];           // 천의성
  gwangwihakgwan?: SibisinsalItem[];    // 관귀학관
};

// ─────────────────────────────────────────────────────
// Guiin — 16개 귀인
// ─────────────────────────────────────────────────────

export type GuiinItem = {
  position: string;
  ji: string;
  name: string;
  description: string;
};

/**
 * 16개 귀인 카테고리. 사주에 따라 빈 배열일 수 있음.
 * 화면에서는 비어있지 않은 카테고리만 표시 권장.
 * 키 이름은 luckyloveme 응답 그대로 (로마자).
 */
export type Guiin = {
  cheoneul?: GuiinItem[];      // 천을귀인
  taegeuk?: GuiinItem[];       // 태극귀인
  mungok?: GuiinItem[];        // 문곡귀인
  munchang?: GuiinItem[];      // 문창귀인
  bokseong?: GuiinItem[];      // 복성귀인
  cheonju?: GuiinItem[];       // 천주귀인
  cheongwan?: GuiinItem[];     // 천관귀인
  cheonbok?: GuiinItem[];      // 천복귀인
  hakdang?: GuiinItem[];       // 학당귀인
  jaego?: GuiinItem[];         // 재고귀인
  cheondeok?: GuiinItem[];     // 천덕귀인
  woldeok?: GuiinItem[];       // 월덕귀인
  amrok?: GuiinItem[];         // 암록
  geumyeo?: GuiinItem[];       // 금여
  yuha?: GuiinItem[];          // 유하
  hyeoprok?: GuiinItem[];      // 협록
};

// ─────────────────────────────────────────────────────
// Gyeokguk — 격국·용신
// ─────────────────────────────────────────────────────

/**
 * 격국. 일부 키가 한국어 — luckyloveme 응답 그대로 유지.
 * 시안에는 type/name + yongsin.십신/오행 만 우선 사용 추정.
 */
export type Gyeokguk = {
  type: string;
  name: string;
  reason?: string;
  naegeokDetail?: {
    type: string;
    name: string;
    sipsin: string;
    description: string;
    characteristics: string[];
    투출여부?: boolean;
    격근거?: string;
  };
  yongsin?: {
    십신: string;
    오행: string;
    method: string;
    reason: string;
  };
  희신오행?: string;
  기신오행?: string;
  구신오행?: string;
  신강여부?: boolean;
  신강점수?: number;
  종합설명?: string;
};

// ─────────────────────────────────────────────────────
// SinStrength — 신강신약
// ─────────────────────────────────────────────────────

export type SinStrength = {
  isStrong: boolean;
  strength: string;          // "신강", "중강", "중약", "신약" 등
  level: number;             // 1~7 추정
  score: number;
  description?: string;
  bigyeopCount?: number;
  inseongCount?: number;
  wolryeong?: string;
  deukryeong?: boolean;
  deukji?: boolean;
  deukse?: boolean;
  analysis?: string;
  qualitativeType?: string;     // "학습형 신약" 같은 라벨
  qualitativeAnalysis?: string;
  detailAnalysis?: {
    scoreBreakdown?: {
      year: number;
      month: number;
      day: number;
      hour: number;
      total: number;
    };
    supportElements?: string[];
    weakenElements?: string[];
  };
};

// ─────────────────────────────────────────────────────
// Sipseong info — 대운/세운 공통 십성 객체
// ─────────────────────────────────────────────────────

/**
 * 대운·세운에서 한 칸의 천간/지지 십성 묶음.
 * 응답상 daeun 은 ganCategory/jiCategory/interpretation 포함, seun 은 gan/ji 만.
 * ViewModel 정규화 후 양쪽 모두 sipseong 키로 통일.
 */
export type SipseongInfo = {
  gan: string;             // 천간 십성 라벨 (시안 "정재" 등)
  ji: string;              // 지지 십성 라벨
  ganCategory?: string;
  jiCategory?: string;
  interpretation?: string;
};

// ─────────────────────────────────────────────────────
// Daeun — 대운
// ─────────────────────────────────────────────────────

/**
 * 단일 대운 항목 (10년). 시안 대운 카드 한 칸에 매핑.
 *
 * 정규화 필드(buildMyeongsikView 가 주입 — raw 응답엔 없음):
 *   - isCurrent : 현재 만 나이가 [age_start, age_end] 범위에 들어가면 true
 *   - ganElement / jiElement : ganji 2글자에서 derived 오행 계산
 */
export type DaeunItem = {
  sequence: number;
  age_start: number;
  age_end: number;
  ganji: string;             // "기해" (한글)
  ganji_hanja: string;       // "己亥" (한자) — 시안의 한자 병기에 사용
  start_date?: string;
  year_start?: number;
  year_end?: number;
  sipseong?: SipseongInfo;
  twelveFortune?: TwelveFortuneItem;     // 시안 운성 라벨 ("양"/"장생" 등)
  wongukInteraction?: {
    yongsinRelation?: unknown;
    hapChungRelations?: unknown[];
  };
  /** ViewModel 정규화 — 응답 + 현재 만 나이 비교 결과. 모름 시 false. */
  isCurrent?: boolean;
  /** ViewModel 정규화 — ganji[0] 한글 → derived 오행. 매핑 실패 시 undefined. */
  ganElement?: string;
  /** ViewModel 정규화 — ganji[1] 한글 → derived 오행. */
  jiElement?: string;
};

export type Daeun = {
  daeun_start_age: number;
  current_age: number;
  current_daeun: DaeunItem;
  next_daeun?: DaeunItem;
  /** 실측 Array(10). 사람마다 길이 다를 수 있어 일반 배열. */
  all_daeun: DaeunItem[];
  direction?: string;          // "순행" / "역행"
  year_gan?: string;
  year_ji?: string;
  year_ganji?: string;
  is_yang_gan?: boolean;
  // calculation_method, birth_info, target_term, time_difference,
  // daeun_start_date, month_pillar, month_gan, month_ji 는 화면 미사용 → 생략
};

// ─────────────────────────────────────────────────────
// Seun — 세운 (연간)
// ─────────────────────────────────────────────────────

/**
 * 단일 세운 항목 (1년). 시안 연운 카드 한 칸에 매핑.
 *
 * 정규화 필드(buildMyeongsikView 가 주입):
 *   - sipseong   : raw 응답의 sipseongRelation 키를 통일 명칭으로 재매핑
 *   - isCurrent  : seun 배열의 0번 = currentSeun 1건만 true
 */
export type SeunItem = {
  year: number;
  age: number;
  ganji: string;
  ganji_hanja: string;       // 시안의 한자 병기
  gan: string;
  ji: string;
  ganElement?: string;       // 천간 오행
  jiElement?: string;        // 지지 오행
  /** ViewModel 정규화 — daeun 과 키 통일 (raw 응답은 sipseongRelation). */
  sipseong?: SipseongInfo;
  interpretation?: string;
  hapChungRelations?: unknown[];
  twelveFortune?: TwelveFortuneItem;     // 시안 운성 라벨
  /** ViewModel 정규화 — currentSeun 1건만 true. */
  isCurrent?: boolean;
};

export type Seun = {
  currentSeun: SeunItem;
  nextSeun?: SeunItem;
  /** 실측 Array(5) — 최근 5년. */
  recentSeuns?: SeunItem[];
  /** 실측 Array(12) — 향후 12년. 시안 연운 5칸은 [currentSeun, ...upcomingSeuns.slice(0,4)]. */
  upcomingSeuns: SeunItem[];
};

// ─────────────────────────────────────────────────────
// Hapchung — 합·충·형·해·파
// ─────────────────────────────────────────────────────

/** 기둥 간 관계 단일 건. */
export type HapchungItem = {
  type: string;              // "충", "합", "형", "해", "파"
  source: string;            // 천간/지지 글자
  target: string;
  sourcePosition: string;    // "년주", "월주" 등
  targetPosition: string;
  meaning: string;
};

/** hapchung 필드 자체가 배열. */
export type Hapchung = HapchungItem[];
