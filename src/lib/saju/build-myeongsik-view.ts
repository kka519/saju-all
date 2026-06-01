// =====================================================
// src/lib/saju/build-myeongsik-view.ts
// =====================================================
// results 페이지의 명식 화면용 단일 ViewModel 빌더.
// full_analysis(luckyloveme 16종, optional) + derived.ts(지장간 등)
// + myeongsik(4기둥 한글)을 합쳐 화면에서 바로 쓸 형태로.
//
// 사용 방침:
//   - 호출처(results 페이지 server component)에서 1회 호출.
//   - fullAnalysis 가 null 이어도 함수가 깨지지 않음 (myeongsik + derived 만으로 동작).
//   - UI 컴포넌트는 ViewModel 만 받아 렌더 — raw 응답 직접 접근 X.
//
// 소스 우선순위:
//   - 한자       : fullAnalysis.ganji.*.ganHanja/jiHanja > derived.ts
//   - 오행       : fullAnalysis.ganji.*.ohaeng.gan/ji > 내부 inline 매핑 (derived 와 동일)
//   - 오행 개수  : fullAnalysis.sipseong.cheonganHap.ohaengImpact.originalCount > derived.countOheng
//   - 지장간     : 항상 derived.getJijanggan (응답에 없음)
//   - 십성/운성/신살/대운/세운/격국/용신: fullAnalysis 있을 때만, 없으면 undefined.
//
// 핵심 주의사항:
//   1) sipseong / twelveFortune / sibisinsals 의 position 키로 4기둥 매칭.
//      인덱스 순서 가정 금지 — position 문자열 fuzzy 매칭(year|month|day|hour + gan|ji).
//   2) 일간(day.cheongan) 은 십성 없음 — sipseongCheongan = "나" 고정.
//   3) position 정확 표기(영문/한글/혼합)는 실측 미확인 → fuzzy 매칭으로 대응.
//      매칭 안 되면 undefined 로 두고 UI 는 빈 셀 처리.

import type { Myeongsik } from "./manseryeok";
import {
  countOheng,
  getCheonganHanja,
  getJijanggan,
  getJijiHanja,
  type Oheng,
} from "./derived";
import type {
  Ganji,
  GanjiPillar,
  SipseongItem,
  TwelveFortuneItem,
  SibisinsalItem,
  Gyeokguk,
  DaeunItem,
  SeunItem,
} from "./full-analysis-types";

// ─────────────────────────────────────────────────────
// 출력 타입
// ─────────────────────────────────────────────────────

export type PillarView = {
  /** 천간 한글 (예: "갑") */
  cheongan: string;
  /** 천간 한자 (예: "甲"). fullAnalysis 우선, fallback derived. */
  cheonganHanja: string | undefined;
  /** 지지 한글 (예: "진") */
  jiji: string;
  /** 지지 한자 (예: "辰") */
  jijiHanja: string | undefined;
  /** 천간 오행 (셀 색상용). 응답 우선, fallback inline 매핑. */
  cheonganOhaeng: Oheng | undefined;
  /** 지지 오행. */
  jijiOhaeng: Oheng | undefined;
  /**
   * 천간의 십성. 일간(day.cheongan) 은 "나" 고정.
   * fullAnalysis 없거나 position 매칭 실패 시 undefined.
   */
  sipseongCheongan: string | undefined;
  /** 지지의 십성. fullAnalysis 없거나 매칭 실패 시 undefined. */
  sipseongJiji: string | undefined;
  /** 지장간 (천간 한글 배열, 여기→중기→정기 순). 항상 derived. */
  jijanggan: readonly string[];
  /** 12운성 라벨 (예: "양"/"장생"). 매칭 실패 시 undefined. */
  twelveFortune: string | undefined;
  /** 해당 기둥의 신살 이름 배열 (12신살 + 천의 + 관귀학관). 없으면 빈 배열. */
  sinsal: string[];
};

export type YongsinView = {
  /** 십신 (예: "정인") */
  십신: string;
  /** 오행 (예: "수") */
  오행: string;
};

export type MyeongsikViewModel = {
  pillars: {
    year: PillarView;
    month: PillarView;
    day: PillarView;
    /** 시 미상 시 null. */
    hour: PillarView | null;
  };
  /** 격국 (raw). fullAnalysis 없으면 undefined. */
  gyeokguk: Gyeokguk | undefined;
  /** 용신 (gyeokguk.yongsin 에서 추출). */
  yongsin: YongsinView | undefined;
  /** 오행 카운트 (목/화/토/금/수). 응답 우선 / fallback derived. 항상 존재. */
  ohaengCount: Record<Oheng, number>;
  /** 대운 — all_daeun raw. UI 에서 currentDaeun 중심 슬라이딩. */
  daeun: DaeunItem[] | undefined;
  /** 세운 — [currentSeun, ...upcomingSeuns]. UI 에서 슬라이딩. */
  seun: SeunItem[] | undefined;
  /** fullAnalysis 도달 여부 — UI 에서 풍부 모드 vs 기본 모드 분기. */
  hasFullData: boolean;
};

// ─────────────────────────────────────────────────────
// 내부 오행 매핑 (derived.ts 의 CHEONGAN_OHENG / JIJI_OHENG 와 동일.
//   derived.ts 가 단일 글자 → 오행 헬퍼를 export 하지 않으므로 inline 복제.
//   "기존 파일 무수정" 제약 준수.)
// ─────────────────────────────────────────────────────

const CHEONGAN_TO_OHENG: Record<string, Oheng> = {
  갑: "목", 을: "목",
  병: "화", 정: "화",
  무: "토", 기: "토",
  경: "금", 신: "금",   // 천간 辛 = 금
  임: "수", 계: "수",
};

const JIJI_TO_OHENG: Record<string, Oheng> = {
  자: "수", 축: "토",
  인: "목", 묘: "목",
  진: "토", 사: "화",
  오: "화", 미: "토",
  신: "금", 유: "금",   // 지지 申 = 금
  술: "토", 해: "수",
};

/** 응답 ohaeng 문자열을 Oheng 유니온으로 좁힘. 알 수 없으면 undefined. */
function asOheng(v: string | undefined): Oheng | undefined {
  if (v === "목" || v === "화" || v === "토" || v === "금" || v === "수") return v;
  return undefined;
}

// ─────────────────────────────────────────────────────
// position 매칭 (fuzzy)
// ─────────────────────────────────────────────────────

const PILLAR_KEYS = ["year", "month", "day", "hour"] as const;
type PillarKey = (typeof PILLAR_KEYS)[number];

const PILLAR_RE: Record<PillarKey, RegExp> = {
  year: /(year|년|연)/i,
  month: /(month|월)/i,
  day: /(day|일)/i,
  hour: /(hour|시)/i,
};

const SLOT_RE: Record<"gan" | "ji", RegExp> = {
  // 천간: gan/cheongan/천간/간 (단 "간지" 합본은 ji 로 분류되지 않도록 ji 패턴이 더 엄격)
  gan: /(gan(?!ji)|cheongan|천간|간)/i,
  // 지지: jiji/지지/지 — "ganji" 안에 "ji" 매칭 회피 위해 명시
  ji: /(jiji|지지|지(?![장간]))/i,
};

/**
 * position 문자열 fuzzy 매칭.
 * 응답의 정확한 표기(영문/한글/혼합)는 실측 미확인 → 여러 패턴 동시 허용.
 * 매칭 안 되면 호출처에서 undefined 처리.
 */
function matchPillarPosition(
  position: string,
  pillar: PillarKey,
  slot: "gan" | "ji",
): boolean {
  return PILLAR_RE[pillar].test(position) && SLOT_RE[slot].test(position);
}

/** sipseong.sipseongs[] 에서 (pillar, slot) 매칭되는 1개 추출. */
function findSipseong(
  items: SipseongItem[] | undefined,
  pillar: PillarKey,
  slot: "gan" | "ji",
): string | undefined {
  if (!items) return undefined;
  const hit = items.find((it) => matchPillarPosition(it.position, pillar, slot));
  return hit?.sipseong;
}

/** twelveFortune.fortunes[] 에서 pillar 매칭되는 1개 추출 (slot 무관). */
function findTwelveFortune(
  items: TwelveFortuneItem[] | undefined,
  pillar: PillarKey,
): string | undefined {
  if (!items) return undefined;
  const hit = items.find((it) => PILLAR_RE[pillar].test(it.position));
  return hit?.fortune;
}

/** 통합 신살 배열에서 pillar 에 붙은 살들 추출 (이름만). */
function findSinsal(items: SibisinsalItem[], pillar: PillarKey): string[] {
  return items
    .filter((it) => PILLAR_RE[pillar].test(it.position))
    .map((it) => it.name);
}

// ─────────────────────────────────────────────────────
// 오행 카운트 — 응답 경로 추출
// ─────────────────────────────────────────────────────

/** sipseong.cheonganHap.ohaengImpact.originalCount → 카운트 객체. 형식 다르면 undefined. */
function readOhengCountFromResponse(
  fa: Record<string, unknown> | null,
): Record<Oheng, number> | undefined {
  if (!fa) return undefined;
  const sipseong = fa.sipseong as Record<string, unknown> | undefined;
  const cheonganHap = sipseong?.cheonganHap as Record<string, unknown> | undefined;
  const ohaengImpact = cheonganHap?.ohaengImpact as Record<string, unknown> | undefined;
  const originalCount = ohaengImpact?.originalCount as Record<string, unknown> | undefined;
  if (!originalCount) return undefined;
  const keys: Oheng[] = ["목", "화", "토", "금", "수"];
  const result: Partial<Record<Oheng, number>> = {};
  for (const k of keys) {
    const v = originalCount[k];
    if (typeof v !== "number") return undefined;
    result[k] = v;
  }
  return result as Record<Oheng, number>;
}

// ─────────────────────────────────────────────────────
// 메인 함수
// ─────────────────────────────────────────────────────

/**
 * 화면용 단일 ViewModel 빌더.
 * fullAnalysis 가 null/형식 오류여도 안전 — myeongsik + derived 만으로 기본 모드 동작.
 *
 * @param myeongsik 4기둥 한글 (필수)
 * @param fullAnalysis luckyloveme 16종 raw json (optional)
 */
export function buildMyeongsikView(
  myeongsik: Myeongsik,
  fullAnalysis: unknown | null,
): MyeongsikViewModel {
  // ── fullAnalysis 정상 객체 여부 ──
  const fa =
    fullAnalysis && typeof fullAnalysis === "object" && !Array.isArray(fullAnalysis)
      ? (fullAnalysis as Record<string, unknown>)
      : null;
  const hasFullData = fa !== null;

  // ── 응답 필드 추출 (모두 optional 안전 접근) ──
  const ganji = fa?.ganji as Ganji | undefined;

  const sipseongRoot = fa?.sipseong as { sipseongs?: SipseongItem[] } | undefined;
  const sipseongItems = sipseongRoot?.sipseongs;

  const twelveFortuneRoot = fa?.twelveFortune as
    | { fortunes?: TwelveFortuneItem[] }
    | undefined;
  const twelveFortuneItems = twelveFortuneRoot?.fortunes;

  const sibisinsalsRoot = fa?.sibisinsals as
    | {
        sibisinsals?: SibisinsalItem[];
        cheonui?: SibisinsalItem[];
        gwangwihakgwan?: SibisinsalItem[];
      }
    | undefined;
  // 12신살 + 천의 + 관귀학관 통합 (백호살은 별도 — position 키 형식 다를 수 있어 일단 제외)
  const sinsalItems: SibisinsalItem[] = [
    ...(sibisinsalsRoot?.sibisinsals ?? []),
    ...(sibisinsalsRoot?.cheonui ?? []),
    ...(sibisinsalsRoot?.gwangwihakgwan ?? []),
  ];

  const gyeokguk = fa?.gyeokguk as Gyeokguk | undefined;
  const yongsin: YongsinView | undefined = gyeokguk?.yongsin
    ? { 십신: gyeokguk.yongsin.십신, 오행: gyeokguk.yongsin.오행 }
    : undefined;

  const daeunRoot = fa?.daeun as { all_daeun?: DaeunItem[] } | undefined;
  const daeun = daeunRoot?.all_daeun;

  const seunRoot = fa?.seun as
    | { currentSeun?: SeunItem; upcomingSeuns?: SeunItem[] }
    | undefined;
  const seun = seunRoot?.currentSeun
    ? [seunRoot.currentSeun, ...(seunRoot.upcomingSeuns ?? [])]
    : undefined;

  // ── 오행 카운트: 응답 우선, fallback derived ──
  const ohaengCount = readOhengCountFromResponse(fa) ?? countOheng(myeongsik);

  // ── 한 기둥 ViewModel 빌더 ──
  function buildPillar(
    pillar: PillarKey,
    cheongan: string,
    jiji: string,
    ganjiPillar: GanjiPillar | undefined,
    isDayPillar: boolean,
  ): PillarView {
    return {
      cheongan,
      cheonganHanja: ganjiPillar?.ganHanja ?? getCheonganHanja(cheongan),
      jiji,
      jijiHanja: ganjiPillar?.jiHanja ?? getJijiHanja(jiji),
      cheonganOhaeng:
        asOheng(ganjiPillar?.ohaeng.gan) ?? CHEONGAN_TO_OHENG[cheongan],
      jijiOhaeng: asOheng(ganjiPillar?.ohaeng.ji) ?? JIJI_TO_OHENG[jiji],
      sipseongCheongan: isDayPillar
        ? "나" // 일간 = 자기 자신, 십성 없음
        : findSipseong(sipseongItems, pillar, "gan"),
      sipseongJiji: findSipseong(sipseongItems, pillar, "ji"),
      jijanggan: getJijanggan(jiji),
      twelveFortune: findTwelveFortune(twelveFortuneItems, pillar),
      sinsal: findSinsal(sinsalItems, pillar),
    };
  }

  // ── 4기둥 빌드 ──
  const year = buildPillar(
    "year",
    myeongsik.year.cheongan,
    myeongsik.year.jiji,
    ganji?.year,
    false,
  );
  const month = buildPillar(
    "month",
    myeongsik.month.cheongan,
    myeongsik.month.jiji,
    ganji?.month,
    false,
  );
  const day = buildPillar(
    "day",
    myeongsik.day.cheongan,
    myeongsik.day.jiji,
    ganji?.day,
    true, // 일간 = "나"
  );
  const hour = myeongsik.hour
    ? buildPillar(
        "hour",
        myeongsik.hour.cheongan,
        myeongsik.hour.jiji,
        ganji?.hour,
        false,
      )
    : null;

  return {
    pillars: { year, month, day, hour },
    gyeokguk,
    yongsin,
    ohaengCount,
    daeun,
    seun,
    hasFullData,
  };
}
