-- =====================================================
-- 무료 운세 하루 1회 제한 + 로그인 사용자 생년월일 재사용
-- =====================================================
-- 지시문(2026-07-17, 사장님 확정) §①②③:
--   ① /api/saju/free-fortune 하루 1회 제한 — 로그인은 계정, 비로그인은 IP+쿠키, KST 자정 리셋
--   ② 로그인 사용자는 저장된 생년월일 재사용(재입력 불필요)
--   ③ IP 기준 별도 상한(하루 5회) — 시크릿창·다계정 우회 방어

-- ─── profiles — 로그인 사용자의 "내 생년월일" 저장(②) ──────────
-- saju_inputs 는 order_id NOT NULL UNIQUE(주문 전용)라 재사용 불가 — 계정에 직접 저장.
-- 타입은 saju_inputs 와 동일 컨벤션(date/time/calendar_kind/gender_kind) 재사용.
alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists birth_time time,
  add column if not exists time_unknown boolean not null default false,
  add column if not exists gender public.gender_kind,
  add column if not exists calendar public.calendar_kind,
  add column if not exists is_leap_month boolean not null default false;

-- ─── free_fortune_usage — 사용 기록(①③ 공용) ──────────────────
-- 성공 생성 1건당 1행. identity_key = "user:<uuid>"(로그인) 또는 "cookie:<uuid>"(비로그인).
-- day는 KST 기준 날짜 문자열(YYYY-MM-DD, 서버가 Asia/Seoul로 계산해 넣음).
create table public.free_fortune_usage (
  id uuid primary key default gen_random_uuid(),
  day date not null,
  identity_key text not null,
  ip text,
  created_at timestamptz not null default now(),
  unique (day, identity_key)
);

create index free_fortune_usage_day_ip_idx on public.free_fortune_usage(day, ip);

-- service_role(서버 route handler)에서만 읽고 쓴다 — 클라이언트 직접 접근 불필요.
alter table public.free_fortune_usage enable row level security;
