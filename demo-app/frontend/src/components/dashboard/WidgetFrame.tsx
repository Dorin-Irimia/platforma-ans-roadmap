import { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X, Pencil } from "lucide-react";
import { Card } from "../ui";
import { T } from "../../theme";
import { DashboardWidgetDto } from "../../features/dashboard/api";

const BARE_TYPES = new Set(["LINK_BUTTON", "CUSTOM_BUTTON"]);

interface Props {
  widget: DashboardWidgetDto;
  editing: boolean;
  index: number;
  onDelete: () => void;
  onEdit: () => void;
  children: ReactNode;
}

export function WidgetFrame({ widget, editing, index, onDelete, onEdit, children }: Props) {
  const bare = BARE_TYPES.has(widget.type);
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      style={{ height: "100%" }}
      initial={reduceMotion ? undefined : { opacity: 0, scale: 0.94, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ delay: reduceMotion ? 0 : index * 0.045, type: "spring", stiffness: 300, damping: 24 }}
    >
    <Card style={{ height: "100%", display: "flex", flexDirection: "column", padding: bare ? 10 : 16, position: "relative", overflow: "hidden" }}>
      {editing && (
        <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 6, zIndex: 2 }}>
          <button
            onClick={onEdit}
            title="Editează modulul"
            style={{ width: 24, height: 24, borderRadius: 999, border: "none", background: T.line2, color: T.ink2, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <Pencil size={12} />
          </button>
          <button
            onClick={onDelete}
            title="Șterge modulul"
            style={{ width: 24, height: 24, borderRadius: 999, border: "none", background: T.dangerTint, color: T.danger, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <X size={13} />
          </button>
        </div>
      )}
      {!bare && widget.title && (
        <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase", color: T.ink3, marginBottom: 10, paddingRight: editing ? 56 : 0 }}>
          {widget.title}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>{children}</div>
    </Card>
    </motion.div>
  );
}
