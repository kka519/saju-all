// =====================================================
// 상품 시드 (scripts/seed-products.ts 에서 사용)
// =====================================================
// 가격대만 다른 단순 라인업. 수강생은 자유롭게 추가/수정 후
// pnpm seed:products 로 DB에 반영합니다.

export type ProductSeed = {
  slug: string;
  name: string;
  description: string;
  price: number;
  display_order: number;
  is_active: boolean;
};

export const productsSeed: ProductSeed[] = [
  {
    slug: "today-fortune",
    name: "오늘의 운세",
    description: "오늘 하루 흐름을 두리가 한 줄로 짚어드려요. 매일 가볍게 만나봐요.",
    price: 880,
    display_order: 10,
    is_active: true,
  },
  {
    slug: "love-style",
    name: "연애 스타일 분석",
    description: "내 십성과 신강신약으로 풀어보는 연애 스타일. 어떻게 사랑하는 사람인지 알려드려요.",
    price: 2640,
    display_order: 20,
    is_active: true,
  },
  {
    slug: "solo-fate",
    name: "솔로의 인연운",
    description: "홍염살·도화살과 대운으로 보는 인연이 들어오는 시기. 솔로라면 꼭 봐주세요.",
    price: 3520,
    display_order: 30,
    is_active: true,
  },
  {
    slug: "crush",
    name: "짝사랑 가능성",
    description: "내 사주와 그 사람 사주의 합·충으로 짝사랑이 이어질 가능성을 짚어드려요.",
    price: 3520,
    display_order: 40,
    is_active: true,
  },
  {
    slug: "love-saju",
    name: "연애 사주",
    description: "16종 풀 분석으로 내 연애 성향과 잘 맞는 사람 유형을 깊이 있게 풀어드려요.",
    price: 3900,
    display_order: 50,
    is_active: true,
  },
  {
    slug: "couple-match",
    name: "커플 궁합",
    description: "본인과 상대 두 사람 사주를 모두 입력하면, 합충 비교로 궁합을 자세히 알려드려요.",
    price: 6160,
    display_order: 60,
    is_active: true,
  },
  {
    slug: "basic-saju",
    name: "기본 사주",
    description: "천간지지·십성·격국까지 종합 정리. 내 삶의 큰 흐름을 한눈에 보여드려요.",
    price: 6600,
    display_order: 70,
    is_active: true,
  },
  {
    slug: "love-consulting",
    name: "연애 컨설팅+사주 (메인)",
    description: "사주 기반 연애 운에 행동 조언까지 통합. 두리가 가장 정성껏 풀어드리는 메인 상품이에요.",
    price: 26400,
    display_order: 80,
    is_active: true,
  },
  {
    slug: "premium-saju",
    name: "평생 사주",
    description: "격국용신까지 포함한 평생 심층 풀이. 인생 전체를 한 권으로 정리해드려요.",
    price: 30800,
    display_order: 90,
    is_active: true,
  },
];
