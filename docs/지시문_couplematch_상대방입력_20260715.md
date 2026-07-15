# 지시문 — couple-match 상대방 입력 결함 수정 (2026-07-15)

## 배경 (왜)

couple-match(궁합 사주, 19,900원)는 두 사람의 명식을 비교하는 상품인데, 현재:

- `SajuForm.tsx`에 상대방 입력 필드가 없음 — 한 명 정보만 받음
- `prompt.ts` couple-match focus에 "두 명식의 합충 비교(있다면 활용)" 헤지 문구 → LLM이 한 명 사주만으로 궁합을 지어냄
- 결과: 상대방 없이 생성된 가짜 궁합이 19,900원에 팔리는 신뢰 결함

**원칙: 상대방 데이터 없이 couple-match 결과 생성은 어떤 경로로도 불가능해야 한다(폼 검증 + 서버 검증 + 프롬프트 게이트 3중).**

## 현재 구조 (확인 완료, 2026-07-15 기준 HEAD adc76c9)

- 폼: `src/components/saju/SajuForm.tsx` (단일 인물)
- 주문 생성: `src/app/api/orders/create/route.ts` → `saju_inputs` 1행 insert
- 결제 확인·생성: `src/app/api/orders/confirm/route.ts` → `fetchSajuAnalysis` 1회 → `buildSajuPrompt` → `saju_results`
- 데모 경로: `src/app/api/saju/interpret/route.ts` (birthInfo 1개만 받음)
- 결과: `src/app/results/[resultId]/page.tsx`
- 스키마: `saju_inputs`(0001), partner 컬럼 없음

## 작업 항목

### 1. DB 마이그레이션 (신규 `0010_couple_partner_input.sql`)

`saju_inputs`에 nullable 컬럼 추가 (couple-match 외 상품은 전부 null):

```sql
alter table public.saju_inputs
  add column partner_name text,
  add column partner_birth_date date,
  add column partner_birth_time time,
  add column partner_time_unknown boolean,
  add column partner_gender public.gender_kind,
  add column partner_calendar public.calendar_kind;
```

별도 테이블 대신 컬럼 확장인 이유: 상대는 정확히 1명, 조회는 항상 order 단위 1:1, RLS·조인 복잡도 증가 회피.

`saju_results.full_analysis`(0006)와 별개로 **상대방 raw 분석 저장 컬럼도 추가**:

```sql
alter table public.saju_results
  add column partner_full_analysis jsonb,
  add column partner_myeongsik jsonb;
```

(인수인계 §5 구조 리스크 원칙과 동일 — luckyloveme raw는 무조건 DB에 남긴다.)

### 2. 폼 — `SajuForm.tsx`

- prop `requiresPartner: boolean` 추가. 상품 페이지에서 `slug === "couple-match"`로 전달 (하드코딩 대신 `product-sections.ts`나 상품 설정에 플래그를 두는 것도 가능 — 구현 판단에 맡김, 단 진실 원천은 한 곳)
- `requiresPartner`일 때 "상대방 정보" 섹션 렌더: 이름(선택) / 생년월일(**필수**) / 출생 시각 + 시 모름 / 성별 / 달력 — 본인 섹션과 동일 구성
- 클라 검증: 상대 생년월일 미입력 시 submit 차단 + toast
- 섹션 제목으로 "내 정보 / 상대방 정보" 명확히 구분 (두리 톤 카피는 자유)

※ 출생 시각 오전/오후 토글 교체(별도 미해결 항목)는 이 작업에 섞지 말 것. 이 지시문은 상대방 입력만. 단, 상대방 시각 입력도 본인과 같은 컴포넌트를 쓰도록 만들어서 나중에 토글 교체 시 한 번에 적용되게 할 것.

### 3. 주문 생성 API — `orders/create/route.ts`

- zod에 `partner` 옵셔널 객체 추가 (name/birthDate/birthTime/timeUnknown/gender/calendar — 본인과 동일 규칙)
- 상품 조회 select에 `slug` 추가
- **서버 게이트: `slug === "couple-match"`인데 `partner` 없거나 `partner.birthDate` 없으면 400.** couple-match가 아닌데 partner가 오면 무시(저장 안 함)
- `saju_inputs` insert에 partner_* 매핑

### 4. 생성 파이프라인 — `orders/confirm/route.ts`

- couple-match 분기:
  - 본인 `fetchSajuAnalysis` + 상대 `fetchSajuAnalysis` — **2회 호출** (병렬 Promise.all 가능)
  - 각각 독립적으로 mock 폴백 (본인 성공/상대 실패 조합 허용, 기존 폴백 패턴 그대로)
  - 상대 raw는 `saju_results.partner_full_analysis`, 변환 명식은 `partner_myeongsik`에 저장
- **usage 주의: 궁합 1건 = luckyloveme 2회 소모.** `recordSajuApiCall`은 fetch 내부에서 이미 기록되므로 추가 작업 불필요하나, source 구분이 필요하면 `"confirm"` 유지로 충분

### 5. 프롬프트 — `prompt.ts`

- `PromptInput`에 상대방 데이터(명식·만세력 텍스트·성별·이름) 추가
- couple-match focus 재작성 — 헤지 제거:
  - 삭제: "(있다면 활용)"
  - 두 명식이 모두 주어진 전제로: 일간 상생상극, 합충 비교, 십성 보완, 갈등 포인트, 관계 발전 시기
- **프롬프트 게이트: `buildSajuPrompt`에서 `productSlug === "couple-match"`인데 상대방 데이터가 없으면 throw.** 조용한 폴백 금지 — 결제 후 실패 시 에러가 관리자에게 보이는 게 가짜 궁합 발행보다 낫다
- 프롬프트에 두 사람 정보를 "본인 / 상대방" 블록으로 명확히 분리해 주입

### 6. 데모 경로 — `saju/interpret/route.ts`

- bodySchema에 `partnerBirthInfo` 옵셔널 추가
- 같은 게이트: `slug === "couple-match"` && 상대 없음 → 400
- (demo 페이지 UI 대응은 폼 컴포넌트 재사용으로 자연히 해결되는지 확인, 아니면 최소 400 에러만 보장)

### 7. 결과 페이지 — `results/[resultId]/page.tsx`

- couple-match일 때 명식 카드 2개: "내 명식 / 상대방 명식" (partner_myeongsik 렌더)
- 상대방 자미두수 명반은 이번 범위 제외 (v2 검토)

### 8. 테스트·검증

- 검증 기준 명식(본인): 음력 1971-04-25 10:30 여성 → 辛亥/癸巳/甲辰/己巳
- 상대방 테스트 입력은 임의 1건 고정해 E2E에 추가 (예: 양력 1968-03-15 22:00 남성 — 자시 아님·야자시 경계 아님인 평이한 케이스)
- 확인 항목:
  - [ ] couple-match 폼에서 상대 미입력 시 submit 불가
  - [ ] API 직접 호출(상대 누락)로 couple-match 주문 생성 시 400
  - [ ] 결제 확인 시 luckyloveme 2회 호출·2건 기록 (admin usage 카운트 +2)
  - [ ] saju_results에 partner_full_analysis / partner_myeongsik 저장 확인
  - [ ] 결과 페이지 명식 카드 2개 렌더
  - [ ] 생성된 궁합 본문이 실제로 양쪽 일간을 언급하는지 육안 확인
  - [ ] 다른 상품(today-fortune 등) 회귀 없음 — partner 컬럼 null로 기존 흐름 무변
- `scripts/test-all-products.ts`가 couple-match를 포함하면 상대방 입력 추가

## 범위 제외 (이 커밋에 넣지 말 것)

- 출생 시각 오전/오후 토글 교체 (별도 지시문)
- 생년월일 입력 불가 버그 (원인 미파악 — 별도 재현 필요)
- 상대방 자미두수 명반 비교
