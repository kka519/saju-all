import type {
  MyeongsikViewModel,
  SinsalItem,
  GuiinChipItem,
} from "@/lib/saju/build-myeongsik-view";
import type { HapchungItem } from "@/lib/saju/full-analysis-types";
import type { Oheng } from "@/lib/saju/derived";

// =====================================================
// 5-B.2a — 명식 카드 본체 (보강 2: 오행 선명도 — 칸 카드화)
// =====================================================
// 구조: thead(시주/일주/월주/년주) + 5 tbody rows
//   row1 천간 단 (한글+한자 sup + 천간 십성)  ← 카드 (oheng 틴트 + 같은색 border + rounded)
//   row2 지지 단 (한글+한자 sup + 지지 십성)  ← 카드 (동일)
//   row3 지장간 / row4 12운성 / row5 신살 칩  ← 정보 행 (카드 없음, 텍스트)
// + table 외부 하단 칩 3종 (격국 · 용신 · 오행카운트)
//
// 셀 디자인 (보강 2):
//   - 천간/지지 카드: outer td 는 padding 으로 셀 간 gap 만, inner div 가 실제 카드.
//     bg-oheng-{색}/45 (선명) + border border-oheng-{색}/50 (같은색 외곽) + rounded-md.
//   - 같은색 배경 + 같은색 border 조합 → 격자가 아닌 "오행 블록"으로 시각 인식.
//   - 일주 강조: ring-2 ring-inset ring-starlight/60 — oheng border 와 색 분리,
//     채도 60 으로 진해진 틴트에서도 잘 보이게 강화.
//   - mock(hasFullData=false) 의 셀: 오행 없으면 border-night-border/30 placeholder.
//   - 백호살 칩: oheng-hwa border 톤 (starlight=일주 강조와 색 분리).
//
// 격자 → 카드 변환 방식:
//   - <table> 자체는 유지 (border-collapse 디폴트). td 에 padding 만 추가하고,
//     실제 시각적 카드는 inner <div>. 4기둥 정렬·하단 row border-t 모두 보존.

const OHENG_TINT: Record<Oheng, string> = {
  목: "bg-oheng-mok/45",
  화: "bg-oheng-hwa/45",
  토: "bg-oheng-to/45",
  금: "bg-oheng-geum/45",
  수: "bg-oheng-su/45",
};

const OHENG_BORDER: Record<Oheng, string> = {
  목: "border-oheng-mok/50",
  화: "border-oheng-hwa/50",
  토: "border-oheng-to/50",
  금: "border-oheng-geum/50",
  수: "border-oheng-su/50",
};

// 응답 position 값: "년지/월지/일지/시지" (sibisinsals/cheonui/gwangwihakgwan),
// "일주" (baekhosal) — 모두 fuzzy regex 로 4기둥에 매핑.
// ⚠️ 백호살 position='일주' — /일/ 매칭으로 day 분류.
//    응답 표기 변경 시 신살이 엉뚱한 기둥에 붙을 수 있음. 표기 바뀌면 본 RE 수정 필요.
const PILLAR_RE: Record<"year" | "month" | "day" | "hour", RegExp> = {
  year: /(year|년|연)/i,
  month: /(month|월)/i,
  day: /(day|일)/i,
  hour: /(hour|시)/i,
};

/** position 필드 기반 4기둥 버켓팅 — 신살/귀인 공통 (둘 다 {position, ji, name, description} shape). */
function bucketByPosition<T extends { position: string }>(items: T[]) {
  const out = { year: [] as T[], month: [] as T[], day: [] as T[], hour: [] as T[] };
  for (const it of items) {
    for (const k of ["year", "month", "day", "hour"] as const) {
      if (PILLAR_RE[k].test(it.position)) {
        out[k].push(it);
        break;
      }
    }
  }
  return out;
}

/**
 * 합충 — sourcePosition/targetPosition 둘 다 검사 (관계이므로 두 기둥에 걸침).
 * 기둥별 관계 타입(합/충/형/해/파) 이름만 중복 제거해 반환 — 칩 라벨용.
 */
function bucketHapchungTypes(items: HapchungItem[]) {
  const out = {
    year: [] as string[],
    month: [] as string[],
    day: [] as string[],
    hour: [] as string[],
  };
  for (const it of items) {
    for (const k of ["year", "month", "day", "hour"] as const) {
      if (PILLAR_RE[k].test(it.sourcePosition) || PILLAR_RE[k].test(it.targetPosition)) {
        if (!out[k].includes(it.type)) out[k].push(it.type);
      }
    }
  }
  return out;
}

export function MyeongsikTable({ view }: { view: MyeongsikViewModel }) {
  const headers = ["시주", "일주", "월주", "년주"] as const;
  // 시→년 역순. 일주 column index = 1.
  const pillars = [
    view.pillars.hour,
    view.pillars.day,
    view.pillars.month,
    view.pillars.year,
  ];
  const DAY_COL = 1;

  const byPillar = bucketByPosition(view.sinsals);
  const sinsalsArr = [byPillar.hour, byPillar.day, byPillar.month, byPillar.year];

  const byGuiinPillar = bucketByPosition<GuiinChipItem>(view.guiins);
  const guiinsArr = [byGuiinPillar.hour, byGuiinPillar.day, byGuiinPillar.month, byGuiinPillar.year];

  const byHapchungPillar = bucketHapchungTypes(view.hapchung ?? []);
  const hapchungArr = [
    byHapchungPillar.hour,
    byHapchungPillar.day,
    byHapchungPillar.month,
    byHapchungPillar.year,
  ];

  return (
    <div>
      <div className="rounded-lg border border-night-border overflow-hidden bg-night-secondary">
        <table className="w-full text-center table-fixed">
          <thead>
            <tr className="border-b border-night-border">
              {headers.map((h) => (
                <th
                  key={h}
                  className="py-2 text-[11px] font-mono uppercase tracking-wider text-night-fg-muted"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* ── row 0: 합충 (관계 요약) — 값 있는 기둥만 표시, hapchung 없으면 행 자체 생략 ── */}
            {view.hapchung && view.hapchung.length > 0 && (
              <tr className="border-b border-night-border/60">
                {hapchungArr.map((types, i) => (
                  <td key={`hc-${i}`} className="py-1.5 text-[11px] text-night-fg-muted">
                    {types.length > 0 ? types.join(" ") : "—"}
                  </td>
                ))}
              </tr>
            )}
            {/* ── row 1: 천간 단 (카드) ── */}
            <tr>
              {pillars.map((p, i) => {
                const oh = p?.cheonganOhaeng;
                const tint = oh ? OHENG_TINT[oh] : "";
                const borderCls = oh
                  ? `border ${OHENG_BORDER[oh]}`
                  : "border border-night-border/30";
                const ring = i === DAY_COL ? "ring-2 ring-inset ring-starlight/60" : "";
                return (
                  <td key={`c-${i}`} className="py-1.5 px-1.5">
                    <div className={`py-3 px-2 rounded-md ${tint} ${borderCls} ${ring}`}>
                      {p ? (
                        <>
                          <div className="text-2xl font-semibold text-night-fg leading-tight">
                            {p.cheongan}
                            {p.cheonganHanja && (
                              <sup className="ml-0.5 text-xs font-normal text-night-fg-muted">
                                {p.cheonganHanja}
                              </sup>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-night-fg-soft">
                            {p.sipseongCheongan ?? "—"}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-2xl font-semibold text-night-fg-muted leading-tight">
                            —
                          </div>
                          <div className="mt-1 text-xs text-night-fg-muted">—</div>
                        </>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
            {/* ── row 2: 지지 단 (카드) ── */}
            <tr>
              {pillars.map((p, i) => {
                const oh = p?.jijiOhaeng;
                const tint = oh ? OHENG_TINT[oh] : "";
                const borderCls = oh
                  ? `border ${OHENG_BORDER[oh]}`
                  : "border border-night-border/30";
                const ring = i === DAY_COL ? "ring-2 ring-inset ring-starlight/60" : "";
                return (
                  <td key={`j-${i}`} className="py-1.5 px-1.5">
                    <div className={`py-3 px-2 rounded-md ${tint} ${borderCls} ${ring}`}>
                      {p ? (
                        <>
                          <div className="text-2xl font-semibold text-night-fg leading-tight">
                            {p.jiji}
                            {p.jijiHanja && (
                              <sup className="ml-0.5 text-xs font-normal text-night-fg-muted">
                                {p.jijiHanja}
                              </sup>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-night-fg-soft">
                            {p.sipseongJiji ?? "—"}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="text-2xl font-semibold text-night-fg-muted leading-tight">
                            —
                          </div>
                          <div className="mt-1 text-xs text-night-fg-muted">—</div>
                        </>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
            {/* ── row 3: 지장간 ── */}
            <tr className="border-t border-night-border">
              {pillars.map((p, i) => (
                <td key={`jjg-${i}`} className="py-2 text-xs text-night-fg-soft">
                  {p && p.jijanggan.length > 0 ? p.jijanggan.join(" ") : "—"}
                </td>
              ))}
            </tr>
            {/* ── row 4: 12운성 ── */}
            <tr className="border-t border-night-border">
              {pillars.map((p, i) => (
                <td key={`tf-${i}`} className="py-2 text-sm font-medium text-night-fg-soft">
                  {p?.twelveFortune ?? "—"}
                </td>
              ))}
            </tr>
            {/* ── row 5: 신살 — align-top 으로 셀 높이 균등 ── */}
            <tr className="border-t border-night-border">
              {sinsalsArr.map((list, i) => (
                <td key={`sn-${i}`} className="py-2 px-1 align-top">
                  {list.length > 0 ? (
                    <div className="flex flex-wrap justify-center gap-1">
                      {list.map((s, j) => {
                        // 백호살: oheng-hwa border 톤 (starlight=일주 강조와 분리)
                        const isBaekhosal = s.category === "baekhosal";
                        const chipCls = isBaekhosal
                          ? "bg-night-elevated text-night-fg border border-oheng-hwa/60"
                          : "bg-night-elevated text-night-fg-muted border border-night-border/60";
                        return (
                          <span
                            key={`${s.name}-${j}`}
                            className={`inline-block px-1.5 py-0.5 text-[10px] rounded-full ${chipCls}`}
                          >
                            {s.name}
                          </span>
                        );
                      })}
                    </div>
                  ) : (
                    <span className="text-xs text-night-fg-muted">—</span>
                  )}
                </td>
              ))}
            </tr>
            {/* ── row 6: 귀인 — starlight 톤 (길신이라 신살과 색 분리) ── */}
            {view.guiins.length > 0 && (
              <tr className="border-t border-night-border">
                {guiinsArr.map((list, i) => (
                  <td key={`gi-${i}`} className="py-2 px-1 align-top">
                    {list.length > 0 ? (
                      <div className="flex flex-wrap justify-center gap-1">
                        {list.map((g, j) => (
                          <span
                            key={`${g.name}-${j}`}
                            className="inline-block px-1.5 py-0.5 text-[10px] rounded-full bg-night-elevated text-starlight-soft border border-starlight/40"
                          >
                            {g.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-night-fg-muted">—</span>
                    )}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── 하단 칩 3종 (격국 · 용신 · 오행카운트) ── */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {view.gyeokguk?.name && (
          <span className="inline-flex px-3 py-1 text-xs rounded-full bg-night-elevated text-night-fg-soft border border-night-border">
            {view.gyeokguk.name}
          </span>
        )}
        {view.yongsin?.오행 && (
          <span className="inline-flex px-3 py-1 text-xs rounded-full bg-night-elevated text-night-fg-soft border border-night-border">
            용신 · {view.yongsin.오행}
          </span>
        )}
        <span className="inline-flex px-3 py-1 text-xs rounded-full bg-night-elevated text-night-fg-soft border border-night-border font-mono">
          木{view.ohaengCount.목} 火{view.ohaengCount.화} 土{view.ohaengCount.토}{" "}
          金{view.ohaengCount.금} 水{view.ohaengCount.수}
        </span>
      </div>
    </div>
  );
}
