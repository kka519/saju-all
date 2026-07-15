// =====================================================
// 사주 풀 분석 API 어댑터 (luckyloveme.com)
// =====================================================
// POST https://luckyloveme.com/api/saju-full-analysis
// 환경변수 SAJU_API_URL + SAJU_API_KEY 가 설정돼 있을 때만 호출됩니다.
// 호출 측은 isSajuApiConfigured() 로 분기하거나 SajuApiError 를 잡아 mock 으로 대체하세요.
//
// 자세한 응답 스키마는 운세위키 API 문서 참고: https://luckyloveme.com/api-service

import { serverEnv } from "@/lib/env";
import { recordSajuApiCall, type SajuApiSource } from "./usage";

export type AnalysisField =
  | "ganji"            // 천간지지 (사주 원국)
  | "guiin"            // 귀인 (16종)
  | "hongyeom"         // 홍염살
  | "dohwa"            // 도화살
  | "hwagae"           // 화개살
  | "bigyeonGeobjae"   // 비견 · 겁재
  | "sibisinsals"      // 12신살
  | "sipseong"         // 십성
  | "sinStrength"      // 신강 / 신약 (7단계)
  | "daeun"            // 대운 (10년 주기)
  | "seun"             // 세운 (연간)
  | "hapchung"         // 합 · 충 · 형 · 해 · 파
  | "gyeokguk"         // 격국 (억부용신)
  | "gyeokgukYongsin"  // 격국용신 (자평진전 체계) — fields 에 명시해야 반환됨
  | "twelveFortune"    // 12운성
  | "weolun";          // 월운 (최근 3개월 + 현재 + 향후 11개월)

// couple-match 전용 경량 필드셋 — 대운·월운(가장 부피가 큰 시계열 필드, 합쳐서 전체의
// ~37%) 제외. 이유: 두 사람 몫의 전체 16필드(각 ~80K자)를 합치면 프롬프트가 160K+자로
// 커져 LLM 응답이 중간에 잘리는 문제가 실측 확인됨(2026-07-15). 궁합 포커스(일간
// 상생상극·합충·십성 보완)에 daeun/weolun 은 상대적으로 덜 필수적이라 이 둘만 제외 —
// "관계 발전 시기" 판단에 필요한 세운은 유지.
export const COUPLE_MATCH_FIELDS: AnalysisField[] = [
  "ganji",
  "guiin",
  "hongyeom",
  "dohwa",
  "hwagae",
  "bigyeonGeobjae",
  "sibisinsals",
  "sipseong",
  "sinStrength",
  "seun",
  "hapchung",
  "gyeokguk",
  "gyeokgukYongsin",
  "twelveFortune",
];

export type BirthInfo = {
  birthYear: string;        // "1990"
  birthMonth: string;       // "5"  (1~12)
  birthDay: string;         // "15" (1~31)
  birthHour?: string;       // "14" (0~23) — 선택
  birthMinute?: string;     // "30" (0~59) — 선택
  calendarType: "양력" | "음력";
  gender: "male" | "female";
  isLeapMonth?: boolean;    // 음력 윤달
  useYajasiRule?: boolean;  // 야자시/조자시 규칙 적용
};

// 응답은 요청한 field 만 포함됩니다. 자세한 필드별 스키마는 API 문서를 따르세요.
export type SajuAnalysisResponse = Partial<Record<AnalysisField, unknown>>;

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [500, 1500, 3500];

export class SajuApiError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "SajuApiError";
  }
}

export function isSajuApiConfigured(): boolean {
  const env = serverEnv();
  return !!(env.SAJU_API_URL && env.SAJU_API_KEY);
}

export type FetchSajuOptions = {
  source?: SajuApiSource; // 누적 카운터에 기록될 호출 출처 (기본: "manual")
};

// 5xx / 네트워크 오류 / 타임아웃 → 최대 3회 재시도 (4xx 는 즉시 실패)
export async function fetchSajuAnalysis(
  birthInfo: BirthInfo,
  fields: AnalysisField[] = [],
  options: FetchSajuOptions = {},
): Promise<SajuAnalysisResponse> {
  const env = serverEnv();
  const source: SajuApiSource = options.source ?? "manual";
  if (!env.SAJU_API_URL || !env.SAJU_API_KEY) {
    throw new SajuApiError("SAJU_API_URL / SAJU_API_KEY 환경변수가 설정되지 않았습니다.");
  }
  const url = env.SAJU_API_URL;
  const apiKey = env.SAJU_API_KEY;

  const body = JSON.stringify({ ...birthInfo, fields });
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await sleep(RETRY_DELAYS_MS[attempt - 1] ?? 3500);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "SajuBookClient/1.0",
          "X-SAJU-BOOK-API-KEY": apiKey,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = (await res.json()) as SajuAnalysisResponse;
        await recordSajuApiCall(true, source);
        return data;
      }

      // 4xx 는 입력 오류 — 재시도해도 의미 없으므로 즉시 실패
      if (res.status < 500) {
        const detail = await res.text().catch(() => "");
        await recordSajuApiCall(false, source);
        throw new SajuApiError(`Saju API ${res.status}: ${detail || res.statusText}`, res.status);
      }

      lastError = new SajuApiError(`Saju API ${res.status}`, res.status);
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof SajuApiError && err.status && err.status < 500) throw err;
      lastError = err;
    }
  }

  // 모든 재시도 소진 → 실패로 기록
  await recordSajuApiCall(false, source);
  if (lastError instanceof Error) throw lastError;
  throw new SajuApiError("Saju API 요청이 최대 재시도 횟수를 초과했습니다.");
}

// 분석 응답 → LLM 프롬프트용 한국어 텍스트
export function formatSajuToManseryeok(
  analysis: SajuAnalysisResponse,
  birthInfo: BirthInfo,
): string {
  const head = [
    `[명식 기본 정보]`,
    `생년월일: ${birthInfo.birthYear}-${pad2(birthInfo.birthMonth)}-${pad2(birthInfo.birthDay)} (${birthInfo.calendarType}${birthInfo.isLeapMonth ? ", 윤달" : ""})`,
    birthInfo.birthHour != null && birthInfo.birthHour !== ""
      ? `출생시각: ${pad2(birthInfo.birthHour)}:${pad2(birthInfo.birthMinute ?? "00")}`
      : `출생시각: 모름`,
    `성별: ${birthInfo.gender === "male" ? "남성" : "여성"}`,
  ].join("\n");

  // 출력 순서를 보기 좋게 고정
  const order: { key: AnalysisField; label: string }[] = [
    { key: "ganji",          label: "천간지지 (사주 원국)" },
    { key: "sipseong",        label: "십성" },
    { key: "sinStrength",     label: "신강/신약" },
    { key: "gyeokguk",        label: "격국 (억부용신)" },
    { key: "gyeokgukYongsin", label: "격국용신 (자평진전)" },
    { key: "twelveFortune",   label: "12운성" },
    { key: "daeun",          label: "대운" },
    { key: "seun",           label: "세운" },
    { key: "weolun",         label: "월운" },
    { key: "guiin",          label: "귀인" },
    { key: "hongyeom",       label: "홍염살" },
    { key: "dohwa",          label: "도화살" },
    { key: "hwagae",         label: "화개살" },
    { key: "sibisinsals",    label: "12신살" },
    { key: "bigyeonGeobjae", label: "비견/겁재" },
    { key: "hapchung",       label: "합·충·형·해·파" },
  ];

  const sections = order
    .map(({ key, label }) => {
      const value = analysis[key];
      if (value == null) return null;
      return `[${label}]\n${stringifyValue(value)}`;
    })
    .filter((v): v is string => !!v);

  return [head, ...sections].join("\n\n");
}

// API 호출 + 텍스트 변환을 한 번에 실행 (전체 fields 자동 요청)
export async function generateManseryeok(
  birthInfo: BirthInfo,
  options: FetchSajuOptions = {},
): Promise<string> {
  const analysis = await fetchSajuAnalysis(birthInfo, [], options); // [] = 전체
  return formatSajuToManseryeok(analysis, birthInfo);
}

// luckyloveme ganji 응답 → 기존 Myeongsik (4기둥 단순 형식)
// MyeongsikTable 컴포넌트에 그대로 꽂아쓸 수 있는 형식으로 변환
export type SimpleMyeongsik = {
  year: { cheongan: string; jiji: string };
  month: { cheongan: string; jiji: string };
  day: { cheongan: string; jiji: string };
  hour: { cheongan: string; jiji: string } | null;
};

export function ganjiToMyeongsik(analysis: SajuAnalysisResponse): SimpleMyeongsik | null {
  const g = analysis.ganji as
    | {
        year: { gan: string; ji: string };
        month: { gan: string; ji: string };
        day: { gan: string; ji: string };
        hour?: { gan: string; ji: string };
      }
    | undefined;
  if (!g) return null;
  const pillar = (p: { gan: string; ji: string }) => ({ cheongan: p.gan, jiji: p.ji });
  return {
    year: pillar(g.year),
    month: pillar(g.month),
    day: pillar(g.day),
    hour: g.hour ? pillar(g.hour) : null,
  };
}

// ── helpers ───────────────────────────────────────────
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function pad2(v: string | number): string {
  const s = String(v);
  return s.length >= 2 ? s : `0${s}`;
}

function stringifyValue(v: unknown, indent = ""): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  if (Array.isArray(v)) {
    return v
      .map((item) => `${indent}- ${stringifyValue(item, indent + "  ").replace(/^\n+/, "")}`)
      .join("\n");
  }
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => {
        const formatted = stringifyValue(val, indent + "  ");
        return formatted.includes("\n")
          ? `${indent}${k}:\n${formatted}`
          : `${indent}${k}: ${formatted}`;
      })
      .join("\n");
  }
  return JSON.stringify(v);
}
