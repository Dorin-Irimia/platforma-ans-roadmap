// Design system aliniat la platforma de referință URBIO (eGovernance / case
// management pentru administrație publică locală): sidebar slate închis icon+etichetă,
// CTA portocaliu solid, carduri rotunjite pe fundal alb, badge-uri semantice pill.

export const T = {
  // Slate închis — sidebar, avatar, card hero dashboard, elemente structurale întunecate.
  indigo: "#172027",
  indigoDark: "#0E1116",
  indigoSoft: "#2A343D",
  indigoTint: "#E7E9EA",

  // Portocaliu — CTA principal (butoane "Adaugă X", accesibilitate).
  brand: "#FF6B1A",
  brandSoft: "#ff8a4d",
  brandDark: "#e85a0c",
  brandTint: "#FFF1E8",
  brandTint2: "#FCD9CB",

  ink: "#0E1116",
  ink2: "#3C4149",
  ink3: "#6A6F78",
  ink4: "#A0A5AD",
  line: "#E8E9EC",
  line2: "#F2F3F5",
  bg: "#F6F5F2",
  bgSoft: "#FBFAF8",
  card: "#FFFFFF",

  // Stări semantice (badge-uri pill) — aliniate cu convenția URBIO:
  // verde = finalizat/aprobat, albastru = în verificare, galben = incomplet/în așteptare,
  // mov = în progres, roșu = respins/anulat.
  success: "#2F9E6F",
  successTint: "#E8F5EE",
  info: "#0369A1",
  infoTint: "#E0F2FE",
  warn: "#E0A52C",
  warnTint: "#FDF6E3",
  progress: "#7C3AED",
  progressTint: "#F1EAFD",
  danger: "#E0432C",
  dangerTint: "#FDECEA",
};

export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 24, full: 999, card: 16 };
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

// Stare pe bază de zile rămase (ex: expirare viză/termen).
export function statusFor(days: number | null) {
  if (days === null) return { label: "N/A", color: T.ink3, bg: T.line2 };
  if (days < 0) return { label: "Expirat", color: T.danger, bg: T.dangerTint };
  if (days <= 14) return { label: `${days}z`, color: T.danger, bg: T.dangerTint };
  if (days <= 30) return { label: `${days}z`, color: T.warn, bg: T.warnTint };
  return { label: `${days}z`, color: T.success, bg: T.successTint };
}
