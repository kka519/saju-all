-- =====================================================
-- 무료 운세 잠금 티저 — 실컨텐츠 DB 저장 + 원가 관측 로그
-- =====================================================
-- 지시문_무료운세_잠금티저_20260721.md §①⑤:
--   ① 무료 화면은 8블록 중 절반만 공개, 잠금 블록은 서버가 더미로 치환해
--      내려보낸다 — 실제 생성 텍스트는 응답 바디에 절대 담지 않고 DB에만 남긴다.
--   ⑤ 생성 1건당 실제 LLM 호출 횟수(재시도 포함)를 관측 가능하게 기록한다.
--
-- free_fortune_usage 는 성공 생성 1건당 1행(day, identity_key 유니크)이라
-- 이 요구사항 둘을 같은 행에 자연스럽게 합칠 수 있다.

alter table public.free_fortune_usage
  add column if not exists sections jsonb,
  add column if not exists attempt_count integer,
  add column if not exists provider text,
  add column if not exists model text;
