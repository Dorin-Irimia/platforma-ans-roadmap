import { motion, useReducedMotion } from "framer-motion";
import { T } from "../../theme";

function greetingForHour(hour: number): string {
  if (hour < 12) return "Bună dimineața";
  if (hour < 18) return "Bună ziua";
  return "Bună seara";
}

function todayLabel(): string {
  const raw = new Intl.DateTimeFormat("ro-RO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function DashboardHero({ name }: { name: string }) {
  const reduceMotion = useReducedMotion();
  const greeting = greetingForHour(new Date().getHours());

  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ marginBottom: 28 }}
    >
      <div style={{ fontSize: 12, letterSpacing: 2, textTransform: "uppercase", color: T.ink3, fontWeight: 700, marginBottom: 8 }}>
        {todayLabel()}
      </div>
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 38,
          fontWeight: 700,
          letterSpacing: -0.8,
          margin: 0,
          textWrap: "balance" as any,
          background: `linear-gradient(90deg, ${T.ink} 0%, ${T.ink} 55%, ${T.brand} 100%)`,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        {greeting}, {name}
      </h1>
      <div style={{ width: 56, height: 3, borderRadius: 2, background: `linear-gradient(90deg, ${T.brand}, ${T.brandSoft})`, margin: "14px 0 0" }} />
      <p style={{ color: T.ink3, fontSize: 14, marginTop: 12, marginBottom: 0 }}>
        Platforma digitală integrată — Agenția Națională pentru Sport
      </p>
    </motion.div>
  );
}
