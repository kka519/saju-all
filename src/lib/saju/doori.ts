// =====================================================
// 두리 캐릭터 매핑 (PRD §2.3)
// =====================================================
// 결과지 5섹션 + 회원가입 퍼널 5단계 + 빈 페이지/FAQ/404 등에서 재사용.
//
// 사이즈 정책 (헤더 사건/2-B 카드 검증 교훈):
// - 64~96px 카드/아바타 사이즈: 솔리드 PNG (흰 배경 유지 → 카와이 칩 형태)
// - 220px+ Hero 사이즈: alpha-keyed 가능한 컷은 다크 위에 떠 보이게 사용
// 현재 alpha-keyed: doori-magic.png 뿐 (Hero 전용). 나머지는 모두 솔리드.

export type DooriCut =
  | "magic"      // 별빛 오라 — 환영/메인
  | "curious"    // 물음표 — 회원가입/빈 페이지/FAQ/404
  | "love"       // 하트눈 — 연애/좋은 운
  | "saju"       // 사주 카드 — 명식/사주 메인
  | "writing"    // 편지 — 풀이 작성/조언
  | "sleeping"   // 구름 자기 — 마무리/밤 인사
  | "sad";       // 눈물 — 안 좋은 운/에러

export type ResultSection =
  | "greeting"
  | "saju"
  | "coreReading"
  | "advice"
  | "closing";

/** 카드 헤더 등 작은 사이즈용 — 솔리드 PNG 경로. 흰 배경이 다크 카드 안에서 칩 형태로 자연스럽게 보임. */
export function dooriCardSrc(cut: DooriCut): string {
  // magic은 Hero용으로 alpha-keyed 상태라, 카드용 솔리드 백업 사용.
  if (cut === "magic") return "/characters/doori/doori-magic-solid.png";
  return `/characters/doori/doori-${cut}.png`;
}

/** Hero 등 큰 사이즈(220px+)용 — 가능하면 alpha-keyed (다크 배경에 떠 보이게). */
export function dooriHeroSrc(cut: DooriCut): string {
  // 현재 magic만 alpha 키잉됨. 다른 컷은 솔리드 fallback.
  if (cut === "magic") return "/characters/doori/doori-magic.png";
  return `/characters/doori/doori-${cut}.png`;
}

/** 결과지 섹션 → 두리 컷 (PRD §2.3 매핑 + 슬러그 분기). */
export function getResultDoori(section: ResultSection, slug?: string): DooriCut {
  switch (section) {
    case "greeting":    return "magic";
    case "saju":        return "curious";
    case "coreReading": return slug === "love-saju" ? "love" : "saju";
    case "advice":      return "writing";
    case "closing":     return "sleeping";
  }
}
