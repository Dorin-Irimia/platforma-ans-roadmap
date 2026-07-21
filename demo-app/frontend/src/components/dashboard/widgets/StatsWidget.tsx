import { useEffect, useState } from "react";
import { T } from "../../../theme";
import { fetchUsers } from "../../../features/iam/api";
import { fetchRequests } from "../../../features/dms/api";

interface Stat {
  label: string;
  value: string;
}

const TERMINAL_STATUSES = ["FINALIZAT", "RESPINS"];

function daysUntil(dateStr?: string) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function Tile({ label, value }: Stat) {
  return (
    <div style={{ flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.ink3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: T.ink }}>{value}</div>
    </div>
  );
}

// Indicatori rapizi de sistem — disponibili doar pentru personal (necesită acces la
// lista de conturi și registratură); pentru cetățeni afișăm un mesaj discret în loc.
export function StatsWidget() {
  const [stats, setStats] = useState<Stat[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    Promise.all([fetchUsers(), fetchRequests()])
      .then(([users, requests]) => {
        const active = users.filter((u: any) => u.isActive).length;
        const inProgress = requests.filter((r: any) => !TERMINAL_STATUSES.includes(r.status)).length;
        const nearDeadline = requests.filter((r: any) => {
          const d = daysUntil(r.legalDeadline);
          return d !== null && d <= 14;
        }).length;
        setStats([
          { label: "Conturi totale", value: String(users.length) },
          { label: "Conturi active", value: String(active) },
          { label: "Cereri în lucru", value: String(inProgress) },
          { label: "Termene apropiate", value: String(nearDeadline) },
        ]);
      })
      .catch(() => setUnavailable(true));
  }, []);

  if (unavailable) return <div style={{ color: T.ink3, fontSize: 13 }}>Indicatori disponibili doar pentru personalul ANS.</div>;
  if (!stats) return <div style={{ color: T.ink3, fontSize: 13 }}>Se încarcă...</div>;

  return (
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap", height: "100%", alignItems: "center" }}>
      {stats.map((s) => <Tile key={s.label} {...s} />)}
    </div>
  );
}
