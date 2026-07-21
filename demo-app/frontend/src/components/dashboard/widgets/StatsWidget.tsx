import { useEffect, useState } from "react";
import { Users, UserCheck, ListChecks, CalendarClock } from "lucide-react";
import { T } from "../../../theme";
import { fetchUsers } from "../../../features/iam/api";
import { fetchRequests } from "../../../features/dms/api";

interface Stat {
  label: string;
  value: number;
  icon: typeof Users;
  color: string;
  tint: string;
}

const TERMINAL_STATUSES = ["FINALIZAT", "RESPINS"];

function daysUntil(dateStr?: string) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

// RAF-based count-up (fără dependință nouă) — același tipar ca useCountUp din BiDashboardPage.tsx.
function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf: number;
    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function Tile({ label, value, icon: Icon, color, tint }: Stat) {
  const animated = useCountUp(value);
  return (
    <div style={{ flex: 1, minWidth: 130, display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: tint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={18} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.ink3, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 }}>{label}</div>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, color: T.ink }}>{animated}</div>
      </div>
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
          { label: "Conturi totale", value: users.length, icon: Users, color: T.info, tint: T.infoTint },
          { label: "Conturi active", value: active, icon: UserCheck, color: T.success, tint: T.successTint },
          { label: "Cereri în lucru", value: inProgress, icon: ListChecks, color: T.brand, tint: T.brandTint },
          { label: "Termene apropiate", value: nearDeadline, icon: CalendarClock, color: T.warn, tint: T.warnTint },
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
