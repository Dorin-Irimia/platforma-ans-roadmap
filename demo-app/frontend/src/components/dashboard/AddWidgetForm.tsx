import { useEffect, useState } from "react";
import { Card, SectionHeader, FieldLabel, Button } from "../ui";
import { Modal } from "../Modal";
import { T } from "../../theme";
import { createWidget, updateWidget, DashboardWidgetDto, DashboardWidgetType, WidgetFormInput } from "../../features/dashboard/api";
import { fetchSavedReports, BiSavedReportDto } from "../../features/bi/api";
import { LINK_ICONS, LinkIconKey } from "./linkIcons";

const TYPE_LABELS: Record<DashboardWidgetType, string> = {
  RECENT_REQUESTS: "Cereri recente",
  ACCOUNT_SUMMARY: "Rezumat cont",
  CHART: "Grafic BI",
  SAVED_REPORT: "Raport salvat",
  LINK_BUTTON: "Buton către un site",
  CUSTOM_BUTTON: "Buton personalizat (imagine + link)",
  STATS: "Indicatori rapizi",
  ACTIVITY_LOG: "Jurnal de activitate",
  AUTOMATION_SUMMARY: "Automatizări active",
};

const DEFAULT_SIZE: Record<DashboardWidgetType, { w: number; h: number }> = {
  RECENT_REQUESTS: { w: 4, h: 5 },
  ACCOUNT_SUMMARY: { w: 3, h: 4 },
  CHART: { w: 5, h: 5 },
  SAVED_REPORT: { w: 5, h: 5 },
  LINK_BUTTON: { w: 3, h: 2 },
  CUSTOM_BUTTON: { w: 3, h: 2 },
  STATS: { w: 12, h: 3 },
  ACTIVITY_LOG: { w: 6, h: 6 },
  AUTOMATION_SUMMARY: { w: 12, h: 4 },
};

interface Props {
  widget: DashboardWidgetDto | null;
  existingWidgets: DashboardWidgetDto[];
  onClose: () => void;
  onSaved: (widget: DashboardWidgetDto) => void;
}

export function AddWidgetForm({ widget, existingWidgets, onClose, onSaved }: Props) {
  const isEdit = !!widget;
  const [type, setType] = useState<DashboardWidgetType>(widget?.type || "RECENT_REQUESTS");
  const [title, setTitle] = useState(widget?.title || "");
  const [limit, setLimit] = useState(Number(widget?.config?.limit) || 5);
  const [source, setSource] = useState((widget?.config?.source as string) || "documents");
  const [reportId, setReportId] = useState((widget?.config?.reportId as string) || "");
  const [reports, setReports] = useState<BiSavedReportDto[]>([]);
  const [url, setUrl] = useState((widget?.config?.url as string) || "");
  const [iconKey, setIconKey] = useState<LinkIconKey>((widget?.config?.icon as LinkIconKey) || "link");
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (type === "SAVED_REPORT") {
      fetchSavedReports().then(setReports).catch(() => setReports([]));
    }
  }, [type]);

  function buildConfig(): Record<string, unknown> {
    switch (type) {
      case "RECENT_REQUESTS":
      case "ACTIVITY_LOG":
        return { limit };
      case "CHART":
        return { source };
      case "SAVED_REPORT":
        return { reportId };
      case "LINK_BUTTON":
        return { url, icon: iconKey };
      case "CUSTOM_BUTTON":
        return { url };
      default:
        return {};
    }
  }

  async function handleSave() {
    if (type === "CUSTOM_BUTTON" && !url.trim()) {
      setError("URL-ul este obligatoriu");
      return;
    }
    if (type === "CUSTOM_BUTTON" && !isEdit && !image) {
      setError("Încarcă o imagine pentru butonul personalizat");
      return;
    }
    if (type === "LINK_BUTTON" && !url.trim()) {
      setError("URL-ul este obligatoriu");
      return;
    }
    if (type === "SAVED_REPORT" && !reportId) {
      setError("Alege un raport salvat");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payload: WidgetFormInput = {
        type,
        title: title.trim() || undefined,
        config: buildConfig(),
        image,
      };
      let saved: DashboardWidgetDto;
      if (isEdit) {
        saved = await updateWidget(widget!.id, payload);
      } else {
        const size = DEFAULT_SIZE[type];
        const nextY = existingWidgets.reduce((max, w) => Math.max(max, w.y + w.h), 0);
        saved = await createWidget({ ...payload, x: 0, y: nextY, w: size.w, h: size.h });
      }
      onSaved(saved);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Nu am putut salva modulul");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} width={480} maxHeight="88vh">
        <Card>
          <SectionHeader title={isEdit ? "Editează modulul" : "Adaugă modul nou"} />

          {!isEdit && (
            <>
              <FieldLabel>Tip modul</FieldLabel>
              <select value={type} onChange={(e) => setType(e.target.value as DashboardWidgetType)} style={{ width: "100%", marginBottom: 12 }}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </>
          )}

          {type !== "LINK_BUTTON" && type !== "CUSTOM_BUTTON" && (
            <>
              <FieldLabel>Titlu (opțional)</FieldLabel>
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", marginBottom: 12 }} placeholder="ex: Cererile mele" />
            </>
          )}

          {(type === "RECENT_REQUESTS" || type === "ACTIVITY_LOG") && (
            <>
              <FieldLabel>{type === "RECENT_REQUESTS" ? "Număr de cereri afișate" : "Număr de evenimente afișate"}</FieldLabel>
              <input type="number" min={1} max={20} value={limit} onChange={(e) => setLimit(Number(e.target.value) || 5)} style={{ width: "100%", marginBottom: 12 }} />
            </>
          )}

          {type === "CHART" && (
            <>
              <FieldLabel>Sursă date</FieldLabel>
              <select value={source} onChange={(e) => setSource(e.target.value)} style={{ width: "100%", marginBottom: 12 }}>
                <option value="documents">Documente</option>
                <option value="compliance">Conformitate termene</option>
                <option value="workload">Încărcare pe utilizator</option>
              </select>
            </>
          )}

          {type === "SAVED_REPORT" && (
            <>
              <FieldLabel>Raport salvat</FieldLabel>
              <select value={reportId} onChange={(e) => setReportId(e.target.value)} style={{ width: "100%", marginBottom: 12 }}>
                <option value="">Alege un raport...</option>
                {reports.map((r) => (
                  <option key={r.id} value={r.id}>{r.title}</option>
                ))}
              </select>
              {reports.length === 0 && <p style={{ fontSize: 12, color: T.ink3, marginTop: -8 }}>Nu ai încă rapoarte salvate în BI.</p>}
            </>
          )}

          {(type === "LINK_BUTTON" || type === "CUSTOM_BUTTON") && (
            <>
              <FieldLabel>Etichetă buton</FieldLabel>
              <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", marginBottom: 12 }} placeholder="ex: Portal ROeID" />
              <FieldLabel>URL destinație</FieldLabel>
              <input value={url} onChange={(e) => setUrl(e.target.value)} style={{ width: "100%", marginBottom: 12 }} placeholder="https://..." />
            </>
          )}

          {type === "LINK_BUTTON" && (
            <>
              <FieldLabel>Iconiță</FieldLabel>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {Object.entries(LINK_ICONS).map(([key, Icon]) => (
                  <button
                    key={key}
                    onClick={() => setIconKey(key as LinkIconKey)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      border: `1.5px solid ${iconKey === key ? T.brand : T.line}`,
                      background: iconKey === key ? T.brandTint : T.card,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      color: T.brand,
                    }}
                  >
                    <Icon size={16} />
                  </button>
                ))}
              </div>
            </>
          )}

          {type === "CUSTOM_BUTTON" && (
            <>
              <FieldLabel>Încărcare fișier imagine de pe calculator{isEdit ? " (opțional — o poți înlocui)" : ""}</FieldLabel>
              <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] || null)} style={{ marginBottom: 12 }} />
            </>
          )}

          {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
            <Button variant="ghost" onClick={onClose}>Anulează</Button>
            <Button onClick={handleSave} style={{ opacity: saving ? 0.6 : 1 }}>{saving ? "Se salvează..." : "Salvează"}</Button>
          </div>
        </Card>
    </Modal>
  );
}
