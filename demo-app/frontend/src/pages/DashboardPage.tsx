import { useAuth } from "../features/iam/AuthContext";
import { AppShell } from "../components/AppShell";
import { DashboardGrid } from "../components/dashboard/DashboardGrid";
import { DashboardHero } from "../components/dashboard/DashboardHero";

// Panoul principal e complet configurabil — nu mai există conținut static (acțiuni
// rapide, indicatori, jurnal) în afara grid-ului: toate acestea sunt acum widget-uri
// normale (STATS, ACTIVITY_LOG, LINK_BUTTON, RECENT_REQUESTS), pe care fiecare cont
// le poate muta/redimensiona/șterge liber. Un cont nou primește un aranjament implicit
// populat automat de backend la prima cerere GET /widgets — vezi seedDefaultWidgets în
// dashboard/routes.ts — dar rămâne complet configurabil de atunci. Salutul din
// DashboardHero e singurul element cu adevărat static al paginii.
export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <AppShell title="Panou principal" fullWidth>
      <DashboardHero name={user?.name || user?.email || ""} />
      <DashboardGrid />
    </AppShell>
  );
}
