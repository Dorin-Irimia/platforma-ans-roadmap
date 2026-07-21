import { T } from "../theme";

// Calendar Heatmap (cerință BI 4.5.12) — grilă gen "contribution graph", nu există nativ
// în recharts, construită dedicat cu div-uri simple colorate pe intensitate.
interface Props {
  data: { date: string; count: number }[]; // date = "YYYY-MM-DD"
  year: number;
}

const WEEKDAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

function intensityColor(count: number, max: number): string {
  if (count === 0) return T.line2;
  const ratio = max > 0 ? count / max : 0;
  if (ratio > 0.75) return T.brand;
  if (ratio > 0.5) return T.brandSoft;
  if (ratio > 0.25) return T.brandTint2;
  return T.brandTint;
}

export function CalendarHeatmap({ data, year }: Props) {
  const byDate = new Map(data.map((d) => [d.date, d.count]));
  const max = Math.max(0, ...data.map((d) => d.count));

  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  // Aliniem prima coloană la lunea din săptămâna care conține 1 ianuarie.
  const firstMonday = new Date(start);
  const dayOfWeek = (start.getDay() + 6) % 7; // 0=luni
  firstMonday.setDate(start.getDate() - dayOfWeek);

  const weeks: Date[][] = [];
  let cursor = new Date(firstMonday);
  while (cursor <= end) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(week);
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", gap: 3 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginRight: 4 }}>
          {WEEKDAY_LABELS.map((l, i) => (
            <div key={i} style={{ height: 12, fontSize: 9, color: T.ink4, lineHeight: "12px" }}>
              {i % 2 === 1 ? l : ""}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {week.map((day, di) => {
              const inYear = day.getFullYear() === year;
              const key = day.toISOString().slice(0, 10);
              const count = byDate.get(key) || 0;
              return (
                <div
                  key={di}
                  title={inYear ? `${key}: ${count} cereri` : ""}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: inYear ? intensityColor(count, max) : "transparent",
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 11, color: T.ink3 }}>
        <span>Puțin</span>
        {[T.line2, T.brandTint, T.brandTint2, T.brandSoft, T.brand].map((c, i) => (
          <div key={i} style={{ width: 12, height: 12, borderRadius: 3, background: c }} />
        ))}
        <span>Mult</span>
      </div>
    </div>
  );
}
