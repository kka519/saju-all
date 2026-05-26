import type { Myeongsik } from "@/lib/saju/manseryeok";

// 다크 톤 매핑(2-A) — night palette. 2-B에서 명식 셀 색·강조 디자인 본격.
export function MyeongsikTable({ myeongsik }: { myeongsik: Myeongsik }) {
  const headers = ["시주", "일주", "월주", "년주"] as const;
  const pillars = [myeongsik.hour, myeongsik.day, myeongsik.month, myeongsik.year];
  return (
    <div className="rounded-lg border border-night-border overflow-hidden bg-night-secondary">
      <table className="w-full text-center">
        <thead>
          <tr className="border-b border-night-border">
            {headers.map((h) => (
              <th key={h} className="py-2 text-[11px] font-mono uppercase tracking-wider text-night-fg-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {pillars.map((p, i) => (
              <td key={`c-${i}`} className="py-4 text-xl font-semibold text-night-fg">
                {p ? p.cheongan : "—"}
              </td>
            ))}
          </tr>
          <tr className="border-t border-night-border">
            {pillars.map((p, i) => (
              <td key={`j-${i}`} className="py-4 text-xl font-semibold text-night-fg">
                {p ? p.jiji : "—"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
