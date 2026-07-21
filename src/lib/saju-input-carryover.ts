// =====================================================
// 사주 입력 이월(carryover) — 무료 운세 → 유료 결제 폼 프리필
// =====================================================
// 지시문_사주입력_프리필_20260721.md §1②/§2 — 비로그인(또는 profiles에 아직
// 값이 없는 로그인 사용자)이 무료 운세에서 입력한 값을, 같은 세션 안에서
// 유료 결제 폼(SajuForm)이 프리필용으로 재사용한다. sessionStorage만 쓰고
// 서버 저장은 하지 않는다 — 탭을 닫으면 자연 소멸(개인정보 요구사항).
// onboarding-storage.ts와 목적·데이터 모양이 달라 별도 파일로 분리했다.

export type SajuInputCarryover = {
  name?: string;
  birthDate?: string; // "YYYY-MM-DD"
  birthTime?: string | null; // "HH:mm" 24시간제, null이면 시간 모름
  timeUnknown: boolean;
  gender?: "male" | "female";
  calendar?: "solar" | "lunar";
  isLeapMonth: boolean;
  savedAt: number; // Date.now()
};

const KEY = "saju_input_carryover";
// sessionStorage 자체가 탭 종료 시 소멸하니 이 TTL은 "같은 탭을 오래 켜두고
// 방치"하는 케이스에 대한 추가 방어일 뿐이다 — 임의값, 필요시 조정.
const DEFAULT_MAX_AGE_MS = 60 * 60 * 1000;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function saveSajuInputCarryover(data: Omit<SajuInputCarryover, "savedAt">): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
  } catch {
    // 용량 초과 등 — silent ignore
  }
}

export function getSajuInputCarryover(maxAgeMs: number = DEFAULT_MAX_AGE_MS): SajuInputCarryover | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SajuInputCarryover;
    if (!parsed || typeof parsed !== "object" || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > maxAgeMs) {
      clearSajuInputCarryover();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSajuInputCarryover(): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
