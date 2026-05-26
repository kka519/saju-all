// =====================================================
// 회원가입 퍼널 sessionStorage 헬퍼 — 평탄 구조 (재설계 A)
// =====================================================
// 9개 화면 대화형 흐름. 한 화면 한 질문 → patchData()로 부분 병합.
// session 단위 — 탭 닫으면 자연 정리.

export type OnboardingData = {
  name?: string;
  birthYear?: string;
  birthMonth?: string;
  birthDay?: string;
  birthHour?: string;
  birthMinute?: string;
  hourUnknown?: boolean;
  gender?: "male" | "female";
  calendar?: "solar" | "lunar";
  concerns?: string[];
  freeFortune?: string;
};

const KEY = "onboarding_data";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function getData(): OnboardingData {
  if (!isBrowser()) return {};
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as OnboardingData) : {};
  } catch {
    return {};
  }
}

export function patchData(patch: Partial<OnboardingData>): void {
  if (!isBrowser()) return;
  const next = { ...getData(), ...patch };
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 용량 초과 등 — silent ignore
  }
}

export function clearData(): void {
  if (!isBrowser()) return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
