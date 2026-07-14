// =====================================================
// 상품 진열 섹션 구분 — 랜딩(ProductLineup)·상품(products/page) 공용
// =====================================================
// 섹션 자체는 DB 컬럼이 아니라 slug 매핑으로 코드에서만 관리 (활성 상품 5개
// 규모에서는 스키마 추가보다 이 편이 단순함).

export type ProductSection = { title: string; slugs: string[] };

export const PRODUCT_SECTIONS: ProductSection[] = [
  { title: "오늘의 운세", slugs: ["today-fortune"] },
  { title: "LUNA LIFE RESEARCH — 인생 리포트", slugs: ["life-analyst-report"] },
  { title: "두리의 연애 풀이", slugs: ["love-saju", "couple-match", "love-consulting"] },
];
