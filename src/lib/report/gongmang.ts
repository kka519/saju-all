// =====================================================
// 공망(空亡) 계산 — 순중공망 조견표
// =====================================================
// luckyloveme API 는 공망 필드를 주지 않음 (AnalysisField 목록에 없음) — 로컬 계산.
// 원리: 60갑자를 10개씩 6개 순(旬)으로 나누면, 각 순은 지지 12개 중 10개만 사용하고
// 나머지 2개 지지가 그 순 전체의 공망이 된다. 일주의 순을 찾아 그 2개를 반환.
//
// 검증: 갑진(甲辰)일주 → 갑진순(40~49) → 사용 지지 진사오미신유술해자축(4~1, 10개)
//       → 미사용(공망) 인묘(2,3) — report-template.html 레퍼런스의 "공망 인묘(寅卯)"와 일치.

const CHEONGAN = ["갑", "을", "병", "정", "무", "기", "경", "신", "임", "계"] as const;
const JIJI = ["자", "축", "인", "묘", "진", "사", "오", "미", "신", "유", "술", "해"] as const;

/** 일주 천간·지지(한글) → 공망 지지 2개(한글). 유효하지 않은 조합이면 빈 배열. */
export function getGongmang(dayGan: string, dayJi: string): string[] {
  const ganIdx = CHEONGAN.indexOf(dayGan as (typeof CHEONGAN)[number]);
  const jiIdx = JIJI.indexOf(dayJi as (typeof JIJI)[number]);
  if (ganIdx === -1 || jiIdx === -1) return [];

  // 60갑자 내 위치 n: n%10===ganIdx && n%12===jiIdx (0~59 범위에서 유일).
  let n = -1;
  for (let i = 0; i < 60; i++) {
    if (i % 10 === ganIdx && i % 12 === jiIdx) {
      n = i;
      break;
    }
  }
  if (n === -1) return []; // 이론상 도달 불가 (ganIdx/jiIdx 유효하면 항상 존재)

  const decadeStart = Math.floor(n / 10) * 10;
  const baseJi = decadeStart % 12; // 이 순의 첫 글자(갑X)의 지지 인덱스
  const usedJi = new Set<number>();
  for (let k = 0; k < 10; k++) usedJi.add((baseJi + k) % 12);

  const gongmang: string[] = [];
  for (let i = 0; i < 12; i++) {
    if (!usedJi.has(i)) gongmang.push(JIJI[i]);
  }
  return gongmang; // 항상 길이 2
}
