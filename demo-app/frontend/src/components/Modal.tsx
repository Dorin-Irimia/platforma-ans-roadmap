import { ReactNode, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

// Component comun de modal — standardizează backdrop-ul (opacitate/z-index erau
// inconsistente între pagini: 0.45/0.5/0.6, 100/110) și adaugă animație reală de
// deschidere ȘI închidere (stil macOS "Scale": spring bounce la deschidere, fade+scale-
// down rapid la închidere), plus închidere la click în afară / Escape. Randare
// necondiționată la fiecare loc de apel (`<Modal isOpen={cond}>...`) — condiția intră
// ca prop, nu mai controlează montarea/demontarea direct, ca AnimatePresence să poată
// reda animația de ieșire înainte de demontare.
export function Modal({
  isOpen,
  onClose,
  width = 460,
  maxHeight,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  width?: number | string;
  maxHeight?: string;
  children: ReactNode;
}) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.15 }}
          style={{ position: "fixed", inset: 0, background: "rgba(14,17,22,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={reduceMotion ? undefined : { opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 6 }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 340, damping: 22 }}
            style={{ width, maxHeight, overflowY: maxHeight ? "auto" : undefined }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
