-- =====================================================
-- 0005_add_astrolabe_column.sql
-- =====================================================
-- saju_results 에 자미두수 명반(astrolabe) 컬럼 추가.
-- 자미두수 적용 상품(love-saju / couple-match / love-consulting / premium-saju)
-- 에만 채워지며, 그 외 5개 상품 결과에는 astrolabe = NULL 유지.
-- 구조는 src/lib/saju/ziwei.ts 의 ZiweiSummary 타입 (extractZiweiSummary 반환형).

alter table public.saju_results
  add column astrolabe jsonb;
