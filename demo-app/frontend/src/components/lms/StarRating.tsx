import { useState } from "react";
import { Star } from "lucide-react";
import { T } from "../../theme";

const GOLD = "#F5A623";

// Rating interactiv (evaluare) — 5 stele, click pentru a alege, hover pentru previzualizare
// înainte de a alege efectiv. Accesibil de la tastatură: fiecare stea e un <button> propriu,
// cu aria-label explicit ("N stele"), într-un grup cu aria-label descriptiv al întregului control.
export function StarRating({
  value,
  onChange,
  size = 22,
  disabled,
}: {
  value: number;
  onChange: (rating: number) => void;
  size?: number;
  disabled?: boolean;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const shown = hovered ?? value;

  return (
    <div role="radiogroup" aria-label="Evaluare prin stele" style={{ display: "flex", gap: 4 }} onMouseLeave={() => setHovered(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? "stea" : "stele"}`}
          disabled={disabled}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHovered(n)}
          onFocus={() => setHovered(n)}
          onBlur={() => setHovered(null)}
          style={{
            background: "none",
            border: "none",
            padding: 2,
            cursor: disabled ? "default" : "pointer",
            display: "flex",
            transition: "transform .12s ease",
            transform: hovered === n ? "scale(1.15)" : "scale(1)",
          }}
        >
          <Star size={size} color={GOLD} fill={n <= shown ? GOLD : "none"} strokeWidth={n <= shown ? 0 : 1.6} />
        </button>
      ))}
    </div>
  );
}

// Rating descriptiv (afișare) — read-only, folosit în cataloage/rapoarte: stele pline
// proporțional cu media (rotunjită la cea mai apropiată stea întreagă, suficient pentru o
// afișare compactă) + media numerică + numărul de evaluări.
export function StarRatingDisplay({ avg, count, size = 15 }: { avg: number; count: number; size?: number }) {
  if (count === 0) {
    return <span style={{ fontSize: 12, color: T.ink4 }}>Fără evaluări încă</span>;
  }
  const rounded = Math.round(avg);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ display: "flex", gap: 1 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Star key={n} size={size} color={GOLD} fill={n <= rounded ? GOLD : "none"} strokeWidth={n <= rounded ? 0 : 1.6} />
        ))}
      </div>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink2 }}>{avg.toFixed(1)}</span>
      <span style={{ fontSize: 12, color: T.ink4 }}>({count})</span>
    </div>
  );
}

// Bară de distribuție (1★..5★) — același tipar vizual ca la breakdown-ul de răspunsuri
// din QuizReportTab (LmsCourseEditorPage.tsx): etichetă + bară proporțională + număr brut.
export function FeedbackDistributionBars({ distribution, count }: { distribution: number[]; count: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {[5, 4, 3, 2, 1].map((star) => {
        const n = distribution[star - 1] || 0;
        const pct = count ? Math.round((n / count) * 100) : 0;
        return (
          <div key={star} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <div style={{ width: 30, flexShrink: 0, color: T.ink3 }}>{star}★</div>
            <div style={{ flex: 1, height: 7, background: T.line2, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: GOLD, borderRadius: 4 }} />
            </div>
            <div style={{ width: 34, textAlign: "right", color: T.ink3 }}>{n}</div>
          </div>
        );
      })}
    </div>
  );
}
