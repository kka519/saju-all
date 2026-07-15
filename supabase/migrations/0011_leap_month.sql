alter table public.saju_inputs
  add column is_leap_month boolean not null default false,
  add column partner_is_leap_month boolean;
