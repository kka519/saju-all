-- =====================================================
-- 0009_today_fortune_json.sql
-- =====================================================
-- today-fortune 전용 6블록 구조화 결과 저장 컬럼. interpretation_md(자유 마크다운)는
-- 계속 채워지지만(감사/폴백용), 결과 페이지의 "오늘의 날씨 카드"는 이 컬럼을 쓴다.

alter table public.saju_results
  add column today_fortune jsonb;
