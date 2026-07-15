// =====================================================
// src/lib/saju/jiji-relations.ts
// =====================================================
// 두 간지 사이의 합·충·파·형·삼합·해(천간은 합·충만) 관계를 판정하는 고정 테이블.
// today-fortune의 "오늘 일진 vs 원국 4기둥 전체" 톤 판정 + 커플 궁합 리포트의
// 두 명식 교차 관계도(couple-relations-chart.ts)에 사용 — 순수 계산, API 호출 없음
// (gongmang.ts/cheoneul-table.ts와 동일 스타일).
//
// 단순화 노트: 실제 명리학에서는 유파에 따라 파/형 세부 규칙에 이견이 있다.
// 여기서는 가장 널리 쓰이는 표를 채택했다 — 마케팅용 톤 판정이 목적이라
// 학술적 완전성보다 "코드가 일관되게 계산한다"는 원칙을 우선했다.

export type RelationType = "합" | "충" | "파" | "형";
/** 커플 궁합 관계도 전용 확장 타입 — 삼합/해 추가. today-fortune 스코어링(RelationType 4종
 * 가정, "합"만 긍정 취급)에 영향 주지 않도록 별도 타입+함수로 완전히 분리한다. */
export type ExtendedRelationType = RelationType | "삼합" | "해";

const JIJI_HAP: readonly [string, string][] = [
  ["자", "축"], ["인", "해"], ["묘", "술"], ["진", "유"], ["사", "신"], ["오", "미"],
];
const JIJI_CHUNG: readonly [string, string][] = [
  ["자", "오"], ["축", "미"], ["인", "신"], ["묘", "유"], ["진", "술"], ["사", "해"],
];
const JIJI_PA: readonly [string, string][] = [
  ["자", "유"], ["축", "진"], ["인", "해"], ["묘", "오"], ["사", "신"], ["술", "미"],
];
// 육해(六害) — 육합을 방해하는 관계로 정의되는 6쌍.
const JIJI_HAE: readonly [string, string][] = [
  ["자", "미"], ["축", "오"], ["인", "사"], ["묘", "진"], ["신", "해"], ["유", "술"],
];
const SAMHYEONG_GROUPS: readonly (readonly string[])[] = [
  ["인", "사", "신"],
  ["축", "술", "미"],
];
const JAHYEONG = new Set(["진", "오", "유", "해"]); // 자형(동일 지지 재출현)

// 삼합(三合) 4국 — 두 지지만 겹쳐도 "반합"으로 판정(완성엔 세 번째 지지 필요하나,
// 커플 궁합 관계도는 두 명식 4기둥끼리의 조합만 보므로 부분 일치를 "삼합" 표기로 통일).
const SAMHAP_GROUPS: readonly (readonly string[])[] = [
  ["인", "오", "술"], // 화국
  ["신", "자", "진"], // 수국
  ["사", "유", "축"], // 금국
  ["해", "묘", "미"], // 목국
];

const CHEONGAN_HAP: readonly [string, string][] = [
  ["갑", "기"], ["을", "경"], ["병", "신"], ["정", "임"], ["무", "계"],
];
const CHEONGAN_CHUNG: readonly [string, string][] = [
  ["갑", "경"], ["을", "신"], ["병", "임"], ["정", "계"],
];

function pairMatches(pairs: readonly [string, string][], a: string, b: string): boolean {
  return pairs.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

function isJijiHyeong(a: string, b: string): boolean {
  if (a === b) return JAHYEONG.has(a); // 자형
  if ((a === "자" && b === "묘") || (a === "묘" && b === "자")) return true; // 자묘 상형
  return SAMHYEONG_GROUPS.some((g) => g.includes(a) && g.includes(b));
}

function isSamhapPartial(a: string, b: string): boolean {
  if (a === b) return false;
  return SAMHAP_GROUPS.some((g) => g.includes(a) && g.includes(b));
}

/** 두 지지 사이의 합/충/파/형 관계(복수 가능 — 예: 같은 쌍이 합이자 파일 수 있음). */
export function findJijiRelations(a: string, b: string): RelationType[] {
  const rels: RelationType[] = [];
  if (pairMatches(JIJI_HAP, a, b)) rels.push("합");
  if (pairMatches(JIJI_CHUNG, a, b)) rels.push("충");
  if (pairMatches(JIJI_PA, a, b)) rels.push("파");
  if (isJijiHyeong(a, b)) rels.push("형");
  return rels;
}

/** findJijiRelations + 삼합(반합)·해(육해) — 커플 궁합 관계도 전용. */
export function findJijiRelationsExtended(a: string, b: string): ExtendedRelationType[] {
  const rels: ExtendedRelationType[] = [...findJijiRelations(a, b)];
  if (isSamhapPartial(a, b)) rels.push("삼합");
  if (pairMatches(JIJI_HAE, a, b)) rels.push("해");
  return rels;
}

/** 두 천간 사이의 합/충 관계(무기는 충 없음 — 둘 다 중앙 토). */
export function findCheonganRelations(a: string, b: string): ("합" | "충")[] {
  const rels: ("합" | "충")[] = [];
  if (pairMatches(CHEONGAN_HAP, a, b)) rels.push("합");
  if (pairMatches(CHEONGAN_CHUNG, a, b)) rels.push("충");
  return rels;
}
