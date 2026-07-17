// =====================================================
// 용어 규칙 + 분량 하한 검증 게이트
// =====================================================
// system.ts [용어 3티어]의 기계 검증 축. build-sections.callWithRetry 가
// parse 성공 후 이 검증을 돌려 위반 시 해당 파트만 재생성한다 (환각 게이트와 동일 방식).
//
// 검사 대상은 "산문 필드"만 — 표 셀(신살 공시 표 등)은 원어 허용이라 제외.
// ⚠️ system.ts 의 티어 목록을 바꾸면 여기 상수도 함께 갱신할 것.

/** 티어 2 — 번역 우선. 파트 내 허용 등장 횟수: 병기 1회 + 여유 1회 = 최대 2회. */
export const TRANSLATE_FIRST_TERMS = [
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
export const FORBIDDEN_TERMS = [
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
  // "화개살"을 "화개"보다 먼저 매칭시켜야 함 — 순서가 반대면 "화개"만 치환되고
  // "살"이 남아 "예술적 감수성살" 같은 어색한 합성어가 생긴다(2026-07-15 실측).
  "화개살",
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
  // 귀인 16종 — 커플 궁합 리포트 draft 검토에서 다수 노출 확인(2026-07-15,
  // 지시문_궁합PB수정6건). 표(명식표/신살 공시)에서만 허용, 본문 금지.
  "천을귀인",
  "태극귀인",
  "학당귀인",
  "문곡귀인",
  "천덕귀인",
  "월덕귀인",
  "문창귀인",
  "천주귀인",
  "복성귀인",
  "재고귀인",
  "관귀학관",
  "낙정관살",
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

// ─────────────────────────────────────────────────────
// 조사 보정 — 용어 치환 시 "반안살이"→"안정적인 자리이"처럼 받침 유무가 바뀌어
// 조사가 어색해지는 문제(2026-07-15 궁합 리포트 검토에서 실측 확인) 방지.
// ─────────────────────────────────────────────────────

/** 완성형 한글 음절의 종성(받침) 유무. 한글 완성형이 아니면(숫자·영문 등) 보수적으로
 *  받침 있음으로 간주해 "이/은/을" 계열을 유지한다. */
export function hasBatchim(text: string): boolean {
  const ch = text.trimEnd().slice(-1);
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return true;
  return (code - 0xac00) % 28 !== 0;
}

const PARTICLE_PAIRS: readonly [string, string][] = [
  ["이", "가"],
  ["은", "는"],
  ["을", "를"],
  ["과", "와"],
];

/** term 을 replacement 로 치환하되, 바로 뒤에 오는 조사(이/가·은/는·을/를·과/와)를
 *  replacement의 받침 유무에 맞게 다시 고른다. */
function replaceTermFixParticle(text: string, term: string, replacement: string): string {
  if (!text.includes(term)) return text;
  let result = "";
  let i = 0;
  const withBatchim = hasBatchim(replacement);
  while (i < text.length) {
    if (text.startsWith(term, i)) {
      result += replacement;
      i += term.length;
      for (const [withB, withoutB] of PARTICLE_PAIRS) {
        if (text.startsWith(withB, i)) {
          result += withBatchim ? withB : withoutB;
          i += withB.length;
          break;
        }
        if (text.startsWith(withoutB, i)) {
          result += withBatchim ? withB : withoutB;
          i += withoutB.length;
          break;
        }
      }
    } else {
      result += text[i];
      i++;
    }
  }
  return result;
}

/** 한자 제거 후 "갑기()"처럼 내용물이 통째로 사라져 빈 껍데기만 남은 괄호(및 그 앞
 *  공백)를 정리. 원문이 "용어(한자)" 자기주석 패턴을 쓸 때 발생(2026-07-15 실측). */
function stripEmptyParens(text: string): string {
  return text.replace(/\s?\([\s,·]*\)/g, "");
}

/** "귀한 도움을 부르는 기운(귀한 도움을 부르는 기운)"처럼 "원어(번역어)" 자기주석을
 *  쓴 문장에서 TIER3가 원어까지 치환해버려 괄호 앞뒤가 완전히 같은 말로 중복되는
 *  경우를 정리(화개살 이어붙음 버그와 같은 계열 — 2026-07-16 실측). 괄호 앞 구간과
 *  괄호 안 내용이 정확히 같으면 괄호를 통째로 제거. */
function dedupSelfGlossParens(text: string): string {
  return text.replace(/([^()\n.!?]+)\(\1\)/g, "$1");
}

function countOccurrences(text: string, term: string): number {
  let count = 0;
  let idx = text.indexOf(term);
  while (idx !== -1) {
    count++;
    idx = text.indexOf(term, idx + term.length);
  }
  return count;
}

// ─────────────────────────────────────────────────────
// 자동 치환 사전 — 용어 위반은 재생성하지 않고 이 사전으로 즉시 교정한다.
// (재생성은 JSON 파싱 실패 등 구조적 위반에만 남겨둔다.)
// ─────────────────────────────────────────────────────

/** 티어2 — 허용 횟수 초과분을 대체할 번역어 (fixed-sections.ts TERM_TRANSLATION_ROWS 와 동일 어휘). */
const TIER2_TRANSLATIONS: Record<string, string> = {
  식신: "생산 엔진",
  상관: "혁신 엔진",
  정재: "고정수익",
  편재: "변동수익",
  정관: "신용·규율",
  편관: "압박·구조조정",
  정인: "무형자산",
  편인: "특수자산",
  비견: "자기지분",
  겁재: "자기지분",
  세운: "연간 시황",
  월운: "월간 시황",
  용신: "핵심 성장동력",
  희신: "우군 섹터",
  기신: "과열 리스크 섹터",
  신강: "자본 체력",
  신약: "자본 체력",
};

/** 티어3 — 본문 절대 금지어. 등장 즉시 무조건 치환(허용 횟수 없음). */
const TIER3_REPLACEMENTS: Record<string, string> = {
  지장간: "내면에 숨은 기운",
  공망: "기운이 비어 있는 자리",
  재다신약: "부담이 체력을 넘어서는 구조",
  장생: "기운이 태동하는 단계",
  건록: "기운이 무르익은 단계",
  제왕: "기운이 절정인 단계",
  목욕: "기운이 불안정한 단계",
  관대: "기운이 자리 잡는 단계",
  "12운성": "기운의 성장 단계",
  십이운성: "기운의 성장 단계",
  백호살: "돌발 변수",
  원진: "어긋나는 궁합",
  역마: "이동·변화 기질",
  도화: "매력·인기 기질",
  화개살: "예술적 감수성",
  화개: "예술적 감수성",
  귀문: "예민한 감각",
  홍염: "매력 기질",
  반안살: "안정적인 자리",
  장성살: "주도권을 쥐는 기질",
  겁살: "급변 리스크",
  망신살: "평판 리스크",
  지살: "이동이 잦은 기질",
  현침: "예리한 기질",
  고란살: "고독한 구조",
  금여: "전략적 조력",
  암록: "숨은 조력",
  천을귀인: "귀한 도움을 부르는 기운",
  태극귀인: "근본이 단단한 기운",
  학당귀인: "총명함을 부르는 기운",
  문곡귀인: "글재주를 부르는 기운",
  천덕귀인: "위기를 막아주는 기운",
  월덕귀인: "위기를 막아주는 기운",
  문창귀인: "표현력을 부르는 기운",
  천주귀인: "생활의 안정을 부르는 기운",
  복성귀인: "복을 부르는 기운",
  재고귀인: "재물을 모으는 기운",
  관귀학관: "명예·직위를 부르는 기운",
  낙정관살: "방심 시 낭패를 부르는 기운",
  병약: "구조적 부담",
  약신: "보완 처방 기운",
  구신: "부담을 키우는 기운",
  통관: "가교 역할",
  파극: "깎아먹음",
  재극인: "수익이 자산을 깎는 구조",
  식신생재: "생산이 수익을 낳는 흐름",
  설기: "기운이 빠져나감",
  투출: "기운이 겉으로 드러남",
  득령: "기반이 튼튼함",
  득지: "뿌리가 튼튼함",
  득세: "세력이 강함",
  방합: "기운의 결합",
  반합: "기운의 결합",
  삼합: "기운의 결합",
  육합: "기운의 결합",
  지지충: "기운의 충돌",
  간여지동: "자기 주도적 기질",
  사화비입: "기운이 스며듦",
};

/** 괄호 병기 구간은 건너뛰고, 허용 횟수(allowed)를 초과하는 등장분만 replacement 로 치환. */
function replaceOverflowOutsideParens(
  text: string,
  term: string,
  allowed: number,
  replacement: string,
): string {
  let count = 0;
  let result = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] === "(") {
      const close = text.indexOf(")", i);
      const end = close === -1 ? text.length : close + 1;
      result += text.slice(i, end);
      i = end;
      continue;
    }
    if (text.startsWith(term, i)) {
      count++;
      if (count <= allowed) {
        result += term;
        i += term.length;
      } else {
        result += replacement;
        i += term.length;
        const withBatchim = hasBatchim(replacement);
        for (const [withB, withoutB] of PARTICLE_PAIRS) {
          if (text.startsWith(withB, i)) {
            result += withBatchim ? withB : withoutB;
            i += withB.length;
            break;
          }
          if (text.startsWith(withoutB, i)) {
            result += withBatchim ? withB : withoutB;
            i += withoutB.length;
            break;
          }
        }
      }
    } else {
      result += text[i];
      i++;
    }
  }
  return result;
}

/**
 * 산문 한 필드에 대한 자동 치환. 재생성 없이 즉시 규칙을 통과시키기 위한 후처리.
 * @returns 치환된 텍스트 + 치환된 용어 목록(로그용)
 */
export function sanitizeProse(text: string): { text: string; replaced: string[] } {
  let result = text;
  const replaced: string[] = [];

  // 티어3: 등장 즉시 무조건 치환 (조사 보정 포함)
  for (const term of FORBIDDEN_TERMS) {
    if (result.includes(term)) {
      result = replaceTermFixParticle(result, term, TIER3_REPLACEMENTS[term] ?? "해당 기운");
      replaced.push(term);
    }
  }

  // 티어2: 허용 횟수(괄호 병기 제외) 초과분만 치환
  for (const term of TRANSLATE_FIRST_TERMS) {
    const next = replaceOverflowOutsideParens(
      result,
      term,
      MAX_TRANSLATE_FIRST_OCCURRENCES,
      TIER2_TRANSLATIONS[term] ?? term,
    );
    if (next !== result) replaced.push(term);
    result = next;
  }

  // 한자 — 본문은 한글만. 안전하게 전부 제거(명식표/차트는 별도 경로라 영향 없음).
  if (CJK_IDEOGRAPH_RE.test(result)) {
    result = result.replace(new RegExp(CJK_IDEOGRAPH_RE.source, "g"), "");
    replaced.push("한자");
  }

  // "용어(한자)" 자기주석 패턴에서 한자만 제거되고 빈 괄호가 남는 경우 정리.
  result = stripEmptyParens(result);
  // TIER3 치환이 "원어(번역어)" 자기주석의 원어까지 바꿔버려 괄호 앞뒤가 같은 말로
  // 중복되는 경우 정리("귀한 도움을 부르는 기운(귀한 도움을 부르는 기운)" 등).
  result = dedupSelfGlossParens(result);

  return { text: result, replaced };
}

/**
 * 섹션 객체의 지정된 산문 필드(string | string[])들에 sanitizeProse 를 일괄 적용.
 * 표 셀 필드는 원어 허용이므로 이 함수의 대상에 포함시키지 않는다.
 */
export function sanitizeProseFields<T extends Record<string, unknown>>(
  sections: T,
  proseKeys: readonly (keyof T & string)[],
): { sections: T; replaced: string[] } {
  const replaced: string[] = [];
  const out: Record<string, unknown> = { ...sections };
  for (const key of proseKeys) {
    const val = (sections as Record<string, unknown>)[key];
    if (typeof val === "string") {
      const r = sanitizeProse(val);
      out[key] = r.text;
      if (r.replaced.length) replaced.push(...r.replaced.map((t) => `${key}:${t}`));
    } else if (Array.isArray(val)) {
      out[key] = val.map((item) => {
        if (typeof item !== "string") return item;
        const r = sanitizeProse(item);
        if (r.replaced.length) replaced.push(...r.replaced.map((t) => `${key}:${t}`));
        return r.text;
      });
    }
  }
  return { sections: out as T, replaced };
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

/** 필드별 분량 범위. min 미기재 시 max의 70%. */
export type FieldRange = { min?: number; max: number };
export type FieldRanges = Record<string, FieldRange>;

/**
 * 분량 하한 검사. fields 는 {필드명: 문자열 또는 문자열배열} — 배열은 각 원소 검사.
 * 게이트 판정에는 -5% 허용 오차를 둔다 — 근소 미달로 재시도를 낭비하지 않기 위함.
 * @returns 위반 사유 배열
 */
export function checkMinLengths(
  fields: Record<string, string | string[]>,
  ranges: FieldRanges,
): string[] {
  const issues: string[] = [];
  for (const [name, range] of Object.entries(ranges)) {
    const min = range.min ?? Math.floor(range.max * 0.7);
    const threshold = Math.floor(min * 0.95);
    const value = fields[name];
    if (value === undefined) continue;
    const items = Array.isArray(value) ? value : [value];
    items.forEach((item, i) => {
      if (item.length < threshold) {
        const label = Array.isArray(value) ? `${name}[${i}]` : name;
        issues.push(
          `필드 ${label} 분량 미달: ${item.length}자 (목표 ${min}자, 허용하한 ${threshold}자) — 입력 JSON의 수치·간지 근거를 더 인용해 구체적으로 서술 필요`,
        );
      }
    });
  }
  return issues;
}
