import { useEffect, useState, CSSProperties } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useTutorial } from "../features/tutorial/TutorialContext";
import { T, RADIUS, SHADOW } from "../theme";

const POLL_INTERVAL_MS = 300;

// Spotlight + tooltip pentru turul ghidat. Montat o singură dată în `App.tsx` (nu în
// `AppShell.tsx` — trebuie să funcționeze și pe pagini fără sidebar, ex. Login/Register,
// unde se demonstrează RoEID/înregistrare cont). Dacă elementul țintă al unui pas nu e
// (încă) în DOM — rol care nu-l vede, sau ecran/tab nedeschis încă — NU sărim pasul
// automat (cerință explicită: nimic nu trebuie omis din secvență). În schimb arătăm
// textul explicativ fără inel de spotlight, și continuăm să căutăm elementul în fundal;
// dacă apare (userul a deschis tab-ul/ecranul cerut), spotlight-ul apare imediat.
export function TutorialOverlay() {
  const { activeTour, steps, stepIndex, next, prev, stop } = useTutorial();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = steps[stepIndex] ?? null;
  const isGap = !!step?.gap || !step?.targetId;

  useEffect(() => {
    if (!step || isGap) {
      setRect(null);
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function poll() {
      if (cancelled) return;
      const el = document.getElementById(step!.targetId);
      if (el) {
        setRect(el.getBoundingClientRect());
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      } else {
        setRect(null);
      }
      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }
    setRect(null);
    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [step?.targetId, isGap]);

  useEffect(() => {
    if (!step || isGap) return;
    function recompute() {
      const el = document.getElementById(step!.targetId);
      if (el) setRect(el.getBoundingClientRect());
    }
    window.addEventListener("resize", recompute);
    window.addEventListener("scroll", recompute, true);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("scroll", recompute, true);
    };
  }, [step?.targetId, isGap]);

  if (!activeTour || !step) return null;

  const showSpotlight = !isGap && !!rect;
  const TOOLTIP_WIDTH = 320;
  const isLast = stepIndex === steps.length - 1;

  let tooltipStyle: CSSProperties;
  if (showSpotlight && rect) {
    const showBelow = window.innerHeight - rect.bottom > 170;
    tooltipStyle = {
      position: "fixed",
      top: showBelow ? rect.bottom + 14 : undefined,
      bottom: !showBelow ? window.innerHeight - rect.top + 14 : undefined,
      left: Math.min(Math.max(rect.left, 16), window.innerWidth - TOOLTIP_WIDTH - 16),
      width: TOOLTIP_WIDTH,
    };
  } else {
    // Fără element de arătat (gap, sau nu e încă vizibil pentru starea curentă a paginii) —
    // tooltip ancorat central-jos, mereu vizibil, indiferent de conținutul paginii.
    tooltipStyle = {
      position: "fixed",
      bottom: 24,
      left: "50%",
      transform: "translateX(-50%)",
      width: TOOLTIP_WIDTH,
    };
  }

  return (
    <>
      {showSpotlight && rect && (
        <div
          style={{
            position: "fixed",
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            borderRadius: RADIUS.md,
            boxShadow: "0 0 0 9999px rgba(14,17,22,0.6)",
            zIndex: 200,
            pointerEvents: "none",
            transition: "top .2s ease, left .2s ease, width .2s ease, height .2s ease",
          }}
        />
      )}
      <div
        style={{
          ...tooltipStyle,
          background: T.card,
          borderRadius: RADIUS.card,
          border: `1px solid ${T.line}`,
          boxShadow: SHADOW.lg,
          padding: 18,
          zIndex: 201,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: T.brand }}>
            {activeTour.label} · {stepIndex + 1}/{steps.length}
          </div>
          <button onClick={stop} title="Închide turul" style={{ background: "none", border: "none", cursor: "pointer", color: T.ink3, padding: 0 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 6 }}>{step.title}</div>
        <p style={{ fontSize: 13, color: T.ink2, lineHeight: 1.5, margin: "0 0 16px" }}>{step.description}</p>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <button
            onClick={prev}
            disabled={stepIndex === 0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              background: "none",
              border: "none",
              cursor: stepIndex === 0 ? "default" : "pointer",
              opacity: stepIndex === 0 ? 0.4 : 1,
              color: T.ink2,
              fontSize: 13,
              fontWeight: 600,
              padding: 0,
            }}
          >
            <ChevronLeft size={14} /> Înapoi
          </button>
          <button
            onClick={next}
            style={{ display: "flex", alignItems: "center", gap: 4, background: T.brand, color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, padding: "8px 14px" }}
          >
            {isLast ? "Am înțeles" : "Următorul"} {!isLast && <ChevronRight size={14} />}
          </button>
        </div>
      </div>
    </>
  );
}
