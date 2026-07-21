import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { T } from "../../../theme";
import { fetchAutomationSummary, AutomationSummaryItemDto } from "../../../features/dashboard/api";

const TONE_COLOR: Record<AutomationSummaryItemDto["tone"], string> = {
  success: T.success,
  warn: T.warn,
  danger: T.danger,
  info: T.info,
};

// Agregă toate regulile automate adăugate în platformă (câte una per modul) — un singur
// loc din care se vede dintr-o privire ce a semnalat/acționat fiecare modul.
export function AutomationSummaryWidget() {
  const [items, setItems] = useState<AutomationSummaryItemDto[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchAutomationSummary().then(setItems).catch(() => setUnavailable(true));
  }, []);

  if (unavailable) return <div style={{ color: T.ink3, fontSize: 13 }}>Disponibil doar pentru personalul ANS.</div>;
  if (!items) return <div style={{ color: T.ink3, fontSize: 13 }}>Se încarcă...</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, height: "100%" }}>
      {items.map((item) => (
        <div
          key={item.module}
          onClick={() => navigate(item.link)}
          style={{
            padding: 12,
            borderRadius: 10,
            background: T.bgSoft,
            border: `1px solid ${T.line}`,
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ fontSize: 10.5, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: 0.4 }}>{item.module}</div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: TONE_COLOR[item.tone] }}>{item.count}</div>
          <div style={{ fontSize: 11.5, color: T.ink2 }}>{item.label}</div>
        </div>
      ))}
    </div>
  );
}
