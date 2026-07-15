-- =====================================================
-- 0012_couple_reports.sql
-- =====================================================
-- "커플 궁합 리포트"(couple-match, 20페이지 PDF) 개편 — 채팅형 700~900자 결과에서
-- LUNA LIFE RESEARCH "합병 리서치" 컨셉의 20페이지 PDF로 전면 개편(기획_궁합리포트_
-- 합병리서치_20260715.md). life_analyst_reports 와 동일한 비동기 파이프라인 계약
-- (status/stage/progress_pct 폴링, 재시도 시 sections_part* 캐시)을 그대로 따르되,
-- 콘텐츠 구조(파트 5개, 상대방 데이터)가 달라 별도 테이블로 분리한다 — 두 상품을
-- 한 테이블에 욱여넣으면 필드 절반이 항상 null인 채로 늘어나기만 함.
-- report_status enum 은 0007에서 이미 만들어졌으므로 재사용.

create table public.couple_reports (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  status public.report_status not null default 'pending',
  stage text,
  progress_pct smallint not null default 0,
  report_json jsonb,
  sections_part1 jsonb,
  sections_part2 jsonb,
  sections_part3 jsonb,
  sections_part4 jsonb,
  sections_part5 jsonb,
  pdf_path text,
  pdf_page_count smallint,
  attempt_count smallint not null default 0,
  error_message text,
  llm_provider text,
  llm_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index couple_reports_order_idx on public.couple_reports(order_id);
create index couple_reports_status_idx on public.couple_reports(status);

alter table public.couple_reports enable row level security;

create policy "couple_reports via own order"
  on public.couple_reports for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = couple_reports.order_id and o.user_id = auth.uid()
    )
  );

-- guest 주문은 life_analyst_reports 와 동일 관례 — 서버 route handler 가
-- service_role + order_id 매칭으로 status/download 처리 (RLS 우회, 클라이언트 직접 접근 없음).
