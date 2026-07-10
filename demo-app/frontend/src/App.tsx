import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider } from "./features/iam/AuthContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AuditLogPage from "./pages/AuditLogPage";
import { PageShell, Card, Pill } from "./components/ui";
import { T } from "./theme";

// Câte o pagină per scenariu — se adaugă sprint cu sprint.
// import PortalDmsPage from "./pages/PortalDmsPage";       // Scenariul 1
// import BiPage from "./pages/BiPage";                     // Scenariul 2
// import ChatbotPage from "./pages/ChatbotPage";            // Scenariul 3
// import LmsPage from "./pages/LmsPage";                    // Scenariul 5

const SCENARIOS = [
  { id: 1, label: "Portal / DMS / Registratură / Workflow", ready: false },
  { id: 2, label: "Business Intelligence", ready: false },
  { id: 3, label: "Chatbot / Asistent Virtual", ready: false },
  { id: 4, label: "Securitate / IAM", ready: true },
  { id: 5, label: "LMS (CNFPA)", ready: false },
];

function Home() {
  return (
    <PageShell title="ANS Demo" subtitle="Scenariile obligatorii de demonstrație (Cap. 8 din caiet)">
      <div style={{ display: "grid", gap: 12 }}>
        {SCENARIOS.map((s) => (
          <Card key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: T.brand, fontSize: 18 }}>
                {String(s.id).padStart(2, "0")}
              </span>
              <span style={{ fontWeight: 600 }}>{s.label}</span>
            </div>
            {s.ready ? (
              <Pill color={T.success} bg={T.successTint}>Gata</Pill>
            ) : (
              <Pill>În lucru</Pill>
            )}
          </Card>
        ))}
      </div>
      <div style={{ marginTop: 24, display: "flex", gap: 16 }}>
        <Link to="/login">Login</Link>
        <Link to="/register">Cont nou</Link>
        <Link to="/admin">Admin</Link>
        <Link to="/audit">Audit</Link>
      </div>
    </PageShell>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/admin" element={<AdminUsersPage />} />
          <Route path="/audit" element={<AuditLogPage />} />
          {/* <Route path="/dms" element={<PortalDmsPage />} /> */}
          {/* <Route path="/bi" element={<BiPage />} /> */}
          {/* <Route path="/chatbot" element={<ChatbotPage />} /> */}
          {/* <Route path="/lms" element={<LmsPage />} /> */}
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
