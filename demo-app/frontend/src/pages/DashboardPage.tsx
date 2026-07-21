import { useAuth } from "../features/iam/AuthContext";
import { AppShell } from "../components/AppShell";
import { DashboardGrid } from "../components/dashboard/DashboardGrid";

// Panoul principal e complet configurabil — nu mai există conținut static (hero,
// acțiuni rapide, indicatori, jurnal) în afara grid-ului: toate acestea sunt acum
// widget-uri normale (STATS, ACTIVITY_LOG, LINK_BUTTON, RECENT_REQUESTS), pe care
// fiecare cont le poate muta/redimensiona/șterge liber. Un cont nou primește un
// aranjament implicit populat automat de backend la prima cerere GET /widgets — vezi
// seedDefaultWidgets în dashboard/routes.ts — dar rămâne complet configurabil de atunci.
export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <AppShell title={`Bună, ${user?.name || user?.email}`} subtitle="Platforma digitală integrată — Agenția Națională pentru Sport" fullWidth>
      <DashboardGrid />
    </AppShell>
  );
}
