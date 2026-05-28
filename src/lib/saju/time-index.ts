// =====================================================
// src/lib/saju/time-index.ts
// =====================================================
// 자미두수 시진 인덱스 변환 — 순수 함수, 외부 의존 없음.
//
// 분리 이유: ziwei.ts 는 'server-only' (iztro 의존 + 서버 전용 라이브러리)이지만
// 시진 변환만큼은 클라이언트 컴포넌트(ZiweiChart 등)에서도 필요해
// server-only 사슬에 묶이지 않도록 별도 모듈로 분리.
//
// ziwei.ts 는 본 파일에서 import 한 뒤 re-export 도 함께 제공 → 기존 호출처 무변경.

/**
 * 24시간제 시·분을 자미두수 시진 인덱스(0~11)로 변환.
 *
 * 시진 매핑:
 *   자시=0: 23:00~00:59  (자시 경계 — 23시대와 0시대 모두)
 *   축시=1: 01:00~02:59
 *   인시=2: 03:00~04:59
 *   묘시=3: 05:00~06:59
 *   진시=4: 07:00~08:59
 *   사시=5: 09:00~10:59
 *   오시=6: 11:00~12:59
 *   미시=7: 13:00~14:59
 *   신시=8: 15:00~16:59
 *   유시=9: 17:00~18:59
 *   술시=10: 19:00~20:59
 *   해시=11: 21:00~22:59
 *
 * @param hour - 24시간제 시 (0~23)
 * @param _minute - 분 (0~59) — 현재 매핑에 영향 없음. iztro fixLeap 옵션이 절기 보정 처리.
 * @returns 시진 인덱스 (0~11)
 * @throws RangeError - hour 또는 minute가 유효 범위를 벗어날 때
 */
export function hourToTimeIndex(hour: number, _minute: number): number {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError(`hour must be integer 0~23, got: ${hour}`);
  }
  if (!Number.isInteger(_minute) || _minute < 0 || _minute > 59) {
    throw new RangeError(`minute must be integer 0~59, got: ${_minute}`);
  }

  // 자시 경계 (23시대) → 0
  if (hour === 23) return 0;

  // 그 외 0~22 → (hour + 1) / 2 의 정수부
  // hour=0 → 0 (자시) / hour=1,2 → 1 (축시) / hour=21,22 → 11 (해시)
  return Math.floor((hour + 1) / 2);
}
