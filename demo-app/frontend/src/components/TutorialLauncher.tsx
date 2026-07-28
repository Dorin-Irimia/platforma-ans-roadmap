import { useEffect, useRef, useState } from "react";
import { Compass, Play } from "lucide-react";
import { T, RADIUS, SHADOW } from "../theme";
import { useTutorial } from "../features/tutorial/TutorialContext";
import { useIsMobile } from "../lib/useMediaQuery";

// Buton plutitor „Tur ghidat” — același tipar ca `AccessibilityMenu` (buton fix,
// panou care se închide la click în afara lui), plasat lângă acesta fără suprapunere.
export function TutorialLauncher() {
  const isMobile = useIsMobile();
  const { availableTours, startTour } = useTutorial();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleStart(id: string) {
    startTour(id);
    setOpen(false);
  }

  return (
    <div ref={panelRef} style={{ position: "fixed", bottom: isMobile ? 86 : 24, right: isMobile ? 72 : 88, zIndex: 50 }}>
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: 64,
            right: 0,
            width: 280,
            background: T.card,
            borderRadius: RADIUS.card,
            border: `1px solid ${T.line}`,
            boxShadow: SHADOW.lg,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: T.ink3, marginBottom: 10 }}>
            Tururi ghidate
          </div>
          {availableTours.length === 0 && (
            <p style={{ fontSize: 13, color: T.ink3, margin: 0 }}>Niciun tur disponibil pentru rolul tău.</p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {availableTours.map((tour) => (
              <button
                key={tour.id}
                onClick={() => handleStart(tour.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: 10,
                  border: "none",
                  background: T.line2,
                  color: T.ink,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {tour.label}
                <Play size={13} color={T.brand} />
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        title="Tur ghidat"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 52,
          height: 52,
          borderRadius: 999,
          border: "none",
          background: T.indigo,
          color: "#fff",
          boxShadow: SHADOW.lg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <Compass size={22} />
      </button>
    </div>
  );
}
