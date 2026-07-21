import { createContext, useCallback, useContext, useRef, useState, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from "lucide-react";
import { T, RADIUS, SHADOW } from "../theme";

type ToastVariant = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: string;
  variant: ToastVariant;
  message: string;
  duration: number;
}

interface ToastAPI {
  success: (message: string, opts?: { duration?: number }) => string;
  error: (message: string, opts?: { duration?: number }) => string;
  info: (message: string, opts?: { duration?: number }) => string;
  warning: (message: string, opts?: { duration?: number }) => string;
  dismiss: (id: string) => void;
}

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 4000,
  info: 4000,
  warning: 5000,
  error: 6000,
};

const VARIANT_META: Record<ToastVariant, { icon: typeof CheckCircle2; color: string; tint: string }> = {
  success: { icon: CheckCircle2, color: T.success, tint: T.successTint },
  error: { icon: XCircle, color: T.danger, tint: T.dangerTint },
  info: { icon: Info, color: T.info, tint: T.infoTint },
  warning: { icon: AlertTriangle, color: T.warn, tint: T.warnTint },
};

const ToastContext = createContext<ToastAPI | undefined>(undefined);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

function genId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `toast-${Math.random().toString(36).slice(2)}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, { timeoutId: ReturnType<typeof setTimeout>; remaining: number; startedAt: number }>>(new Map());
  const reduceMotion = useReducedMotion();

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer.timeoutId);
      timers.current.delete(id);
    }
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const schedule = useCallback(
    (id: string, remaining: number) => {
      const timeoutId = setTimeout(() => dismiss(id), remaining);
      timers.current.set(id, { timeoutId, remaining, startedAt: Date.now() });
    },
    [dismiss]
  );

  const push = useCallback(
    (variant: ToastVariant, message: string, opts?: { duration?: number }) => {
      const id = genId();
      const duration = opts?.duration ?? DEFAULT_DURATION[variant];
      setItems((prev) => [...prev, { id, variant, message, duration }]);
      schedule(id, duration);
      return id;
    },
    [schedule]
  );

  const pause = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (!timer) return;
    clearTimeout(timer.timeoutId);
    const elapsed = Date.now() - timer.startedAt;
    timers.current.set(id, { ...timer, remaining: Math.max(0, timer.remaining - elapsed) });
  }, []);

  const resume = useCallback(
    (id: string) => {
      const timer = timers.current.get(id);
      if (!timer) return;
      schedule(id, timer.remaining);
    },
    [schedule]
  );

  const api: ToastAPI = {
    success: (message, opts) => push("success", message, opts),
    error: (message, opts) => push("error", message, opts),
    info: (message, opts) => push("info", message, opts),
    warning: (message, opts) => push("warning", message, opts),
    dismiss,
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div style={{ position: "fixed", top: 76, right: 24, zIndex: 300, display: "flex", flexDirection: "column", gap: 10, width: 340, maxWidth: "calc(100vw - 48px)" }}>
        <AnimatePresence mode="popLayout">
          {items.map((item) => {
            const meta = VARIANT_META[item.variant];
            const Icon = meta.icon;
            return (
              <motion.div
                key={item.id}
                layout
                initial={reduceMotion ? undefined : { opacity: 0, x: 24, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.96 }}
                transition={{ duration: reduceMotion ? 0 : 0.18 }}
                onMouseEnter={() => pause(item.id)}
                onMouseLeave={() => resume(item.id)}
                style={{
                  background: T.card,
                  borderRadius: RADIUS.md,
                  border: `1px solid ${T.line}`,
                  boxShadow: SHADOW.lg,
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  borderLeft: `3px solid ${meta.color}`,
                }}
              >
                <Icon size={18} color={meta.color} style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ margin: 0, fontSize: 13.5, color: T.ink2, flex: 1, lineHeight: 1.4 }}>{item.message}</p>
                <button
                  onClick={() => dismiss(item.id)}
                  aria-label="Închide"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: T.ink3, flexShrink: 0 }}
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
