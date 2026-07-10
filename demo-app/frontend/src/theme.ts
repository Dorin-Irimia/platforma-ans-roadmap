// Design system preluat din repo-ul de referință "Aplicatie-mobile-stocare-informatii-autovehicule"
// (paleta de culori, fonturi, radius, spacing, umbre) — reutilizat aici pentru consistență vizuală
// între aplicații. Sursă: mobile/src/theme/index.js + components/ui.jsx din acel repo.

export const T = {
  brand: "#FF6B1A",
  brandSoft: "#ff8a47",
  brandDark: "#e85a0c",
  brandTint: "#FFF1E8",
  brandTint2: "#FFE3D1",
  ink: "#0E1116",
  ink2: "#3C4149",
  ink3: "#6A6F78",
  ink4: "#A0A5AD",
  line: "#E8E9EC",
  line2: "#F2F3F5",
  bg: "#F6F5F2",
  bgSoft: "#FBFAF8",
  card: "#FFFFFF",
  success: "#2F9E6F",
  successTint: "#E8F5EE",
  warn: "#E0A52C",
  warnTint: "#FDF6E3",
  danger: "#E0432C",
  dangerTint: "#FDECEA",
};

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 };
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 };

export const FONT = {
  display: "'Bricolage Grotesque', sans-serif", // titluri, branding
  body: "'Plus Jakarta Sans', sans-serif",       // text curent
};

export const SHADOW = {
  sm: "0 1px 4px rgba(14,17,22,0.06)",
  md: "0 2px 8px rgba(14,17,22,0.08)",
  lg: "0 4px 16px rgba(14,17,22,0.12)",
};

// Stare pe bază de zile rămase (ex: expirare viză/termen) — același tipar ca în app-ul auto.
export function statusFor(days: number | null) {
  if (days === null) return { label: "N/A", color: T.ink3, bg: T.line2 };
  if (days < 0) return { label: "Expirat", color: T.danger, bg: T.dangerTint };
  if (days <= 14) return { label: `${days}z`, color: T.danger, bg: T.dangerTint };
  if (days <= 30) return { label: `${days}z`, color: T.warn, bg: T.warnTint };
  return { label: `${days}z`, color: T.success, bg: T.successTint };
}
