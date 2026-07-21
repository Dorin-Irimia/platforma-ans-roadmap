import { useCallback, useEffect, useState } from "react";
import GridLayout, { WidthProvider, Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { LayoutGrid, Plus, Check } from "lucide-react";
import { Button, SectionHeader, Skeleton } from "../ui";
import { useToast } from "../ToastProvider";
import { T } from "../../theme";
import {
  fetchWidgets,
  deleteWidget,
  updateLayout,
  DashboardWidgetDto,
} from "../../features/dashboard/api";
import { WidgetFrame } from "./WidgetFrame";
import { AddWidgetForm } from "./AddWidgetForm";
import { RecentRequestsWidget } from "./widgets/RecentRequestsWidget";
import { AccountSummaryWidget } from "./widgets/AccountSummaryWidget";
import { ChartWidget } from "./widgets/ChartWidget";
import { SavedReportWidget } from "./widgets/SavedReportWidget";
import { LinkButtonWidget } from "./widgets/LinkButtonWidget";
import { CustomButtonWidget } from "./widgets/CustomButtonWidget";
import { StatsWidget } from "./widgets/StatsWidget";
import { ActivityLogWidget } from "./widgets/ActivityLogWidget";
import { AutomationSummaryWidget } from "./widgets/AutomationSummaryWidget";

const ResponsiveGrid = WidthProvider(GridLayout);

function renderWidgetBody(widget: DashboardWidgetDto) {
  switch (widget.type) {
    case "RECENT_REQUESTS":
      return <RecentRequestsWidget config={widget.config} />;
    case "ACCOUNT_SUMMARY":
      return <AccountSummaryWidget />;
    case "CHART":
      return <ChartWidget config={widget.config} />;
    case "SAVED_REPORT":
      return <SavedReportWidget config={widget.config} />;
    case "LINK_BUTTON":
      return <LinkButtonWidget title={widget.title} config={widget.config} />;
    case "CUSTOM_BUTTON":
      return <CustomButtonWidget id={widget.id} title={widget.title} config={widget.config} hasImage={!!widget.imageStoragePath} />;
    case "STATS":
      return <StatsWidget />;
    case "ACTIVITY_LOG":
      return <ActivityLogWidget config={widget.config} />;
    case "AUTOMATION_SUMMARY":
      return <AutomationSummaryWidget />;
    default:
      return null;
  }
}

export function DashboardGrid() {
  const toast = useToast();
  const [widgets, setWidgets] = useState<DashboardWidgetDto[] | null>(null);
  const [editing, setEditing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingWidget, setEditingWidget] = useState<DashboardWidgetDto | null>(null);

  const load = useCallback(() => {
    fetchWidgets().then(setWidgets).catch(() => setWidgets([]));
  }, []);

  useEffect(load, [load]);

  async function handleDelete(id: string) {
    setWidgets((prev) => (prev ? prev.filter((w) => w.id !== id) : prev));
    await deleteWidget(id);
  }

  async function handleLayoutChange(layout: Layout[]) {
    if (!widgets) return;
    setWidgets((prev) =>
      prev
        ? prev.map((w) => {
            const l = layout.find((li) => li.i === w.id);
            return l ? { ...w, x: l.x, y: l.y, w: l.w, h: l.h } : w;
          })
        : prev
    );
  }

  async function persistLayout(layout: Layout[]) {
    await updateLayout(layout.map((l) => ({ id: l.i, x: l.x, y: l.y, w: l.w, h: l.h })));
  }

  if (!widgets) {
    return (
      <div>
        <Skeleton width={160} height={22} style={{ marginBottom: 18 }} />
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Skeleton width="calc(33.33% - 11px)" height={140} />
          <Skeleton width="calc(25% - 12px)" height={140} />
          <Skeleton width="calc(41.66% - 11px)" height={140} />
          <Skeleton width="calc(50% - 8px)" height={220} />
          <Skeleton width="calc(50% - 8px)" height={220} />
        </div>
      </div>
    );
  }

  const layout: Layout[] = widgets.map((w) => ({ i: w.id, x: w.x, y: w.y, w: w.w, h: w.h }));

  return (
    <div>
      <SectionHeader title="Panoul tău" />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 14 }}>
        {editing && (
          <Button variant="ghost" onClick={() => { setEditingWidget(null); setFormOpen(true); }} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={15} /> Adaugă modul
          </Button>
        )}
        <Button variant={editing ? "primary" : "ghost"} onClick={() => setEditing((e) => !e)} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {editing ? <Check size={15} /> : <LayoutGrid size={15} />}
          {editing ? "Gata" : "Editează panoul"}
        </Button>
      </div>

      {widgets.length === 0 && !editing && (
        <div style={{ color: T.ink3, fontSize: 13, padding: "20px 0" }}>
          Panoul tău e gol deocamdată. Apasă „Editează panoul" ca să adaugi module.
        </div>
      )}

      <ResponsiveGrid
        className="ans-dashboard-grid"
        layout={layout}
        cols={12}
        rowHeight={64}
        margin={[16, 16]}
        isDraggable={editing}
        isResizable={editing}
        onLayoutChange={handleLayoutChange}
        onDragStop={(l) => persistLayout(l)}
        onResizeStop={(l) => persistLayout(l)}
      >
        {widgets.map((w, i) => (
          <div key={w.id}>
            <WidgetFrame
              widget={w}
              editing={editing}
              index={i}
              onDelete={() => handleDelete(w.id)}
              onEdit={() => { setEditingWidget(w); setFormOpen(true); }}
            >
              {renderWidgetBody(w)}
            </WidgetFrame>
          </div>
        ))}
      </ResponsiveGrid>

      {formOpen && (
        <AddWidgetForm
          widget={editingWidget}
          existingWidgets={widgets}
          onClose={() => setFormOpen(false)}
          onSaved={(w) => {
            setFormOpen(false);
            toast.success(editingWidget ? "Modul actualizat." : "Modul adăugat.");
            setWidgets((prev) => {
              if (!prev) return [w];
              const exists = prev.some((x) => x.id === w.id);
              return exists ? prev.map((x) => (x.id === w.id ? w : x)) : [...prev, w];
            });
          }}
        />
      )}
    </div>
  );
}
