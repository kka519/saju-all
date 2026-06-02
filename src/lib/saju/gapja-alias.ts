// =====================================================
// src/lib/saju/gapja-alias.ts
// =====================================================
// 일주 60갑자 별칭 — "색 + 동물" 2개 매핑 조합으로 생성.
// 수기 60개 테이블 대신 (천간→색) × (지지→동물) 조합 = 5 × 12 = 60.
//
// 색 매핑은 천간 오행과 1:1 일치 (derived.ts 의 CHEONGAN_OHENG 과 같은 체계):
//   갑·을 = 목 → "푸른"   (oheng-mok  청록)
//   병·정 = 화 → "붉은"   (oheng-hwa  다홍)
//   무·기 = 토 → "누런"   (oheng-to   황토)
//   경·신 = 금 → "흰"     (oheng-geum 강철/백)
//   임·계 = 수 → "검은"   (oheng-su   야간청/흑)
// → 셀 오행 틴트 색과 별칭 색이 자동 정합 (예: 일간이 갑이면 셀은 청록 틴트 + 별칭 "푸른").
//
// 동물 매핑은 표준 12지 (자=쥐, 축=소, …).
//
// ⚠️ 감성 수식어("활기찬", "지혜로운" 등) 절대 추가하지 말 것.
//    별칭은 "색 + 동물" 단순 조합까지만 — 본 모듈의 의도된 좁은 범위.

const CHEONGAN_COLOR: Record<string, string> = {
  갑: "푸른",
  을: "푸른",
  병: "붉은",
  정: "붉은",
  무: "누런",
  기: "누런",
  경: "흰",
  신: "흰", // 천간 辛 (한국어 표기상 지지 申 과 같지만 별개 매핑)
  임: "검은",
  계: "검은",
};

const JIJI_ANIMAL: Record<string, string> = {
  자: "쥐",
  축: "소",
  인: "호랑이",
  묘: "토끼",
  진: "용",
  사: "뱀",
  오: "말",
  미: "양",
  신: "원숭이", // 지지 申 (천간 辛 과 별개)
  유: "닭",
  술: "개",
  해: "돼지",
};

/**
 * 일주 별칭 — "색 + 동물" 문자열.
 *
 * @param cheongan 일간 한글 1글자 (갑/을/.../계)
 * @param jiji 일지 한글 1글자 (자/축/.../해)
 * @returns 예: ("갑","진") → "푸른 용", ("병","오") → "붉은 말", ("임","자") → "검은 쥐".
 *          매핑에 없는 글자는 undefined (헤더에서 별칭 부분 생략).
 */
export function getIljuAlias(
  cheongan: string,
  jiji: string,
): string | undefined {
  const color = CHEONGAN_COLOR[cheongan];
  const animal = JIJI_ANIMAL[jiji];
  if (!color || !animal) return undefined;
  return `${color} ${animal}`;
}
