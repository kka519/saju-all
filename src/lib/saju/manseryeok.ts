// =====================================================
// 만세력 어댑터
// =====================================================
// 외부 만세력 API가 있으면 호출, 없으면 mock(데모) 반환.
// 수강생은 본인이 쓰는 API에 맞춰 callExternalManseryeok() 만 갈아끼우면 됩니다.

import { serverEnv } from "@/lib/env";

export type Pillar = {
  cheongan: string; // 천간
  jiji: string; // 지지
};

export type Myeongsik = {
  year: Pillar;
  month: Pillar;
  day: Pillar;
  hour: Pillar | null; // 시 모르는 경우 null
};

export type ManseryeokInput = {
  birthDate: string; // YYYY-MM-DD
  birthTime: string | null; // HH:mm
  timeUnknown: boolean;
  calendar: "solar" | "lunar";
  gender: "male" | "female";
};

export async function computeMyeongsik(input: ManseryeokInput): Promise<Myeongsik> {
  const env = serverEnv();
  if (env.MANSERYEOK_API_URL) {
    return callExternalManseryeok(input, env.MANSERYEOK_API_URL, env.MANSERYEOK_API_KEY);
  }
  return mockMyeongsik(input);
}

async function callExternalManseryeok(
  input: ManseryeokInput,
  url: string,
  apiKey: string | undefined,
): Promise<Myeongsik> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error(`Manseryeok API failed: ${res.status}`);
  }
  return (await res.json()) as Myeongsik;
}

// 데모용 결정론적 mock — 진짜 만세력 계산 X
// 수강생이 빈 .env로도 결제 → 결과 페이지까지 도달할 수 있도록 함
// 기존 한계(윤달 전용 이슈 아님): input.calendar/양음력 변환을 전혀 하지 않고 birthDate를
// 그대로 JS Date로 파싱한다 — 평달 음력 입력도 이미 부정확했다. luckyloveme API가 정상
// 응답하면 이 경로는 쓰이지 않으므로(폴백 전용) 별도 수정하지 않는다(2026-07-15 확인).
function mockMyeongsik(input: ManseryeokInput): Myeongsik {
  const cheongan = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"];
  const jiji = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"];
  const d = new Date(input.birthDate);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = input.timeUnknown || !input.birthTime ? null : parseInt(input.birthTime.split(":")[0], 10);

  const pick = (n: number, arr: string[]) => arr[((n % arr.length) + arr.length) % arr.length];

  return {
    year: { cheongan: pick(year - 4, cheongan), jiji: pick(year - 4, jiji) },
    month: { cheongan: pick(year + month, cheongan), jiji: pick(month + 1, jiji) },
    day: { cheongan: pick(year + month + day, cheongan), jiji: pick(day, jiji) },
    hour: hour === null ? null : { cheongan: pick(hour, cheongan), jiji: pick(Math.floor((hour + 1) / 2), jiji) },
  };
}
