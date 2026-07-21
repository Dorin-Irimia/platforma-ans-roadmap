import { Link2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { T, RADIUS, SHADOW } from "../../../theme";
import { LINK_ICONS, LinkIconKey } from "../linkIcons";

export function LinkButtonWidget({ title, config }: { title?: string | null; config?: Record<string, unknown> | null }) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const url = (config?.url as string) || "";
  const iconKey = (config?.icon as LinkIconKey) || "link";
  const Icon = LINK_ICONS[iconKey] || Link2;

  function handleClick() {
    if (!url) return;
    // URL-urile care încep cu "/" sunt rute interne ale aplicației (ex. scurtături
    // spre Registratură/BI din setul implicit) — navigăm cu router-ul, nu deschidem tab nou.
    if (url.startsWith("/")) navigate(url);
    else window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <motion.button
      onClick={handleClick}
      disabled={!url}
      whileHover={url && !reduceMotion ? { scale: 1.045, y: -3, boxShadow: SHADOW.lg } : undefined}
      whileTap={url && !reduceMotion ? { scale: 0.98 } : undefined}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 90,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        background: T.brandTint,
        border: "none",
        borderRadius: RADIUS.md,
        boxShadow: SHADOW.sm,
        cursor: url ? "pointer" : "not-allowed",
      }}
    >
      <Icon size={26} color={T.brand} />
      <span style={{ fontSize: 13, fontWeight: 700, color: T.ink }}>{title || "Legătură externă"}</span>
    </motion.button>
  );
}
