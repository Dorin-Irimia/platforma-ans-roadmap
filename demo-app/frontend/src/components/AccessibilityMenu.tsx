import { useEffect, useRef, useState } from "react";
import { Accessibility, Minus, Plus, RotateCcw } from "lucide-react";
import { T, RADIUS, SHADOW } from "../theme";
import { useIsMobile } from "../lib/useMediaQuery";

const ZOOM_KEY = "ans_demo_a11y_zoom";
const CONTRAST_KEY = "ans_demo_a11y_contrast";
const VOICE_RATE_KEY = "ans_demo_a11y_voice_rate";
const ZOOM_STEPS = [1, 1.1, 1.25, 1.4];
const VOICE_RATE_STEPS = [0.75, 1, 1.25, 1.5, 2];

function applyZoom(zoom: number) {
  document.body.style.zoom = String(zoom);
  localStorage.setItem(ZOOM_KEY, String(zoom));
}

function applyContrast(high: boolean) {
  document.documentElement.setAttribute("data-contrast", high ? "high" : "normal");
  localStorage.setItem(CONTRAST_KEY, String(high));
}

// Preferință globală de viteză a vocii — citită de TextAudioControls (LessonBlocksView.tsx)
// la fiecare redare/descărcare, ca să se aplice atât la "Ascultă" (Web Speech API live),
// cât și la fișierul .wav generat pe server (espeak-ng), fără să fie nevoie de un control
// separat per fragment de text — o singură setare, valabilă peste tot în platformă.
export function getVoiceRate(): number {
  const stored = Number(localStorage.getItem(VOICE_RATE_KEY));
  return VOICE_RATE_STEPS.includes(stored) ? stored : 1;
}

function applyVoiceRate(rate: number) {
  localStorage.setItem(VOICE_RATE_KEY, String(rate));
}

// Se aplică o singură dată la încărcarea aplicației, din valorile salvate — altfel
// preferința de accesibilitate s-ar reseta la fiecare navigare/reload.
export function initAccessibilityPreferences() {
  const savedZoom = Number(localStorage.getItem(ZOOM_KEY)) || 1;
  const savedContrast = localStorage.getItem(CONTRAST_KEY) === "true";
  applyZoom(savedZoom);
  applyContrast(savedContrast);
}

// Panou real de accesibilitate — mărire text (zoom, reflow real, nu doar transform)
// și contrast ridicat (culori/borduri întărite, definite în index.css). Funcționează
// cel mai bine în Chrome/Edge (proprietatea CSS `zoom` nu are suport complet Firefox),
// aceeași constrângere deja documentată pentru Web Speech API în acest proiect.
export function AccessibilityMenu() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState(() => Number(localStorage.getItem(ZOOM_KEY)) || 1);
  const [contrast, setContrast] = useState(() => localStorage.getItem(CONTRAST_KEY) === "true");
  const [voiceRate, setVoiceRate] = useState(getVoiceRate);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function changeZoom(delta: 1 | -1) {
    const idx = ZOOM_STEPS.indexOf(zoom);
    const nextIdx = Math.min(ZOOM_STEPS.length - 1, Math.max(0, (idx === -1 ? 0 : idx) + delta));
    const next = ZOOM_STEPS[nextIdx];
    setZoom(next);
    applyZoom(next);
  }

  function toggleContrast() {
    const next = !contrast;
    setContrast(next);
    applyContrast(next);
  }

  function changeVoiceRate(delta: 1 | -1) {
    const idx = VOICE_RATE_STEPS.indexOf(voiceRate);
    const nextIdx = Math.min(VOICE_RATE_STEPS.length - 1, Math.max(0, (idx === -1 ? 1 : idx) + delta));
    const next = VOICE_RATE_STEPS[nextIdx];
    setVoiceRate(next);
    applyVoiceRate(next);
  }

  function reset() {
    setZoom(1);
    setContrast(false);
    setVoiceRate(1);
    applyZoom(1);
    applyContrast(false);
    applyVoiceRate(1);
  }

  return (
    <div ref={panelRef} style={{ position: "fixed", bottom: isMobile ? 86 : 24, right: isMobile ? 12 : 24, zIndex: 50 }}>
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: 64,
            right: 0,
            width: 240,
            background: T.card,
            borderRadius: RADIUS.card,
            border: `1px solid ${T.line}`,
            boxShadow: SHADOW.lg,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: T.ink3, marginBottom: 10 }}>
            Accesibilitate
          </div>

          <div style={{ fontSize: 13, color: T.ink2, marginBottom: 8 }}>Mărime text</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => changeZoom(-1)}
              disabled={zoom === ZOOM_STEPS[0]}
              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.line}`, background: T.line2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: zoom === ZOOM_STEPS[0] ? 0.5 : 1 }}
            >
              <Minus size={14} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 700, minWidth: 40, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => changeZoom(1)}
              disabled={zoom === ZOOM_STEPS[ZOOM_STEPS.length - 1]}
              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.line}`, background: T.line2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: zoom === ZOOM_STEPS[ZOOM_STEPS.length - 1] ? 0.5 : 1 }}
            >
              <Plus size={14} />
            </button>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.ink2, marginBottom: 16, cursor: "pointer" }}>
            <input type="checkbox" checked={contrast} onChange={toggleContrast} /> Contrast ridicat
          </label>

          <div style={{ fontSize: 13, color: T.ink2, marginBottom: 8 }}>Viteza vocii (Text-to-Speech)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <button
              onClick={() => changeVoiceRate(-1)}
              disabled={voiceRate === VOICE_RATE_STEPS[0]}
              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.line}`, background: T.line2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: voiceRate === VOICE_RATE_STEPS[0] ? 0.5 : 1 }}
            >
              <Minus size={14} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 700, minWidth: 40, textAlign: "center" }}>{voiceRate}x</span>
            <button
              onClick={() => changeVoiceRate(1)}
              disabled={voiceRate === VOICE_RATE_STEPS[VOICE_RATE_STEPS.length - 1]}
              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.line}`, background: T.line2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", opacity: voiceRate === VOICE_RATE_STEPS[VOICE_RATE_STEPS.length - 1] ? 0.5 : 1 }}
            >
              <Plus size={14} />
            </button>
          </div>

          <button
            onClick={reset}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: T.line2, border: "none", borderRadius: 8, padding: "8px 0", fontSize: 12.5, fontWeight: 700, color: T.ink2, cursor: "pointer" }}
          >
            <RotateCcw size={12} /> Resetează
          </button>
        </div>
      )}

      <button
        title="Accesibilitate"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 52,
          height: 52,
          borderRadius: 999,
          border: "none",
          background: T.brand,
          color: "#fff",
          boxShadow: "0 8px 20px rgba(255,107,26,0.40)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <Accessibility size={22} />
      </button>
    </div>
  );
}
