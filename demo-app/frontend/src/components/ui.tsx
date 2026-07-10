import { CSSProperties, ReactNode } from "react";
import { T, RADIUS, FONT, SHADOW } from "../theme";

// Primitive UI comune, în același spirit vizual ca appul de referință
// (Aplicatie-mobile-stocare-informatii-autovehicule): carduri albe rotunjite
// pe fundal bej-deschis, accent portocaliu (brand), tipografie Bricolage/Jakarta.

export function Card({ children, style = {}, padded = true }: { children: ReactNode; style?: CSSProperties; padded?: boolean }) {
  return (
    <div
      style={{
        background: T.card,
        borderRadius: RADIUS.xl,
        padding: padded ? 18 : 0,
        border: `1px solid ${T.line}`,
        boxShadow: SHADOW.sm,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Pill({ children, color = T.ink3, bg = T.line2, style = {} }: { children: ReactNode; color?: string; bg?: string; style?: CSSProperties }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        borderRadius: RADIUS.full,
        background: bg,
        color,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.4,
        textTransform: "uppercase",
        ...style,
      }}
    >
      {children}
    </span>
  );
}

export function RolePill({ role }: { role: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    SUPER_ADMIN: { color: T.brandDark, bg: T.brandTint },
    ADMIN_INSTITUTIE: { color: T.brandDark, bg: T.brandTint },
    MODERATOR: { color: T.warn, bg: T.warnTint },
    EVALUATOR: { color: T.success, bg: T.successTint },
  };
  const style = map[role] || { color: T.ink3, bg: T.line2 };
  return <Pill color={style.color} bg={style.bg}>{role.replace(/_/g, " ")}</Pill>;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.6, textTransform: "uppercase", color: T.ink3 }}>
        {title}
      </div>
      {action && (
        <div onClick={onAction} style={{ fontSize: 13, color: T.brand, fontWeight: 600, cursor: "pointer" }}>
          {action}
        </div>
      )}
    </div>
  );
}

export function Button({
  children,
  onClick,
  type = "button",
  variant = "primary",
  style = {},
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "ghost" | "danger";
  style?: CSSProperties;
}) {
  const base: CSSProperties = {
    fontFamily: FONT.body,
    fontWeight: 700,
    fontSize: 14,
    borderRadius: RADIUS.md,
    padding: "11px 18px",
    border: "none",
    cursor: "pointer",
    transition: "transform .1s ease",
  };
  const variants: Record<string, CSSProperties> = {
    primary: { background: `linear-gradient(180deg, ${T.brandSoft}, ${T.brand})`, color: "#fff", boxShadow: "0 6px 16px rgba(255,107,26,0.28)" },
    ghost: { background: T.line2, color: T.ink2 },
    danger: { background: T.dangerTint, color: T.danger },
  };
  return (
    <button type={type} onClick={onClick} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

export function PageShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: T.bg, fontFamily: FONT.body }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>{title}</h1>
        {subtitle && <p style={{ color: T.ink3, marginTop: 0, marginBottom: 28 }}>{subtitle}</p>}
        {children}
      </div>
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
      {children}
    </label>
  );
}
