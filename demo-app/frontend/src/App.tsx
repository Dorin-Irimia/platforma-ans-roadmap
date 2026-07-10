import { BrowserRouter, Routes, Route, Link } from "react-router-dom";

// Câte o pagină per scenariu — se implementează sprint cu sprint.
// import PortalDmsPage from "./pages/PortalDmsPage";
// import BiPage from "./pages/BiPage";
// import ChatbotPage from "./pages/ChatbotPage";
// import IamPage from "./pages/IamPage";
// import LmsPage from "./pages/LmsPage";

function Home() {
  return (
    <div style={{ fontFamily: "sans-serif", padding: 24 }}>
      <h1>ANS Demo — Scenariile Obligatorii</h1>
      <ul>
        <li>Scenariul 1 — Portal / DMS / Registratură / Workflow</li>
        <li>Scenariul 2 — Business Intelligence</li>
        <li>Scenariul 3 — Chatbot / Asistent Virtual</li>
        <li>Scenariul 4 — Securitate / IAM</li>
        <li>Scenariul 5 — LMS (CNFPA)</li>
      </ul>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        {/* <Route path="/dms" element={<PortalDmsPage />} /> */}
        {/* <Route path="/bi" element={<BiPage />} /> */}
        {/* <Route path="/chatbot" element={<ChatbotPage />} /> */}
        {/* <Route path="/iam" element={<IamPage />} /> */}
        {/* <Route path="/lms" element={<LmsPage />} /> */}
      </Routes>
    </BrowserRouter>
  );
}
