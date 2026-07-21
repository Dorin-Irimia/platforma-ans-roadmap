import { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { useAuth } from "../features/iam/AuthContext";
import { T, FONT } from "../theme";
import { RolePill, LogoMark } from "./ui";
import { AccessibilityMenu } from "./AccessibilityMenu";
import { TutorialLauncher } from "./TutorialLauncher";
import { navIdForRoute } from "../features/tutorial/tours";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles?: string[]; // dacă lipsește, e vizibil pentru orice cont autentificat
}

const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN_INSTITUTIE", "MODERATOR", "EVALUATOR", "AUTOR", "CO_AUTOR"];
const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN_INSTITUTIE"];

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Panou principal", icon: LayoutDashboard },
  { to: "/chatbot", label: "Chatbot", icon: MessageCircle },
  { to: "/lms", label: "Cursuri", icon: GraduationCap },
  { to: "/portal", label: "Portal servicii", icon: Globe },
  { to: "/registratura", label: "Registratură", icon: Inbox, roles: STAFF_ROLES },
  { to: "/registru-sportiv", label: "Registru Sportiv", icon: Trophy, roles: STAFF_ROLES },
  { to: "/anuarul-sportului", label: "Anuarul Sportului", icon: BookOpen },
  { to: "/muzeu", label: "Muzeu", icon: Landmark },
  { to: "/arhiva", label: "Arhivă", icon: Archive, roles: STAFF_ROLES },
  { to: "/form-builder", label: "Editor șabloane", icon: ClipboardList, roles: ADMIN_ROLES },
  { to: "/nomenclatoare", label: "Nomenclatoare", icon: ListTree, roles: ADMIN_ROLES },
  { to: "/workflow-admin", label: "Configurare flux", icon: GitBranch, roles: ADMIN_ROLES },
  { to: "/bi", label: "Business Intelligence", icon: BarChart3, roles: STAFF_ROLES },
  { to: "/admin", label: "Utilizatori", icon: Users, roles: ADMIN_ROLES },
  { to: "/audit", label: "Jurnal de audit", icon: ScrollText, roles: ["SUPER_ADMIN", "ADMIN_INSTITUTIE", "MODERATOR"] },
  { to: "/security", label: "Securitate", icon: ShieldCheck },
  { to: "/secrets", label: "Secrete", icon: KeyRound, roles: ["SUPER_ADMIN"] },
];

function SidebarItem({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <NavLink
      id={navIdForRoute(item.to)}
      to={item.to}
      end={item.to === "/"}
      title={item.label}
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

  function handleSignOut() {
    signOut();
    navigate("/login");
  }

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || (user && item.roles.includes(user.role)));

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
          padding: "0 24px",
          flexShrink: 0,
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
          <LogoMark size={30} />
          <div style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 16, letterSpacing: -0.3, color: T.ink }}>
            Platformă <span style={{ color: T.brand }}>ANS</span>{" "}
            <span style={{ color: T.ink3, fontWeight: 500, fontSize: 13 }}>· eGuvernare</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {user && (
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

      <div style={{ flex: 1, display: "flex" }}>
        {/* Sidebar slate — iconițe + etichete, colapsabil la doar-iconițe */}
        <aside
          style={{
            width: sidebarCollapsed ? 72 : 236,
            background: `linear-gradient(180deg, ${T.indigo}, ${T.indigoDark})`,
            display: "flex",
            flexDirection: "column",
            padding: "16px 0",
            gap: 2,
            flexShrink: 0,
            transition: "width .15s ease",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
            {visibleItems.map((item) => (
              <SidebarItem key={item.to} item={item} collapsed={sidebarCollapsed} />
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
                justifyContent: sidebarCollapsed ? "center" : "flex-start",
                padding: sidebarCollapsed ? "10px 0" : "10px 14px",
                borderRadius: 12,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                color: "rgba(255,255,255,0.55)",
              }}
            >
              <LogOut size={18} style={{ flexShrink: 0 }} />
              {!sidebarCollapsed && <span>Deconectare</span>}
            </div>
          </div>
        </aside>

        <main style={{ flex: 1, padding: "36px 44px", overflowX: "auto" }}>
          <div style={{ maxWidth: fullWidth ? "100%" : 1040, animation: "ansFade .25s ease" }}>
            <h1 style={{ fontSize: 29, fontWeight: 700, letterSpacing: -0.6, marginBottom: 4 }}>{title}</h1>
            {subtitle && <p style={{ color: T.ink3, fontSize: 14, marginTop: 6, marginBottom: 26 }}>{subtitle}</p>}
            {children}
          </div>
        </main>
      </div>

      <AccessibilityMenu />
      <TutorialLauncher />
    </div>
  );
}
