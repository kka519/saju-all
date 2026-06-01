-- =====================================================
-- 0006_add_full_analysis.sql
-- =====================================================
-- saju_results 에 만세력 풀 분석(full_analysis) 컬럼 추가.
-- luckyloveme API 의 16종 풀 분석(ganji / sipseong / sinStrength / gyeokguk /
-- twelveFortune / daeun / seun / weolun / guiin / hongyeom / dohwa / hwagae /
-- sibisinsals / bigyeonGeobjae / hapchung / gyeokgukYongsin) 응답 raw json 그대로 저장.
-- 결과 페이지 명식 화면(MyeongsikTable 등)에서 십성·신살·대운·세운 등을
-- 보여주기 위해 필요. 현재는 LLM 프롬프트로 가공 후 사라져서 페이지에 미도달.
-- 구조는 src/lib/saju/saju-api.ts 의 SajuAnalysisResponse 타입.

alter table public.saju_results
  add column full_analysis jsonb;
