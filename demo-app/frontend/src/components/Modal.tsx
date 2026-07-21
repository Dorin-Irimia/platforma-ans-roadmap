import { ReactNode, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

// Component comun de modal — standardizează backdrop-ul (opacitate/z-index erau
// inconsistente între pagini: 0.45/0.5/0.6, 100/110) și adaugă animație de intrare +
// închidere la click în afară / Escape (câteva modale nu aveau asta azi). Animația de
// ieșire la închidere rămâne instantă (dispariția e condiționată de state-ul părintelui,
// `{show && <Modal>...}`) — doar intrarea e animată, ca să nu fie nevoie să schimbăm
// tiparul de randare condiționată din fiecare pagină care folosește Modal.
export function Modal({
  onClose,
  width = 460,
  maxHeight,
  children,
}: {
  onClose: () => void;
  width?: number | string;
  maxHeight?: string;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <motion.div
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.15 }}
      style={{ position: "fixed", inset: 0, background: "rgba(14,17,22,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={reduceMotion ? undefined : { opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.18 }}
        style={{ width, maxHeight, overflowY: maxHeight ? "auto" : undefined }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
