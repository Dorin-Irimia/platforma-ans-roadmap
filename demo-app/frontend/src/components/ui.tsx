import { CSSProperties, ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { T, RADIUS, FONT, SHADOW } from "../theme";

// Primitive UI comune, în același spirit vizual ca appul de referință
// (Aplicatie-mobile-stocare-informatii-autovehicule): carduri albe rotunjite
// pe fundal bej-deschis, accent portocaliu (brand), tipografie Bricolage/Jakarta.

export function Card({ children, style = {}, padded = true, onClick, id }: { children: ReactNode; style?: CSSProperties; padded?: boolean; onClick?: () => void; id?: string }) {
  const reduceMotion = useReducedMotion();
  const baseStyle: CSSProperties = {
    background: T.card,
    borderRadius: RADIUS.card,
    padding: padded ? 18 : 0,
    border: `1px solid ${T.line}`,
    boxShadow: SHADOW.sm,
    ...style,
  };

  // Doar cardurile clickabile primesc hover animat — un card static nu are
  // niciun motiv vizual să reacționeze la mouse.
  if (onClick && !reduceMotion) {
    return (
      <motion.div id={id} onClick={onClick} style={baseStyle} whileHover={{ y: -2, boxShadow: SHADOW.md }} transition={{ duration: 0.15 }}>
        {children}
      </motion.div>
    );
  }
  return (
    <div id={id} onClick={onClick} style={baseStyle}>
      {children}
    </div>
  );
}

// Marca grafică — trei forme portocalii (bară late jos, bară semitransparentă,
// cerc sus) evocând un podium/munte stilizat, lângă wordmark-ul "Platformă ANS".
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      <rect x={14} y={82} width={92} height={20} rx={10} fill={T.brand} />
      <rect x={34} y={54} width={52} height={10} rx={5} fill={T.brand} opacity={0.55} />
      <circle cx={60} cy={30} r={5} fill={T.brand} />
    </svg>
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

export const ROLE_COLORS: Record<string, { color: string; bg: string }> = {
  SUPER_ADMIN: { color: T.brandDark, bg: T.brandTint },
  ADMIN_INSTITUTIE: { color: T.brandDark, bg: T.brandTint },
  MODERATOR: { color: T.warn, bg: T.warnTint },
  EVALUATOR: { color: T.success, bg: T.successTint },
};

export function RolePill({ role }: { role: string }) {
  const style = ROLE_COLORS[role] || { color: T.ink3, bg: T.line2 };
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
  disabled = false,
  id,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "ghost" | "danger";
  style?: CSSProperties;
  disabled?: boolean;
  id?: string;
}) {
  const reduceMotion = useReducedMotion();
  const base: CSSProperties = {
    fontFamily: FONT.body,
    fontWeight: 700,
    fontSize: 14,
    borderRadius: RADIUS.md,
    padding: "11px 18px",
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
  };
  const variants: Record<string, CSSProperties> = {
    primary: { background: T.brand, color: "#fff", boxShadow: "0 6px 16px rgba(255,107,26,0.40)" },
    ghost: { background: T.line2, color: T.ink2 },
    danger: { background: T.dangerTint, color: T.danger },
  };
  return (
    <motion.button
      id={id}
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}
      whileHover={!disabled && !reduceMotion ? { scale: 1.03 } : undefined}
      whileTap={!disabled && !reduceMotion ? { scale: 0.97 } : undefined}
      transition={{ duration: 0.12 }}
    >
      {children}
    </motion.button>
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

// Placeholder de încărcare cu shimmer — animația e un `@keyframes` CSS (`.skeleton`
// în index.css), mai ieftin decât framer-motion pentru o buclă continuă; respectă
// `prefers-reduced-motion` (definit tot acolo).
export function Skeleton({ width = "100%", height = 16, borderRadius = RADIUS.sm, style = {} }: { width?: number | string; height?: number | string; borderRadius?: number; style?: CSSProperties }) {
  return <div className="skeleton" style={{ width, height, borderRadius, ...style }} />;
}
