import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./features/iam/AuthContext";
import { TutorialProvider } from "./features/tutorial/TutorialContext";
import { ToastProvider } from "./components/ToastProvider";
import { TutorialOverlay } from "./components/TutorialOverlay";
import { ProtectedRoute } from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import DashboardPage from "./pages/DashboardPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AuditLogPage from "./pages/AuditLogPage";
import AcceptInvitePage from "./pages/AcceptInvitePage";
import SecurityPage from "./pages/SecurityPage";
import SecretsPage from "./pages/SecretsPage";
import PortalPage from "./pages/PortalPage";
import RegistraturaPage from "./pages/RegistraturaPage";
import RequestDetailPage from "./pages/RequestDetailPage";
import FormBuilderPage from "./pages/FormBuilderPage";
import WorkflowAdminPage from "./pages/WorkflowAdminPage";
import BiDashboardPage from "./pages/BiDashboardPage";
import ChatbotPage from "./pages/ChatbotPage";
import LmsCoursesPage from "./pages/LmsCoursesPage";
import LmsCourseEditorPage from "./pages/LmsCourseEditorPage";
import LmsCoursePlayerPage from "./pages/LmsCoursePlayerPage";
import LmsProjectsPage from "./pages/LmsProjectsPage";
import LmsProjectDetailPage from "./pages/LmsProjectDetailPage";
import SportsRegistryPage from "./pages/SportsRegistryPage";
import MuseumPage from "./pages/MuseumPage";
import ArchivePage from "./pages/ArchivePage";
import YearbookPage from "./pages/YearbookPage";
import NomenclatoarePage from "./pages/NomenclatoarePage";
import MyAccountPage from "./pages/MyAccountPage";
import MediaLibraryPage from "./pages/MediaLibraryPage";
import CmsAdminPage from "./pages/CmsAdminPage";
import CmsPublicPage from "./pages/CmsPublicPage";

const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN_INSTITUTIE", "MODERATOR", "EVALUATOR", "AUTOR", "CO_AUTOR"];
const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN_INSTITUTIE"];
// Cine ajunge la pagina de autorat "Cursurile mele" — creatorii de conținut (vezi
// requireCourseCreator() pe backend, lms/rbac.ts) PLUS Evaluator, care nu creează cursuri
// dar are nevoie să le vadă/evalueze pe toate (backend GET /courses îi întoarce deja toate).
const LMS_AUTHORING_ROLES = ["SUPER_ADMIN", "ADMIN_INSTITUTIE", "AUTOR", "CNFPA", "EVALUATOR"];
// Roluri de stakeholder extern (Portal Public, 4.5.1) — conturi SPORTIV/FEDERATIE/CLUB/CNFPA.
const STAKEHOLDER_ROLES = ["SPORTIV", "FEDERATIE", "CLUB", "CNFPA"];

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <ToastProvider>
        <TutorialProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          {/* Portal public — accesibil fără autentificare (Scenariul 1, pct. 5);
              PortalPage însuși diferențiază comportamentul pentru vizitatori anonimi. */}
          <Route path="/portal" element={<PortalPage />} />
          <Route
            path="/registratura"
            element={
              <ProtectedRoute roles={STAFF_ROLES}>
                <RegistraturaPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/registratura/:id"
            element={
              <ProtectedRoute roles={STAFF_ROLES}>
                <RequestDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/form-builder"
            element={
              <ProtectedRoute roles={ADMIN_ROLES}>
                <FormBuilderPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/workflow-admin"
            element={
              <ProtectedRoute roles={ADMIN_ROLES}>
                <WorkflowAdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bi"
            element={
              <ProtectedRoute roles={STAFF_ROLES}>
                <BiDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute roles={ADMIN_ROLES}>
                <AdminUsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit"
            element={
              <ProtectedRoute roles={["SUPER_ADMIN", "ADMIN_INSTITUTIE", "MODERATOR"]}>
                <AuditLogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/security"
            element={
              <ProtectedRoute>
                <SecurityPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/chatbot"
            element={
              <ProtectedRoute>
                <ChatbotPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lms"
            element={
              <ProtectedRoute>
                <LmsProjectsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lms/mine"
            element={
              <ProtectedRoute roles={LMS_AUTHORING_ROLES}>
                <LmsCoursesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lms/projects/:id"
            element={
              <ProtectedRoute>
                <LmsProjectDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lms/courses/:id"
            element={
              <ProtectedRoute>
                <LmsCourseEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lms/courses/:id/learn"
            element={
              <ProtectedRoute>
                <LmsCoursePlayerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/secrets"
            element={
              <ProtectedRoute roles={["SUPER_ADMIN"]}>
                <SecretsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/registru-sportiv"
            element={
              <ProtectedRoute roles={STAFF_ROLES}>
                <SportsRegistryPage />
              </ProtectedRoute>
            }
          />
          {/* Muzeu public — bilete rezervabile fără autentificare, ca la Portal;
              MuseumPage însăși diferențiază tab-ul admin „Artefacte" pe rol. */}
          <Route path="/muzeu" element={<MuseumPage />} />
          {/* Anuarul Sportului — Almanah Online public (fără autentificare), ca la
              Portal/Muzeu; YearbookPage însăși diferențiază panoul de administrare pe rol. */}
          <Route path="/anuarul-sportului" element={<YearbookPage />} />
          <Route
            path="/nomenclatoare"
            element={
              <ProtectedRoute roles={ADMIN_ROLES}>
                <NomenclatoarePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/arhiva"
            element={
              <ProtectedRoute roles={STAFF_ROLES}>
                <ArchivePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/contul-meu"
            element={
              <ProtectedRoute roles={STAKEHOLDER_ROLES}>
                <MyAccountPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/biblioteca-media"
            element={
              <ProtectedRoute roles={STAFF_ROLES}>
                <MediaLibraryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cms"
            element={
              <ProtectedRoute roles={ADMIN_ROLES}>
                <CmsAdminPage />
              </ProtectedRoute>
            }
          />
          {/* Pagini publice CMS (Termeni/Confidențialitate/Contact etc.) — fără autentificare,
              ca la Portal/Muzeu/Anuarul Sportului. */}
          <Route path="/pagini/:slug" element={<CmsPublicPage />} />
        </Routes>
        <TutorialOverlay />
        </TutorialProvider>
        </ToastProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
