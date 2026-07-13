// =====================================================
// 천을귀인(天乙貴人) 조견표
// =====================================================
// 고전 공식: 甲戊庚 牛羊(축미) / 乙己 鼠猴(자신) / 丙丁 豬雞(해유) /
//            壬癸 兔蛇(묘사) / 辛 馬虎(오인)
// 대운/세운/월운의 지지가 일간 기준 천을귀인에 해당하면 'golden' 태그 후보.
// (view.guiins 는 원국 4기둥만 커버 — 운(運)의 지지 판정은 이 표로 별도 계산)
//
// 검증: report-template.html 레퍼런스 — 갑목(甲) 일간 → "천을귀인 미(未)·축(丑)" 일치.

const CHEONEUL_TABLE: Record<string, readonly [string, string]> = {
  갑: ["축", "미"],
  무: ["축", "미"],
  경: ["축", "미"],
  을: ["자", "신"],
  기: ["자", "신"],
  병: ["해", "유"],
  정: ["해", "유"],
  임: ["묘", "사"],
  계: ["묘", "사"],
  신: ["오", "인"],
};

/** 일간(한글) → 천을귀인 지지 2개. 알 수 없는 천간이면 빈 배열. */
export function getCheoneulJiji(dayGan: string): string[] {
  return [...(CHEONEUL_TABLE[dayGan] ?? [])];
}

/** 특정 지지가 해당 일간의 천을귀인인지 여부. */
export function isCheoneulGuiin(dayGan: string, ji: string | undefined): boolean {
  if (!ji) return false;
  return getCheoneulJiji(dayGan).includes(ji);
}
