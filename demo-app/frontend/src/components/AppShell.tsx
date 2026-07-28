import { ReactNode, useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Globe,
  Inbox,
  ClipboardList,
  GitBranch,
  Users,
  ScrollText,
  Bell,
  LogOut,
  BarChart3,
  ShieldCheck,
  KeyRound,
  MessageCircle,
  GraduationCap,
  Trophy,
  Landmark,
  Archive,
  BookOpen,
  ListTree,
  UserCircle,
  Image,
  FileEdit,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "../features/iam/AuthContext";
import { T, FONT, SHADOW } from "../theme";
import { RolePill, LogoMark } from "./ui";
import { AccessibilityMenu } from "./AccessibilityMenu";
import { TutorialLauncher } from "./TutorialLauncher";
import { navIdForRoute } from "../features/tutorial/tours";
import { useIsMobile } from "../lib/useMediaQuery";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: string[]; // dacă lipsește, e vizibil pentru orice cont autentificat
}

const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN_INSTITUTIE", "MODERATOR", "EVALUATOR", "AUTOR", "CO_AUTOR"];
const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN_INSTITUTIE"];
// Roluri de stakeholder extern (Portal Public, 4.5.1) — conturi SPORTIV/FEDERATIE/CLUB/CNFPA.
const STAKEHOLDER_ROLES = ["SPORTIV", "FEDERATIE", "CLUB", "CNFPA"];

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Panou principal", icon: LayoutDashboard },
  { to: "/chatbot", label: "Chatbot", icon: MessageCircle },
  { to: "/lms", label: "Cursuri", icon: GraduationCap },
  { to: "/portal", label: "Portal servicii", icon: Globe },
  { to: "/contul-meu", label: "Contul meu", icon: UserCircle, roles: STAKEHOLDER_ROLES },
  { to: "/registratura", label: "Registratură", icon: Inbox, roles: STAFF_ROLES },
  { to: "/registru-sportiv", label: "Registru Sportiv", icon: Trophy, roles: STAFF_ROLES },
  { to: "/anuarul-sportului", label: "Anuarul Sportului", icon: BookOpen },
  { to: "/muzeu", label: "Muzeu", icon: Landmark },
  { to: "/arhiva", label: "Arhivă", icon: Archive, roles: STAFF_ROLES },
  { to: "/form-builder", label: "Editor șabloane", icon: ClipboardList, roles: ADMIN_ROLES },
  { to: "/cms", label: "Pagini publice", icon: FileEdit, roles: ADMIN_ROLES },
  { to: "/biblioteca-media", label: "Bibliotecă media", icon: Image, roles: STAFF_ROLES },
  { to: "/nomenclatoare", label: "Nomenclatoare", icon: ListTree, roles: ADMIN_ROLES },
  { to: "/workflow-admin", label: "Configurare flux", icon: GitBranch, roles: ADMIN_ROLES },
  { to: "/bi", label: "Business Intelligence", icon: BarChart3, roles: STAFF_ROLES },
  { to: "/admin", label: "Utilizatori", icon: Users, roles: ADMIN_ROLES },
  { to: "/audit", label: "Jurnal de audit", icon: ScrollText, roles: ["SUPER_ADMIN", "ADMIN_INSTITUTIE", "MODERATOR"] },
  { to: "/security", label: "Securitate", icon: ShieldCheck },
  { to: "/secrets", label: "Secrete", icon: KeyRound, roles: ["SUPER_ADMIN"] },
];

function SidebarItem({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <NavLink
      id={navIdForRoute(item.to)}
      to={item.to}
      end={item.to === "/"}
      title={item.label}
      className="sidebar-item"
      onClick={onNavigate}
      style={({ isActive }) => ({
        display: "flex",
        alignItems: "center",
        gap: 12,
        justifyContent: collapsed ? "center" : "flex-start",
        padding: collapsed ? "10px 0" : "10px 14px",
        margin: "0 12px",
        borderRadius: 12,
        color: isActive ? "#fff" : "rgba(255,255,255,0.6)",
        background: isActive ? "rgba(255,255,255,0.10)" : "transparent",
        boxShadow: isActive ? `inset 3px 0 0 ${T.brand}` : "none",
        fontSize: 14,
        fontWeight: 600,
        whiteSpace: "nowrap",
        overflow: "hidden",
      })}
    >
      <Icon size={18} strokeWidth={2} style={{ flexShrink: 0 }} />
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  );
}

export function AppShell({
  title,
  subtitle,
  children,
  sidebarCollapsed = false,
  fullWidth = true,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  sidebarCollapsed?: boolean;
  fullWidth?: boolean;
}) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Sub 1024px sidebar-ul permanent devine un sertar (drawer) care se deschide peste
  // conținut — se închide automat la orice navigare, ca la orice tipar mobil standard.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  function handleSignOut() {
    signOut();
    navigate("/login");
  }

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));
  const collapsed = !isMobile && sidebarCollapsed;
  const sidebarVisible = !isMobile || drawerOpen;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: FONT.body, display: "flex", flexDirection: "column" }}>
      {/* Header alb — logo platformă + branding instituție + notificări */}
      <header
        style={{
          height: 64,
          background: T.card,
          borderBottom: `1px solid ${T.line}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isMobile ? "0 12px" : "0 24px",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 11, minWidth: 0 }}>
          {isMobile && (
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Deschide meniul"
              style={{
                width: 36,
                height: 36,
                flexShrink: 0,
                borderRadius: 999,
                border: `1px solid ${T.line}`,
                background: T.bgSoft,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: T.ink2,
              }}
            >
              <Menu size={18} />
            </button>
          )}
          <LogoMark size={28} />
          <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: isMobile ? 14 : 16, letterSpacing: -0.3, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Platformă <span style={{ color: T.brand }}>ANS</span>
            {!isMobile && <span style={{ color: T.ink3, fontWeight: 500, fontSize: 13 }}> · eGuvernare</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 16, flexShrink: 0 }}>
          {user && !isMobile && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{user.name || user.email}</div>
              <RolePill role={user.role} />
            </div>
          )}
          <button
            title="Notificări"
            style={{
              width: 36,
              height: 36,
              flexShrink: 0,
              borderRadius: 999,
              border: `1px solid ${T.line}`,
              background: T.bgSoft,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: T.ink2,
            }}
          >
            <Bell size={16} />
          </button>
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", position: "relative" }}>
        {/* Fundal semitransparent — doar pe mobil/tabletă, cât timp sertarul e deschis;
            un tap oriunde în afara lui îl închide, ca la orice meniu tip drawer nativ. */}
        {isMobile && drawerOpen && (
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(14,17,22,0.45)", zIndex: 29 }}
          />
        )}

        {/* Sidebar slate — iconițe + etichete. Pe desktop e permanent (colapsabil la doar-
            iconițe); pe mobil/tabletă devine un sertar fix, ascuns în afara ecranului până
            e deschis din butonul hamburger de sus. */}
        <aside
          style={{
            width: collapsed ? 72 : 236,
            background: `linear-gradient(180deg, ${T.indigo}, ${T.indigoDark})`,
            display: "flex",
            flexDirection: "column",
            padding: "16px 0",
            gap: 2,
            flexShrink: 0,
            transition: isMobile ? "transform .22s ease" : "width .15s ease",
            ...(isMobile
              ? {
                  position: "fixed",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  zIndex: 30,
                  width: 256,
                  transform: sidebarVisible ? "translateX(0)" : "translateX(-100%)",
                  boxShadow: sidebarVisible ? SHADOW.lg : "none",
                }
              : {}),
          }}
        >
          {isMobile && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.08)", marginBottom: 8 }}>
              {user ? (
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#fff" }}>{user.name || user.email}</div>
                  <RolePill role={user.role} />
                </div>
              ) : <span />}
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Închide meniul"
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", padding: 6, flexShrink: 0 }}
              >
                <X size={18} />
              </button>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, overflowY: "auto" }}>
            {visibleItems.map((item) => (
              <SidebarItem key={item.to} item={item} collapsed={collapsed} onNavigate={isMobile ? () => setDrawerOpen(false) : undefined} />
            ))}
          </div>

          <div style={{ padding: "0 12px", display: "flex", flexDirection: "column", gap: 2 }}>
            <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "8px 2px" }} />
            <div
              onClick={handleSignOut}
              title="Deconectare"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                justifyContent: collapsed ? "center" : "flex-start",
                padding: collapsed ? "10px 0" : "10px 14px",
                borderRadius: 12,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                color: "rgba(255,255,255,0.55)",
              }}
            >
              <LogOut size={18} style={{ flexShrink: 0 }} />
              {!collapsed && <span>Deconectare</span>}
            </div>
          </div>
        </aside>

        <main style={{ flex: 1, padding: isMobile ? "18px 16px" : "36px 44px", overflowX: "auto", minWidth: 0 }}>
          <div style={{ maxWidth: fullWidth ? "100%" : 1040, animation: "ansFade .25s ease" }}>
            <h1 style={{ fontSize: isMobile ? 21 : 29, fontWeight: 700, letterSpacing: -0.6, marginBottom: 4 }}>{title}</h1>
            {subtitle && <p style={{ color: T.ink3, fontSize: 13.5, marginTop: 6, marginBottom: isMobile ? 18 : 26 }}>{subtitle}</p>}
            {children}
          </div>
        </main>
      </div>

      <AccessibilityMenu />
      <TutorialLauncher />
    </div>
  );
}
