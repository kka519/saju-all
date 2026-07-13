// =====================================================
// 용어 규칙 + 분량 하한 검증 게이트
// =====================================================
// system.ts [용어 3티어]의 기계 검증 축. build-sections.callWithRetry 가
// parse 성공 후 이 검증을 돌려 위반 시 해당 파트만 재생성한다 (환각 게이트와 동일 방식).
//
// 검사 대상은 "산문 필드"만 — 표 셀(신살 공시 표 등)은 원어 허용이라 제외.
// ⚠️ system.ts 의 티어 목록을 바꾸면 여기 상수도 함께 갱신할 것.

/** 티어 2 — 번역 우선. 파트 내 허용 등장 횟수: 병기 1회 + 여유 1회 = 최대 2회. */
const TRANSLATE_FIRST_TERMS = [
  "식신",
  "상관",
  "정재",
  "편재",
  "정관",
  "편관",
  "정인",
  "편인",
  "비견",
  "겁재",
  "세운",
  "월운",
  "용신",
  "희신",
  "기신",
  "신강",
  "신약",
] as const;

/** 티어 3 — 본문 사용 금지 (표·명식표 전용). */
const FORBIDDEN_TERMS = [
  "지장간",
  "공망",
  "재다신약",
  // 12운성 명칭 — 단독 글자(병/태/쇠 등)는 오탐이 많아 "OO지/OO운성" 결합형과 대표 명칭만
  "장생",
  "건록",
  "제왕",
  "목욕",
  "관대",
  "12운성",
  "십이운성",
  // 신살 원어
  "백호살",
  "원진",
  "역마",
  "도화",
  "화개",
  "귀문",
  "홍염",
  "반안살",
  "장성살",
  "겁살",
  "망신살",
  "지살",
  "현침",
  "고란살",
  "금여",
  "암록",
  // 고급 관법 용어
  "병약",
  "약신",
  "구신",
  "통관",
  "파극",
  "재극인",
  "식신생재",
  "설기",
  "투출",
  "득령",
  "득지",
  "득세",
  "방합",
  "반합",
  "삼합",
  "육합",
  "지지충",
  "간여지동",
  "사화비입",
] as const;

const CJK_IDEOGRAPH_RE = /[一-鿿㐀-䶿]/;

// 실측 튜닝: 2회는 사주의 핵심 주제어(예: 신약 사주에서 "신약")가 자연스럽게 3~4회
// 나오는 경우와 충돌해 재시도가 수렴하지 못함. 3회면 남발(기존 용신 31회)은 여전히 차단.
const MAX_TRANSLATE_FIRST_OCCURRENCES = 3;

function countOccurrences(text: string, term: string): number {
  let count = 0;
  let idx = text.indexOf(term);
  while (idx !== -1) {
    count++;
    idx = text.indexOf(term, idx + term.length);
  }
  return count;
}

/**
 * 산문 텍스트(파트의 산문 필드 연결본)에 대한 용어 규칙 검사.
 * @returns 위반 사유 배열 (빈 배열 = 통과)
 */
export function checkTermRules(proseText: string): string[] {
  const issues: string[] = [];

  for (const term of FORBIDDEN_TERMS) {
    const n = countOccurrences(proseText, term);
    if (n > 0) {
      issues.push(`금지 용어 "${term}" 이(가) 본문에 ${n}회 등장 — 쉬운 말로 풀어써야 함`);
    }
  }

  // 티어2 카운트는 괄호 병기("신용·규율(정관)")를 제외 — 병기는 규칙상 허용된 표기라
  // 괄호 그룹을 벗겨낸 뒤 "지문에 원어가 노출된" 경우만 센다.
  const outsideParens = proseText.replace(/\([^)]*\)/g, "");
  for (const term of TRANSLATE_FIRST_TERMS) {
    const n = countOccurrences(outsideParens, term);
    if (n > MAX_TRANSLATE_FIRST_OCCURRENCES) {
      issues.push(
        `번역 우선 용어 "${term}" 이(가) 괄호 병기 외 지문에 ${n}회 등장 (허용 ${MAX_TRANSLATE_FIRST_OCCURRENCES}회) — 원어는 "번역어(${term})" 괄호 병기로만 쓰고 지문에서는 번역어를 사용`,
      );
    }
  }

  if (CJK_IDEOGRAPH_RE.test(proseText)) {
    const sample = proseText.match(/[一-鿿㐀-䶿]{1,6}/)?.[0] ?? "";
    issues.push(`본문에 한자 "${sample}" 등장 — 본문은 한글만, 한자는 명식표/차트 전용`);
  }

  return issues;
}

/** 필드별 분량 범위. min 미기재 시 max의 80%. */
export type FieldRange = { min?: number; max: number };
export type FieldRanges = Record<string, FieldRange>;

/**
 * 분량 하한 검사. fields 는 {필드명: 문자열 또는 문자열배열} — 배열은 각 원소 검사.
 * @returns 위반 사유 배열
 */
export function checkMinLengths(
  fields: Record<string, string | string[]>,
  ranges: FieldRanges,
): string[] {
  const issues: string[] = [];
  for (const [name, range] of Object.entries(ranges)) {
    const min = range.min ?? Math.floor(range.max * 0.8);
    const value = fields[name];
    if (value === undefined) continue;
    const items = Array.isArray(value) ? value : [value];
    items.forEach((item, i) => {
      if (item.length < min) {
        const label = Array.isArray(value) ? `${name}[${i}]` : name;
        issues.push(`필드 ${label} 분량 미달: ${item.length}자 (최소 ${min}자) — 더 구체적으로 서술 필요`);
      }
    });
  }
  return issues;
}
