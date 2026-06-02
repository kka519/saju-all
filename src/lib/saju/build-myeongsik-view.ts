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
//   - 오행       : fullAnalysis.ganji.*.ohaeng.gan/ji > derived.getCheonganOheng/getJijiOheng
//   - 오행 개수  : fullAnalysis.sipseong.cheonganHap.ohaengImpact.originalCount > derived.countOheng
//   - 지장간     : 항상 derived.getJijanggan (응답에 없음)
//   - 십성/운성/신살/대운/세운/격국/용신: fullAnalysis 있을 때만, 없으면 undefined.
//
// 정규화 정책 (ViewModel 단계에서 UI 분기·키 변환을 최소화):
//   - daeun[].sipseong / seun[].sipseong : 응답 sipseongRelation 키를 sipseong 로 통일.
//   - daeun[].ganElement / jiElement     : 응답에 없음 → ganji 2글자에서 derived 오행 계산.
//   - daeun[].isCurrent / seun[].isCurrent : 현재 만 나이(KST) 와 비교/index 0 매칭.
//   - pillars.*.isDayPillar              : 일간 칸 여부.
//   - view.sinsals (top-level)            : 12신살 + 천의 + 관귀학관 + 백호살 통합 1차원 배열, category 필드.
//
// 핵심 주의사항:
//   1) sipseong / twelveFortune / sibisinsals 의 position 키로 4기둥 매칭.
//      인덱스 순서 가정 금지 — position 문자열 fuzzy 매칭(year|month|day|hour + gan|ji).
//   2) 일간(day.cheongan) 은 십성 없음 — sipseongCheongan = "나" 고정.
//   3) position 정확 표기(영문/한글/혼합)는 실측 미확인 → fuzzy 매칭으로 대응.
//      매칭 안 되면 undefined 로 두고 UI 는 빈 셀 처리.
//   4) 현재 나이 산출(isCurrent) Option A:
//        1순위 fa.daeun.current_age (응답 직접 사용)
//        2순위 fa.daeun.birth_info → KST 만 나이 계산 (생일 미경과 시 -1)
//        3순위 둘 다 없음 → null (isCurrent 모두 false)
//      myeongsik 인자에는 생년월일이 없으므로 응답 외 입력 의존 금지.

import type { Myeongsik } from "./manseryeok";
import {
  countOheng,
  getCheonganHanja,
  getCheonganOheng,
  getJijanggan,
  getJijiHanja,
  getJijiOheng,
  type Oheng,
} from "./derived";
import type {
  Ganji,
  GanjiPillar,
  SipseongInfo,
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
  /** 천간 오행 (셀 색상용). 응답 우선, fallback derived. */
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
  /** 일간 칸 여부 — day 만 true. UI 강조용. */
  isDayPillar: boolean;
};

/** 정규화된 단일 신살. view.sinsals 의 원소. */
export type SinsalItem = {
  /** 살 이름 (예: "역마", "도화", "백호살", "천의성" 등) */
  name: string;
  /**
   * 응답에 기록된 position 문자열. 12신살/천의/관귀학관은 단일 위치,
   * 백호살은 positions[] 를 flatten 하면서 각 position 으로 분해.
   */
  position: string;
  /** 응답 ji (지지 한글). 백호살은 응답에 ji 없으므로 undefined. */
  ji?: string;
  /** 해석 설명. */
  description: string;
  /** 출처 카테고리 — UI 색상/그룹핑용. */
  category: "sibisinsals" | "cheonui" | "gwangwihakgwan" | "baekhosal";
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
  /**
   * 대운 — all_daeun. 각 항목에 isCurrent/ganElement/jiElement 정규화 주입.
   * UI 에서 currentDaeun 중심 슬라이딩.
   */
  daeun: DaeunItem[] | undefined;
  /**
   * 세운 — [currentSeun, ...upcomingSeuns]. 각 항목 sipseongRelation→sipseong 통일 + isCurrent 주입.
   * isCurrent 는 index 0 (currentSeun) 1건만 true.
   */
  seun: SeunItem[] | undefined;
  /**
   * 통합 신살 배열 (12신살 + 천의 + 관귀학관 + 백호살).
   * UI 가 카테고리별 분기 없이 1차원 순회로 렌더 가능.
   * 응답에 sibisinsals 자체가 없으면 빈 배열.
   */
  sinsals: SinsalItem[];
  /** fullAnalysis 도달 여부 — UI 에서 풍부 모드 vs 기본 모드 분기. */
  hasFullData: boolean;
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

/** 통합 신살 배열에서 pillar 에 붙은 살들 추출 (이름만). 백호살은 별도 처리. */
function findSinsal(items: SibisinsalItem[], pillar: PillarKey): string[] {
  return items
    .filter((it) => PILLAR_RE[pillar].test(it.position))
    .map((it) => it.name);
}

// ─────────────────────────────────────────────────────
// 현재 만 나이 산출 — Option A
// ─────────────────────────────────────────────────────
// 1순위 fa.daeun.current_age (응답 직접)
// 2순위 fa.daeun.birth_info  (year/month/day) + KST now → 만 나이 (생일 미경과 -1)
// 3순위 둘 다 없음 → null  (isCurrent 모두 false)
//
// myeongsik 인자에는 생년월일이 없음 — 응답 외 입력 의존 금지(루나 결정).

function calcCurrentAge(fa: Record<string, unknown> | null): number | null {
  if (!fa) return null;
  const daeunRaw = fa.daeun as Record<string, unknown> | undefined;
  if (!daeunRaw) return null;

  // 1순위
  const direct = daeunRaw.current_age;
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;

  // 2순위
  const birthInfo = daeunRaw.birth_info as Record<string, unknown> | undefined;
  if (!birthInfo) return null;
  const y = Number(birthInfo.year);
  const m = Number(birthInfo.month);
  const d = Number(birthInfo.day);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;

  // KST 현재 시각 — Intl 로 안전하게 (서버 TZ 가 UTC 든 KST 든 동일 결과)
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const curY = Number(parts.find((p) => p.type === "year")?.value);
  const curM = Number(parts.find((p) => p.type === "month")?.value);
  const curD = Number(parts.find((p) => p.type === "day")?.value);
  if (!Number.isFinite(curY) || !Number.isFinite(curM) || !Number.isFinite(curD)) {
    return null;
  }

  let age = curY - y;
  if (curM < m || (curM === m && curD < d)) age -= 1; // 생일 미경과
  return age >= 0 ? age : null;
}

// ─────────────────────────────────────────────────────
// 신살 통합 (12신살 + 천의 + 관귀학관 + 백호살 flatten)
// ─────────────────────────────────────────────────────
// 백호살은 응답 구조가 다르므로(positions: string[]) 분해 후 1건씩 push.
// ji 는 응답 구조상 백호살에 없으므로 undefined 로 둠 (UI 빈 셀).

function collectAllSinsals(
  sibisinsalsRoot:
    | {
        sibisinsals?: SibisinsalItem[];
        cheonui?: SibisinsalItem[];
        gwangwihakgwan?: SibisinsalItem[];
        baekhosal?: {
          exists?: boolean;
          positions?: string[];
          strength?: string;
          description?: string;
        };
      }
    | undefined,
): SinsalItem[] {
  if (!sibisinsalsRoot) return [];
  const out: SinsalItem[] = [];

  for (const it of sibisinsalsRoot.sibisinsals ?? []) {
    out.push({
      name: it.name,
      position: it.position,
      ji: it.ji,
      description: it.description,
      category: "sibisinsals",
    });
  }
  for (const it of sibisinsalsRoot.cheonui ?? []) {
    out.push({
      name: it.name,
      position: it.position,
      ji: it.ji,
      description: it.description,
      category: "cheonui",
    });
  }
  for (const it of sibisinsalsRoot.gwangwihakgwan ?? []) {
    out.push({
      name: it.name,
      position: it.position,
      ji: it.ji,
      description: it.description,
      category: "gwangwihakgwan",
    });
  }
  const bh = sibisinsalsRoot.baekhosal;
  if (bh?.exists && Array.isArray(bh.positions) && bh.positions.length > 0) {
    for (const pos of bh.positions) {
      out.push({
        name: "백호살",
        position: pos,
        ji: undefined,
        description: bh.description ?? "",
        category: "baekhosal",
      });
    }
  }
  return out;
}

// ─────────────────────────────────────────────────────
// 대운/세운 정규화
// ─────────────────────────────────────────────────────

function normalizeDaeun(
  raw: DaeunItem[] | undefined,
  currentAge: number | null,
): DaeunItem[] | undefined {
  if (!raw) return undefined;
  return raw.map((d) => {
    // ganji 한글 2글자 → derived 오행
    const ganChar = d.ganji?.[0];
    const jiChar = d.ganji?.[1];
    const ganElement = ganChar ? getCheonganOheng(ganChar) : undefined;
    const jiElement = jiChar ? getJijiOheng(jiChar) : undefined;
    const isCurrent =
      currentAge !== null && currentAge >= d.age_start && currentAge <= d.age_end;
    return {
      ...d,
      ganElement,
      jiElement,
      isCurrent,
    };
  });
}

/**
 * 세운 정규화 — sipseongRelation → sipseong 키 통일 + isCurrent 주입.
 * raw 응답은 sipseongRelation 키. SeunItem 타입에는 sipseong 으로 통일.
 * isCurrent: index 0 (currentSeun) 1건만 true.
 */
function normalizeSeun(rawList: unknown[] | undefined): SeunItem[] | undefined {
  if (!rawList) return undefined;
  return rawList.map((raw, idx) => {
    const r = raw as Record<string, unknown>;
    // raw 응답 키 sipseongRelation 추출 (타입은 SipseongInfo 와 호환)
    const sipseongRel = r.sipseongRelation as SipseongInfo | undefined;
    // 이미 sipseong 키로 들어온 경우도 대비 (테스트/내부 통합 케이스)
    const sipseongAlready = r.sipseong as SipseongInfo | undefined;
    const sipseong = sipseongAlready ?? sipseongRel;

    // sipseongRelation 제거 + sipseong / isCurrent 주입
    const { sipseongRelation: _drop, ...rest } = r as { sipseongRelation?: unknown } & Record<
      string,
      unknown
    >;
    void _drop;
    return {
      ...(rest as unknown as SeunItem),
      sipseong,
      isCurrent: idx === 0,
    };
  });
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
        baekhosal?: {
          exists?: boolean;
          positions?: string[];
          strength?: string;
          description?: string;
        };
      }
    | undefined;
  // pillars.*.sinsal (per-pillar 이름 배열) 매칭용 — 12신살 + 천의 + 관귀학관.
  // 백호살은 응답에 position 없이 positions[] 만 있어 pillar 별 매칭 어려움 → per-pillar 에서 제외.
  // view.sinsals (top-level) 에는 collectAllSinsals 가 백호살까지 flatten 포함.
  const sinsalItems: SibisinsalItem[] = [
    ...(sibisinsalsRoot?.sibisinsals ?? []),
    ...(sibisinsalsRoot?.cheonui ?? []),
    ...(sibisinsalsRoot?.gwangwihakgwan ?? []),
  ];
  const sinsals = collectAllSinsals(sibisinsalsRoot);

  const gyeokguk = fa?.gyeokguk as Gyeokguk | undefined;
  const yongsin: YongsinView | undefined = gyeokguk?.yongsin
    ? { 십신: gyeokguk.yongsin.십신, 오행: gyeokguk.yongsin.오행 }
    : undefined;

  // ── 현재 만 나이 (Option A: 응답 우선) ──
  const currentAge = calcCurrentAge(fa);

  // ── 대운 정규화 (isCurrent / ganElement / jiElement 주입) ──
  const daeunRoot = fa?.daeun as { all_daeun?: DaeunItem[] } | undefined;
  const daeun = normalizeDaeun(daeunRoot?.all_daeun, currentAge);

  // ── 세운 정규화 (sipseongRelation → sipseong + isCurrent 주입) ──
  const seunRoot = fa?.seun as
    | { currentSeun?: unknown; upcomingSeuns?: unknown[] }
    | undefined;
  const seunRawArr = seunRoot?.currentSeun
    ? [seunRoot.currentSeun, ...(seunRoot.upcomingSeuns ?? [])]
    : undefined;
  const seun = normalizeSeun(seunRawArr);

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
        asOheng(ganjiPillar?.ohaeng.gan) ?? getCheonganOheng(cheongan),
      jijiOhaeng: asOheng(ganjiPillar?.ohaeng.ji) ?? getJijiOheng(jiji),
      sipseongCheongan: isDayPillar
        ? "나" // 일간 = 자기 자신, 십성 없음
        : findSipseong(sipseongItems, pillar, "gan"),
      sipseongJiji: findSipseong(sipseongItems, pillar, "ji"),
      jijanggan: getJijanggan(jiji),
      twelveFortune: findTwelveFortune(twelveFortuneItems, pillar),
      sinsal: findSinsal(sinsalItems, pillar),
      isDayPillar,
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
    sinsals,
    hasFullData,
  };
}
