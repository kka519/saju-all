-- =====================================================
-- 0007_life_analyst_report.sql
-- =====================================================
-- "인생 애널리스트 리포트" 상품 지원:
--   1) products 에 할인가 표시용 컬럼 추가 (재사용 가능 — 다른 프로모션에도 사용).
--   2) 리포트 생성 상태를 추적하는 신규 테이블. saju_results.interpretation_md
--      (단일 마크다운) 로는 20페이지 구조화 리포트를 담을 수 없어 별도 테이블로 분리.
--      LLM 4파트 호출 + PDF 렌더링까지 1~3분 걸리는 비동기 파이프라인이라
--      status/stage/progress_pct 로 폴링 지원, 재시도 시 이미 생성된 파트는
--      sections_part* 에 캐시해 재사용(LLM 비용 중복 방지).

-- ─── products: 할인 표시 컬럼 ────────────────────────
alter table public.products
  add column original_price integer check (original_price >= 0),
  add column badge_label text;

-- ─── life_analyst_reports ────────────────────────────
create type public.report_status as enum ('pending', 'generating', 'done', 'failed');

create table public.life_analyst_reports (
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
  pdf_path text,
  pdf_page_count smallint,
  attempt_count smallint not null default 0,
  error_message text,
  llm_provider text,
  llm_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index life_analyst_reports_order_idx on public.life_analyst_reports(order_id);
create index life_analyst_reports_status_idx on public.life_analyst_reports(status);

alter table public.life_analyst_reports enable row level security;

create policy "life_analyst_reports via own order"
  on public.life_analyst_reports for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = life_analyst_reports.order_id and o.user_id = auth.uid()
    )
  );

-- guest 주문은 saju_results/saju_inputs 와 동일 관례 — 서버 route handler 가
-- service_role + order_id 매칭으로 status/download 처리 (RLS 우회, 클라이언트 직접 접근 없음).
