import { useEffect, useState } from "react";
import { T } from "../../../theme";
import { Pill } from "../../ui";
import { fetchAuditLog } from "../../../features/iam/api";

export function ActivityLogWidget({ config }: { config?: Record<string, unknown> | null }) {
  const [events, setEvents] = useState<any[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const limit = typeof config?.limit === "number" ? config.limit : 8;

  useEffect(() => {
    fetchAuditLog({ limit })
      .then(setEvents)
      .catch(() => setUnavailable(true));
  }, [limit]);

  if (unavailable) return <div style={{ color: T.ink3, fontSize: 13 }}>Jurnal disponibil doar pentru roluri de administrare.</div>;
  if (!events) return <div style={{ color: T.ink3, fontSize: 13 }}>Se încarcă...</div>;

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <tbody>
        {events.map((e) => (
          <tr key={e.id}>
            <td style={{ padding: "6px 4px", fontSize: 12, color: T.ink3, whiteSpace: "nowrap" }}>{new Date(e.createdAt).toLocaleString("ro-RO")}</td>
            <td style={{ padding: "6px 4px", fontSize: 12.5, fontWeight: 600, color: T.ink }}>{e.action}</td>
            <td style={{ padding: "6px 4px", textAlign: "right" }}>
              {e.success ? <Pill color={T.success} bg={T.successTint}>OK</Pill> : <Pill color={T.danger} bg={T.dangerTint}>Eșuat</Pill>}
            </td>
          </tr>
        ))}
        {events.length === 0 && (
          <tr>
            <td colSpan={3} style={{ color: T.ink3, fontSize: 13, padding: 8 }}>Niciun eveniment încă.</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}
