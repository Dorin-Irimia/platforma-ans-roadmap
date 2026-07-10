import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider } from "./features/iam/AuthContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AuditLogPage from "./pages/AuditLogPage";

// Câte o pagină per scenariu — se adaugă sprint cu sprint.
// import PortalDmsPage from "./pages/PortalDmsPage";       // Scenariul 1
// import BiPage from "./pages/BiPage";                     // Scenariul 2
// import ChatbotPage from "./pages/ChatbotPage";            // Scenariul 3
// import LmsPage from "./pages/LmsPage";                    // Scenariul 5

function Home() {
  return (
    <div style={{ fontFamily: "sans-serif", padding: 24 }}>
      <h1>ANS Demo — Scenariile Obligatorii</h1>
      <ul>
        <li>Scenariul 1 — Portal / DMS / Registratură / Workflow <em>(în lucru)</em></li>
        <li>Scenariul 2 — Business Intelligence <em>(în lucru)</em></li>
        <li>Scenariul 3 — Chatbot / Asistent Virtual <em>(în lucru)</em></li>
        <li>
          Scenariul 4 — Securitate / IAM <strong>(gata)</strong>: <Link to="/login">Login</Link> ·{" "}
          <Link to="/register">Cont nou</Link> · <Link to="/admin">Admin</Link> · <Link to="/audit">Audit</Link>
        </li>
        <li>Scenariul 5 — LMS (CNFPA) <em>(în lucru)</em></li>
      </ul>
    </div>
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
