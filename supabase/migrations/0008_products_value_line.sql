-- =====================================================
-- 0008_products_value_line.sql
-- =====================================================
-- products 상품 카드 한 줄 가치 표기 컬럼 추가 (예: "16종 풀 분석 기반 심층 풀이").

alter table public.products
  add column value_line text;
