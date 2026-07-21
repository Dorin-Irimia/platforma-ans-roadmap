import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pill } from "../../ui";
import { T } from "../../../theme";
import { useAuth } from "../../../features/iam/AuthContext";
import { fetchRequests } from "../../../features/dms/api";
import { fetchMyRequests } from "../../../features/dms/api";

// Aceeași semantică de culoare pe status ca în Registratură (RegistraturaPage.tsx).
const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  NOU: { color: T.info, bg: T.infoTint, label: "Nou" },
  IN_LUCRU: { color: T.progress, bg: T.progressTint, label: "În lucru" },
  IN_ASTEPTARE: { color: T.warn, bg: T.warnTint, label: "În așteptare" },
  FINALIZAT: { color: T.success, bg: T.successTint, label: "Finalizat" },
  RESPINS: { color: T.danger, bg: T.dangerTint, label: "Respins" },
};

interface Row {
  id: string;
  registryNumber: string;
  category: string;
  status: string;
}

export function RecentRequestsWidget({ config }: { config?: Record<string, unknown> | null }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const limit = typeof config?.limit === "number" ? config.limit : 5;
  const isStaff = user && user.role !== "UTILIZATOR_STANDARD";

  useEffect(() => {
    const load = isStaff ? fetchRequests() : fetchMyRequests();
    load
      .then((data) => setRows(data.slice(0, limit).map((r) => ({ id: r.id, registryNumber: r.registryNumber, category: r.category, status: r.status }))))
      .catch(() => setRows([]));
  }, [isStaff, limit]);

  if (rows === null) return <div style={{ color: T.ink3, fontSize: 13 }}>Se încarcă...</div>;
  if (rows.length === 0) return <div style={{ color: T.ink3, fontSize: 13 }}>Nicio cerere înregistrată.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((r) => {
        const st = STATUS_STYLE[r.status] || STATUS_STYLE.NOU;
        return (
          <div
            key={r.id}
            onClick={() => navigate(isStaff ? `/registratura/${r.id}` : `/portal`)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 10px",
              borderRadius: 10,
              cursor: "pointer",
              background: T.line2,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{r.registryNumber}</div>
              <div style={{ fontSize: 11.5, color: T.ink3 }}>{r.category}</div>
            </div>
            <Pill color={st.color} bg={st.bg}>{st.label}</Pill>
          </div>
        );
      })}
    </div>
  );
}
