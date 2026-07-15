-- =====================================================
-- 0010_couple_partner_input.sql
-- =====================================================
-- couple-match(궁합 사주)는 두 사람의 명식을 비교하는 상품인데 상대방 입력
-- 필드가 없어 한 명 데이터만으로 "가짜 궁합"이 생성되던 결함 수정.
-- 상대는 정확히 1명, 조회는 항상 order 단위 1:1이라 별도 테이블 대신
-- saju_inputs/saju_results에 컬럼을 확장한다(RLS·조인 복잡도 회피).
-- couple-match 외 상품은 이 컬럼들이 전부 null.

alter table public.saju_inputs
  add column partner_name text,
  add column partner_birth_date date,
  add column partner_birth_time time,
  add column partner_time_unknown boolean,
  add column partner_gender public.gender_kind,
  add column partner_calendar public.calendar_kind;

-- 상대방 raw 분석(luckyloveme)도 본인과 동일하게 무조건 DB에 남긴다.
alter table public.saju_results
  add column partner_full_analysis jsonb,
  add column partner_myeongsik jsonb;
