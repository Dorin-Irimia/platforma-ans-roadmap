// Workflow Builder (model URBIO) — motor de workflow pe stări+tranziții.
// Structură: modal de creare (Detalii | Vizibilitate) → listă de fluxuri cu meniu
// contextual (editare/duplicare/activare-dezactivare/ștergere) → editor complet per
// flux (Detalii, Stări globale, Tranziții cu Șabloane/Validări/Acțiuni/Declanșatori
// + canvas SVG static al grafului de stări).
import { useEffect, useMemo, useState } from "react";
import {
  GitBranch,
  ClipboardList,
  FileText,
  CheckCircle2,
  Users as UsersIcon,
  Bell,
  Calendar,
  Archive,
  Lock,
  Send,
  Tag,
  Inbox,
} from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Card, Button, FieldLabel, SectionHeader, Pill } from "../components/ui";
import { Modal } from "../components/Modal";
import { T } from "../theme";
import { fetchUsers } from "../features/iam/api";
import {
  fetchWorkflowStates,
  createWorkflowState,
  deleteWorkflowState,
  fetchWorkflowGroups,
  createWorkflowGroup,
  fetchWorkflowDefs,
  fetchWorkflowDef,
  createWorkflowDef,
  updateWorkflowDef,
  toggleWorkflowDefActive,
  duplicateWorkflowDef,
  deleteWorkflowDef,
  createWorkflowTransition,
  updateWorkflowTransition,
  deleteWorkflowTransition,
  fetchForms,
  fetchTemplates,
  WorkflowStateDto,
  WorkflowGroupDto,
  WorkflowDefDto,
  WorkflowDefPayload,
  WorkflowTransitionDto,
  WorkflowTransitionPayload,
  WorkflowValidationDto,
  WorkflowActionDto,
  WorkflowTriggerDto,
  StateCategory,
  WorkflowVisibility,
  WorkflowSection,
  DueDateUnit,
  ReminderChannel,
  ValidationType,
  ActionType,
  TriggerType,
  FormDef,
  ResponseTemplateDto,
} from "../features/dms/api";

const ICON_CHOICES: { name: string; Icon: typeof GitBranch }[] = [
  { name: "GitBranch", Icon: GitBranch },
  { name: "ClipboardList", Icon: ClipboardList },
  { name: "FileText", Icon: FileText },
  { name: "CheckCircle2", Icon: CheckCircle2 },
  { name: "Users", Icon: UsersIcon },
  { name: "Bell", Icon: Bell },
  { name: "Calendar", Icon: Calendar },
  { name: "Archive", Icon: Archive },
  { name: "Lock", Icon: Lock },
  { name: "Send", Icon: Send },
  { name: "Tag", Icon: Tag },
  { name: "Inbox", Icon: Inbox },
];
const ICON_MAP: Record<string, typeof GitBranch> = Object.fromEntries(ICON_CHOICES.map((i) => [i.name, i.Icon]));
function IconOf(name: string) {
  return ICON_MAP[name] || GitBranch;
}

const STATE_CATEGORY_LABELS: Record<StateCategory, string> = {
  TODO: "De făcut",
  IN_PROGRESS: "În progres",
  DONE: "Finalizat",
  ARCHIVED: "Arhivat",
};
const STATE_CATEGORY_COLORS: Record<StateCategory, string> = {
  TODO: "#2F6FE0",
  IN_PROGRESS: "#7C3AED",
  DONE: "#2F9E6F",
  ARCHIVED: "#6A6F78",
};
const VISIBILITY_LABELS: Record<WorkflowVisibility, string> = { PRIVATE: "Privat (uz intern)", PUBLIC: "Public (Portal)" };
const SECTION_LABELS: Record<WorkflowSection, string> = {
  COMPLAINTS: "Sesizări",
  DOC_ISSUANCE: "Emitere documente",
  EVENTS: "Evenimente",
  GENERAL: "General",
  OFFICIAL_GAZETTE: "Monitor oficial",
  PUBLIC_INFO: "Informații publice",
  PUBLIC_CONSULTATION: "Consultare publică",
  REPORTS: "Rapoarte",
  SURVEYS: "Sondaje",
  POLLS: "Chestionare",
};
const DUE_UNIT_LABELS: Record<DueDateUnit, string> = {
  MINUTES: "minute",
  HOURS: "ore",
  BUSINESS_DAYS: "zile lucrătoare",
  MONTHS: "luni",
  YEARS: "ani",
};
const REMINDER_CHANNEL_LABELS: Record<ReminderChannel, string> = { PUSH: "Notificare push", EMAIL: "Email" };
const VALIDATION_LABELS: Record<ValidationType, string> = {
  VALIDATE_TEMPLATE: "Șablon obligatoriu generat",
  VALIDATE_FIELD: "Condiție pe un câmp",
  VALIDATE_UNIQUENESS: "Unicitate valoare câmp",
  MANUAL_CHECKLIST: "Bifă de confirmare manuală",
  VALIDATE_SIGNATURE: "Document semnat electronic",
};
const ACTION_LABELS: Record<ActionType, string> = {
  SEND_EMAIL: "Trimite email (simulat)",
  SEND_NOTIFICATION: "Trimite notificare (simulat)",
  GENERATE_DOCUMENT: "Generează document din șablon de răspuns",
  ASSIGN_TO_USER: "Alocă unui utilizator",
  ASSIGN_TO_GROUP: "Alocă unui grup",
  SET_DUE_DATE: "Setează termen",
  REQUEST_SIGNATURE: "Solicită semnătură (simulat)",
  PUBLISH_TO_PORTAL: "Publică pe Portal (simulat)",
  CREATE_CALENDAR_EVENT: "Creează eveniment calendar (simulat)",
  ADD_TAG: "Adaugă etichetă",
  LOCK_REQUEST: "Blochează cererea",
  ARCHIVE_REQUEST: "Arhivează cererea",
};
const TRIGGER_LABELS: Record<TriggerType, string> = {
  RESPONSE_THRESHOLD: "Prag de răspunsuri generate",
  DURATION_IN_STATE: "Durată petrecută în stare",
  DEADLINE_OVERDUE: "Termen legal depășit (escaladare automată)",
};

function emptyDefDraft(): Partial<WorkflowDefPayload> {
  return {
    icon: "GitBranch",
    name: "",
    description: "",
    visibility: "PRIVATE",
    section: "GENERAL",
    tags: [],
    category: "",
    isActive: true,
    reminders: [],
  };
}

function emptyTransitionDraft(fromStateId: string | null, toStateId: string): Partial<WorkflowTransitionPayload> {
  return {
    name: "",
    fromStateId,
    toStateId,
    requiresComment: false,
    requiresApproval: false,
    notifySubmitter: true,
    order: 0,
    templates: [],
    validations: [],
    actions: [],
    triggers: [],
  };
}

// ------------------------------------------------------------
// Stări globale — nomenclator unic pe platformă
// ------------------------------------------------------------
function StatesManager({ states, onChange }: { states: WorkflowStateDto[]; onChange: () => void }) {
  const [draft, setDraft] = useState<{ name: string; category: StateCategory; color: string; description: string }>({
    name: "",
    category: "TODO",
    color: STATE_CATEGORY_COLORS.TODO,
    description: "",
  });
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!draft.name.trim()) return;
    setError(null);
    try {
      await createWorkflowState(draft);
      setDraft({ name: "", category: "TODO", color: STATE_CATEGORY_COLORS.TODO, description: "" });
      onChange();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Nu am putut crea starea");
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deleteWorkflowState(id);
      onChange();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Starea e folosită de o tranziție — nu poate fi ștearsă");
    }
  }

  return (
    <Card style={{ marginBottom: 20 }}>
      <SectionHeader title={`Stări globale (${states.length}) — nume unic pe toată platforma`} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
        {states.map((s) => (
          <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999, background: T.line2 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: s.color }} />
            <span style={{ fontSize: 12, fontWeight: 700 }}>{s.name}</span>
            <span style={{ fontSize: 11, color: T.ink3 }}>({STATE_CATEGORY_LABELS[s.category]})</span>
            <button onClick={() => handleDelete(s.id)} style={{ border: "none", background: "none", color: T.ink4, cursor: "pointer", fontSize: 12 }}>✕</button>
          </span>
        ))}
        {states.length === 0 && <p style={{ color: T.ink3, fontSize: 13, margin: 0 }}>Nicio stare creată încă.</p>}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div>
          <FieldLabel>Stare nouă</FieldLabel>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="ex: Aprobat" style={{ width: 160 }} />
        </div>
        <div>
          <FieldLabel>Categorie (coloană kanban)</FieldLabel>
          <select
            value={draft.category}
            onChange={(e) => {
              const category = e.target.value as StateCategory;
              setDraft({ ...draft, category, color: STATE_CATEGORY_COLORS[category] });
            }}
            style={{ width: 140 }}
          >
            {Object.entries(STATE_CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel>Culoare</FieldLabel>
          <input type="color" value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })} style={{ width: 48, height: 36, padding: 2 }} />
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <FieldLabel>Descriere (opțional)</FieldLabel>
          <input value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} style={{ width: "100%" }} />
        </div>
        <Button onClick={handleAdd}>+ Stare</Button>
      </div>
      {error && <p style={{ color: T.danger, fontSize: 12, marginTop: 8 }}>{error}</p>}
    </Card>
  );
}

// ------------------------------------------------------------
// Canvas SVG static al grafului de stări (nu e un editor drag-and-drop —
// randare informativă a fluxului configurat, pe fundal punctat indigo)
// ------------------------------------------------------------
function FlowchartCanvas({ states, transitions }: { states: WorkflowStateDto[]; transitions: WorkflowTransitionDto[] }) {
  const stateById = useMemo(() => Object.fromEntries(states.map((s) => [s.id, s])), [states]);

  const nodeIds = useMemo(() => {
    const ids = new Set<string>();
    let hasStart = false;
    transitions.forEach((t) => {
      if (t.fromStateId === null) hasStart = true;
      else ids.add(t.fromStateId);
      ids.add(t.toStateId);
    });
    const sorted = Array.from(ids).sort((a, b) => {
      const sa = stateById[a];
      const sb = stateById[b];
      const catOrder = ["TODO", "IN_PROGRESS", "DONE", "ARCHIVED"];
      const ca = sa ? catOrder.indexOf(sa.category) : 99;
      const cb = sb ? catOrder.indexOf(sb.category) : 99;
      if (ca !== cb) return ca - cb;
      return (sa?.name || "").localeCompare(sb?.name || "");
    });
    return hasStart ? ["START", ...sorted] : sorted;
  }, [transitions, stateById]);

  if (nodeIds.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: T.ink3, fontSize: 13 }}>
        Adaugă tranziții pentru a vedea graful fluxului.
      </div>
    );
  }

  const colWidth = 190;
  const perRow = Math.max(1, Math.min(5, nodeIds.length));
  const rowHeight = 110;
  const nodeW = 150;
  const nodeH = 52;
  const positions: Record<string, { x: number; y: number }> = {};
  nodeIds.forEach((id, idx) => {
    const row = Math.floor(idx / perRow);
    const col = idx % perRow;
    positions[id] = { x: 30 + col * colWidth, y: 30 + row * rowHeight };
  });
  const rows = Math.ceil(nodeIds.length / perRow);
  const width = 30 + perRow * colWidth;
  const height = 30 + rows * rowHeight + nodeH;

  return (
    <div style={{ overflowX: "auto", background: T.indigoTint, borderRadius: 12, border: `1px solid ${T.line}` }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.5" fill={T.indigoSoft} opacity="0.18" />
          </pattern>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill={T.indigo} />
          </marker>
        </defs>
        <rect width={width} height={height} fill="url(#dots)" />

        {transitions.map((t) => {
          const fromId = t.fromStateId ?? "START";
          const from = positions[fromId];
          const to = positions[t.toStateId];
          if (!from || !to) return null;
          const x1 = from.x + nodeW / 2;
          const y1 = from.y + nodeH / 2;
          const x2 = to.x + nodeW / 2;
          const y2 = to.y + nodeH / 2;
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          return (
            <g key={t.id}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={T.indigo} strokeWidth={1.6} markerEnd="url(#arrow)" opacity={0.75} />
              <rect x={mx - 44} y={my - 10} width={88} height={18} rx={9} fill={T.card} stroke={T.line} />
              <text x={mx} y={my + 4} textAnchor="middle" fontSize={9} fontWeight={700} fill={T.ink2}>
                {t.name.length > 16 ? t.name.slice(0, 15) + "…" : t.name}
              </text>
            </g>
          );
        })}

        {nodeIds.map((id) => {
          const pos = positions[id];
          const isStart = id === "START";
          const state = stateById[id];
          const color = isStart ? T.brand : state?.color || T.ink3;
          return (
            <g key={id} transform={`translate(${pos.x},${pos.y})`}>
              <rect width={nodeW} height={nodeH} rx={12} fill={T.card} stroke={color} strokeWidth={2} />
              <circle cx={16} cy={nodeH / 2} r={5} fill={color} />
              <text x={30} y={nodeH / 2 + 4} fontSize={12} fontWeight={700} fill={T.ink}>
                {isStart ? "START" : (state?.name || "?").slice(0, 16)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ------------------------------------------------------------
// Editoare de configurație generice pentru Validări/Acțiuni/Declanșatori —
// fiecare tip are câteva câmpuri de config specifice, restul rămân neconfigurabile.
// ------------------------------------------------------------
function ValidationConfigFields({ type, config, onChange }: { type: ValidationType; config: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  if (type === "VALIDATE_FIELD") {
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input placeholder="cheie câmp (ex: cui)" value={config.fieldKey || ""} onChange={(e) => onChange({ ...config, fieldKey: e.target.value })} style={{ width: 160 }} />
        <select value={config.operator || "equals"} onChange={(e) => onChange({ ...config, operator: e.target.value })}>
          <option value="equals">este egal cu</option>
          <option value="not_equals">nu este egal cu</option>
        </select>
        <input placeholder="valoare" value={config.value || ""} onChange={(e) => onChange({ ...config, value: e.target.value })} style={{ width: 140 }} />
      </div>
    );
  }
  if (type === "VALIDATE_UNIQUENESS") {
    return <input placeholder="cheie câmp ce trebuie să fie unică" value={config.fieldKey || ""} onChange={(e) => onChange({ ...config, fieldKey: e.target.value })} style={{ width: 260 }} />;
  }
  if (type === "MANUAL_CHECKLIST") {
    return <input placeholder="text afișat la bifa de confirmare" value={config.label || ""} onChange={(e) => onChange({ ...config, label: e.target.value })} style={{ width: "100%" }} />;
  }
  return <span style={{ fontSize: 12, color: T.ink3, fontStyle: "italic" }}>Fără configurare suplimentară.</span>;
}

function ActionConfigFields({
  type,
  config,
  onChange,
  users,
  groups,
  templates,
}: {
  type: ActionType;
  config: Record<string, any>;
  onChange: (c: Record<string, any>) => void;
  users: { id: string; name?: string; email: string }[];
  groups: WorkflowGroupDto[];
  templates: ResponseTemplateDto[];
}) {
  if (type === "ASSIGN_TO_USER") {
    return (
      <select value={config.userId || ""} onChange={(e) => onChange({ ...config, userId: e.target.value })} style={{ width: 260 }}>
        <option value="">Alege utilizator...</option>
        {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
      </select>
    );
  }
  if (type === "ASSIGN_TO_GROUP") {
    return (
      <select value={config.groupId || ""} onChange={(e) => onChange({ ...config, groupId: e.target.value })} style={{ width: 220 }}>
        <option value="">Alege grup...</option>
        {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
    );
  }
  if (type === "SET_DUE_DATE") {
    return (
      <div style={{ display: "flex", gap: 8 }}>
        <input type="number" min={1} value={config.quantity || ""} onChange={(e) => onChange({ ...config, quantity: Number(e.target.value) })} style={{ width: 80 }} />
        <select value={config.unit || "BUSINESS_DAYS"} onChange={(e) => onChange({ ...config, unit: e.target.value })}>
          {Object.entries(DUE_UNIT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
    );
  }
  if (type === "ADD_TAG") {
    return <input placeholder="etichetă" value={config.tag || ""} onChange={(e) => onChange({ ...config, tag: e.target.value })} style={{ width: 180 }} />;
  }
  if (type === "GENERATE_DOCUMENT") {
    return (
      <select value={config.responseTemplateId || ""} onChange={(e) => onChange({ ...config, responseTemplateId: e.target.value })} style={{ width: 260 }}>
        <option value="">Alege șablon de răspuns...</option>
        {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
      </select>
    );
  }
  if (type === "SEND_EMAIL" || type === "SEND_NOTIFICATION") {
    return <input placeholder="mesaj (simulat — se scrie doar în jurnalul de audit)" value={config.message || ""} onChange={(e) => onChange({ ...config, message: e.target.value })} style={{ width: "100%" }} />;
  }
  if (type === "CREATE_CALENDAR_EVENT") {
    return <input placeholder="titlu eveniment (simulat)" value={config.title || ""} onChange={(e) => onChange({ ...config, title: e.target.value })} style={{ width: "100%" }} />;
  }
  return <span style={{ fontSize: 12, color: T.ink3, fontStyle: "italic" }}>Fără configurare suplimentară.</span>;
}

function TriggerConfigFields({ type, config, onChange }: { type: TriggerType; config: Record<string, any>; onChange: (c: Record<string, any>) => void }) {
  if (type === "RESPONSE_THRESHOLD") {
    return <input type="number" min={1} placeholder="nr. minim de răspunsuri" value={config.minResponses || ""} onChange={(e) => onChange({ ...config, minResponses: Number(e.target.value) })} style={{ width: 200 }} />;
  }
  if (type === "DEADLINE_OVERDUE") {
    return <span style={{ fontSize: 12, color: T.ink3, fontStyle: "italic" }}>Se declanșează automat când termenul legal al cererii a expirat — fără configurare suplimentară.</span>;
  }
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input type="number" min={1} value={config.quantity || ""} onChange={(e) => onChange({ ...config, quantity: Number(e.target.value) })} style={{ width: 80 }} />
      <select value={config.unit || "HOURS"} onChange={(e) => onChange({ ...config, unit: e.target.value })}>
        {Object.entries(DUE_UNIT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

// ------------------------------------------------------------
// Editor complet al unei tranziții (rând extensibil, ca la editorul de șabloane)
// ------------------------------------------------------------
function TransitionEditor({
  transition,
  states,
  forms,
  users,
  groups,
  responseTemplates,
  onChange,
  onRemove,
}: {
  transition: Partial<WorkflowTransitionPayload> & { id?: string };
  states: WorkflowStateDto[];
  forms: FormDef[];
  users: { id: string; name?: string; email: string }[];
  groups: WorkflowGroupDto[];
  responseTemplates: ResponseTemplateDto[];
  onChange: (patch: Partial<WorkflowTransitionPayload>) => void;
  onRemove: () => void;
}) {
  const validations = transition.validations || [];
  const actions = transition.actions || [];
  const triggers = transition.triggers || [];
  const templates = transition.templates || [];

  function updateValidation(idx: number, patch: Partial<WorkflowValidationDto>) {
    const next = [...validations];
    next[idx] = { ...next[idx], ...patch };
    onChange({ validations: next });
  }
  function updateAction(idx: number, patch: Partial<WorkflowActionDto>) {
    const next = [...actions];
    next[idx] = { ...next[idx], ...patch };
    onChange({ actions: next });
  }
  function updateTrigger(idx: number, patch: Partial<WorkflowTriggerDto>) {
    const next = [...triggers];
    next[idx] = { ...next[idx], ...patch };
    onChange({ triggers: next });
  }

  return (
    <Card style={{ background: T.bgSoft }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
        <div>
          <FieldLabel>Nume tranziție</FieldLabel>
          <input value={transition.name || ""} onChange={(e) => onChange({ name: e.target.value })} style={{ width: "100%" }} placeholder="ex: Trimite spre aprobare" />
        </div>
        <div>
          <FieldLabel>Din starea</FieldLabel>
          <select
            value={transition.fromStateId === null ? "__START__" : transition.fromStateId || ""}
            onChange={(e) => onChange({ fromStateId: e.target.value === "__START__" ? null : e.target.value })}
            style={{ width: "100%" }}
          >
            <option value="__START__">START (inițiere caz)</option>
            {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel>În starea</FieldLabel>
          <select value={transition.toStateId || ""} onChange={(e) => onChange({ toStateId: e.target.value })} style={{ width: "100%" }}>
            <option value="">Alege starea de destinație...</option>
            {states.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 14 }}>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" checked={!!transition.requiresComment} onChange={(e) => onChange({ requiresComment: e.target.checked })} /> Necesită comentariu
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" checked={!!transition.requiresApproval} onChange={(e) => onChange({ requiresApproval: e.target.checked })} /> Necesită aprobare (blochează avansarea automată prin declanșatori)
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" checked={!!transition.notifySubmitter} onChange={(e) => onChange({ notifySubmitter: e.target.checked })} /> Notifică petentul
        </label>
      </div>

      <SectionHeader title="Șabloane (documente atașate tranziției)" />
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {forms.map((f) => {
          const attached = templates.find((t) => t.formId === f.id);
          return (
            <label key={f.id} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13, padding: "6px 10px", background: T.card, borderRadius: 8 }}>
              <input
                type="checkbox"
                checked={!!attached}
                onChange={(e) => {
                  if (e.target.checked) onChange({ templates: [...templates, { formId: f.id, required: true }] });
                  else onChange({ templates: templates.filter((t) => t.formId !== f.id) });
                }}
              />
              <span style={{ flex: 1 }}>{f.name}</span>
              <Pill>{f.templateType}</Pill>
              {attached && (
                <label style={{ display: "flex", gap: 4, alignItems: "center", fontSize: 11, color: T.ink3 }}>
                  <input
                    type="checkbox"
                    checked={attached.required}
                    onChange={(e) => onChange({ templates: templates.map((t) => (t.formId === f.id ? { ...t, required: e.target.checked } : t)) })}
                  />
                  obligatoriu
                </label>
              )}
            </label>
          );
        })}
        {forms.length === 0 && <p style={{ color: T.ink3, fontSize: 12, margin: 0 }}>Niciun șablon creat încă în Editorul de șabloane.</p>}
      </div>

      <SectionHeader title="Validări (blochează tranziția dacă nu sunt îndeplinite)" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        {validations.map((v, idx) => (
          <div key={idx} style={{ display: "flex", gap: 10, alignItems: "center", padding: 10, background: T.card, borderRadius: 8 }}>
            <select value={v.type} onChange={(e) => updateValidation(idx, { type: e.target.value as ValidationType })} style={{ width: 220 }}>
              {Object.entries(VALIDATION_LABELS).map(([val, l]) => <option key={val} value={val}>{l}</option>)}
            </select>
            <div style={{ flex: 1 }}>
              <ValidationConfigFields type={v.type} config={v.config || {}} onChange={(c) => updateValidation(idx, { config: c })} />
            </div>
            <Button variant="danger" style={{ padding: "5px 9px", fontSize: 12 }} onClick={() => onChange({ validations: validations.filter((_, i) => i !== idx) })}>✕</Button>
          </div>
        ))}
      </div>
      <Button variant="ghost" style={{ fontSize: 12, marginBottom: 14 }} onClick={() => onChange({ validations: [...validations, { type: "VALIDATE_FIELD", config: {}, order: validations.length }] })}>
        + Validare
      </Button>

      <SectionHeader title="Acțiuni (rulează automat după ce tranziția e aplicată)" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        {actions.map((a, idx) => (
          <div key={idx} style={{ display: "flex", gap: 10, alignItems: "center", padding: 10, background: T.card, borderRadius: 8 }}>
            <select value={a.type} onChange={(e) => updateAction(idx, { type: e.target.value as ActionType })} style={{ width: 260 }}>
              {Object.entries(ACTION_LABELS).map(([val, l]) => <option key={val} value={val}>{l}</option>)}
            </select>
            <div style={{ flex: 1 }}>
              <ActionConfigFields type={a.type} config={a.config || {}} onChange={(c) => updateAction(idx, { config: c })} users={users} groups={groups} templates={responseTemplates} />
            </div>
            <Button variant="danger" style={{ padding: "5px 9px", fontSize: 12 }} onClick={() => onChange({ actions: actions.filter((_, i) => i !== idx) })}>✕</Button>
          </div>
        ))}
      </div>
      <Button variant="ghost" style={{ fontSize: 12, marginBottom: 14 }} onClick={() => onChange({ actions: [...actions, { type: "SEND_NOTIFICATION", config: {}, order: actions.length }] })}>
        + Acțiune
      </Button>

      <SectionHeader title="Declanșatori (evaluați automat la deschiderea cererii — fără infrastructură de scheduler)" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        {triggers.map((tr, idx) => (
          <div key={idx} style={{ display: "flex", gap: 10, alignItems: "center", padding: 10, background: T.card, borderRadius: 8 }}>
            <select value={tr.type} onChange={(e) => updateTrigger(idx, { type: e.target.value as TriggerType })} style={{ width: 220 }}>
              {Object.entries(TRIGGER_LABELS).map(([val, l]) => <option key={val} value={val}>{l}</option>)}
            </select>
            <div style={{ flex: 1 }}>
              <TriggerConfigFields type={tr.type} config={tr.config || {}} onChange={(c) => updateTrigger(idx, { config: c })} />
            </div>
            <Button variant="danger" style={{ padding: "5px 9px", fontSize: 12 }} onClick={() => onChange({ triggers: triggers.filter((_, i) => i !== idx) })}>✕</Button>
          </div>
        ))}
      </div>
      <Button variant="ghost" style={{ fontSize: 12 }} onClick={() => onChange({ triggers: [...triggers, { type: "RESPONSE_THRESHOLD", config: {} }] })}>
        + Declanșator
      </Button>

      <div style={{ marginTop: 16, textAlign: "right" }}>
        <Button variant="danger" onClick={onRemove}>Șterge tranziția</Button>
      </div>
    </Card>
  );
}

// ------------------------------------------------------------
// Modal de creare flux — Detalii | Vizibilitate
// ------------------------------------------------------------
function CreateDefModal({ onClose, onCreated }: { onClose: () => void; onCreated: (def: WorkflowDefDto) => void }) {
  const [draft, setDraft] = useState<Partial<WorkflowDefPayload>>(emptyDefDraft());
  const [tagsInput, setTagsInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!draft.name?.trim() || !draft.category?.trim()) {
      setError("Numele și categoria sunt obligatorii");
      return;
    }
    setError(null);
    try {
      const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
      const created = await createWorkflowDef({ ...draft, tags });
      onCreated(created);
    } catch (e: any) {
      const raw = e?.response?.data?.error;
      setError(typeof raw === "string" ? raw : "Nu am putut crea fluxul");
    }
  }

  return (
    <Modal onClose={onClose} width={720} maxHeight="88vh">
        <Card>
          <SectionHeader title="Flux de lucru nou" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.brand, marginBottom: 10, textTransform: "uppercase" }}>Detalii</div>
              <FieldLabel>Iconiță</FieldLabel>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {ICON_CHOICES.map(({ name, Icon }) => (
                  <button
                    key={name}
                    onClick={() => setDraft({ ...draft, icon: name })}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      border: `1.5px solid ${draft.icon === name ? T.brand : T.line}`,
                      background: draft.icon === name ? T.brandTint : T.card,
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
              <FieldLabel>Nume flux</FieldLabel>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ width: "100%", marginBottom: 12 }} placeholder="ex: Adeverință de la Registratură" />
              <FieldLabel>Descriere</FieldLabel>
              <input value={draft.description || ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} style={{ width: "100%", marginBottom: 12 }} />
              <FieldLabel>Categorie (leagă fluxul de categoria formularului/cererii)</FieldLabel>
              <input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} style={{ width: "100%", marginBottom: 12 }} placeholder="ex: cis" />
              <FieldLabel>Etichete (separate prin virgulă)</FieldLabel>
              <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} style={{ width: "100%" }} placeholder="urgent, publice" />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.brand, marginBottom: 10, textTransform: "uppercase" }}>Vizibilitate</div>
              <FieldLabel>Vizibilitate</FieldLabel>
              <select value={draft.visibility} onChange={(e) => setDraft({ ...draft, visibility: e.target.value as WorkflowVisibility })} style={{ width: "100%", marginBottom: 12 }}>
                {Object.entries(VISIBILITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <FieldLabel>Secțiune</FieldLabel>
              <select value={draft.section} onChange={(e) => setDraft({ ...draft, section: e.target.value as WorkflowSection })} style={{ width: "100%", marginBottom: 12 }}>
                {Object.entries(SECTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <FieldLabel>Termen implicit</FieldLabel>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input
                  type="number"
                  min={1}
                  value={draft.dueDateQuantity || ""}
                  onChange={(e) => setDraft({ ...draft, dueDateQuantity: e.target.value ? Number(e.target.value) : undefined })}
                  style={{ width: 80 }}
                />
                <select value={draft.dueDateUnit || "BUSINESS_DAYS"} onChange={(e) => setDraft({ ...draft, dueDateUnit: e.target.value as DueDateUnit })}>
                  {Object.entries(DUE_UNIT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                <input type="checkbox" checked={!!draft.isActive} onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })} /> Activ (poate fi inițiat)
              </label>
            </div>
          </div>

          {error && <p style={{ color: T.danger, fontSize: 13, marginTop: 14 }}>{error}</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={onClose}>Anulează</Button>
            <Button onClick={handleCreate}>Creează fluxul</Button>
          </div>
        </Card>
    </Modal>
  );
}

// ------------------------------------------------------------
// Pagina principală
// ------------------------------------------------------------
export default function WorkflowAdminPage() {
  const [defs, setDefs] = useState<WorkflowDefDto[]>([]);
  const [states, setStates] = useState<WorkflowStateDto[]>([]);
  const [groups, setGroups] = useState<WorkflowGroupDto[]>([]);
  const [forms, setForms] = useState<FormDef[]>([]);
  const [responseTemplates, setResponseTemplates] = useState<ResponseTemplateDto[]>([]);
  const [staffUsers, setStaffUsers] = useState<{ id: string; name?: string; email: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);

  const [editingDef, setEditingDef] = useState<WorkflowDefDto | null>(null);
  const [defDraft, setDefDraft] = useState<Partial<WorkflowDefPayload> | null>(null);
  const [tagsInput, setTagsInput] = useState("");
  const [transitionDrafts, setTransitionDrafts] = useState<(Partial<WorkflowTransitionPayload> & { id?: string; _isNew?: boolean })[]>([]);
  const [newGroupName, setNewGroupName] = useState("");

  function loadList() {
    fetchWorkflowDefs().then(setDefs).catch(() => setDefs([]));
    fetchWorkflowStates().then(setStates).catch(() => setStates([]));
    fetchWorkflowGroups().then(setGroups).catch(() => setGroups([]));
    fetchForms().then(setForms).catch(() => setForms([]));
    fetchTemplates().then(setResponseTemplates).catch(() => setResponseTemplates([]));
    fetchUsers().then((u: any[]) => setStaffUsers(u.filter((x) => x.role !== "UTILIZATOR_STANDARD"))).catch(() => setStaffUsers([]));
  }
  useEffect(loadList, []);

  async function openEditor(defId: string) {
    setError(null);
    try {
      const full = await fetchWorkflowDef(defId);
      setEditingDef(full);
      setDefDraft({
        icon: full.icon,
        name: full.name,
        description: full.description,
        visibility: full.visibility,
        section: full.section,
        tags: full.tags,
        category: full.category,
        dueDateQuantity: full.dueDateQuantity,
        dueDateUnit: full.dueDateUnit,
        isActive: full.isActive,
        reminders: full.reminders,
      });
      setTagsInput(full.tags.join(", "));
      setTransitionDrafts((full.transitions || []).map((t) => ({ ...t })));
    } catch (e: any) {
      setError(e?.response?.data?.error || "Nu am putut încărca fluxul");
    }
  }

  function closeEditor() {
    setEditingDef(null);
    setDefDraft(null);
    setTransitionDrafts([]);
  }

  async function handleSaveDetails() {
    if (!editingDef || !defDraft) return;
    setError(null);
    try {
      const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
      const updated = await updateWorkflowDef(editingDef.id, { ...defDraft, tags });
      setEditingDef(updated);
      loadList();
    } catch (e: any) {
      const raw = e?.response?.data?.error;
      setError(typeof raw === "string" ? raw : "Nu am putut salva detaliile fluxului");
    }
  }

  function addTransitionDraft() {
    setTransitionDrafts((prev) => [...prev, { ...emptyTransitionDraft(null, states[0]?.id || ""), _isNew: true }]);
  }

  function updateTransitionDraft(idx: number, patch: Partial<WorkflowTransitionPayload>) {
    setTransitionDrafts((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  }

  async function saveTransitionDraft(idx: number) {
    if (!editingDef) return;
    const draft = transitionDrafts[idx];
    if (!draft.name?.trim() || !draft.toStateId) {
      setError("Tranziția are nevoie de un nume și de o stare de destinație");
      return;
    }
    setError(null);
    try {
      if (draft.id) {
        await updateWorkflowTransition(draft.id, draft);
      } else {
        await createWorkflowTransition(editingDef.id, draft);
      }
      await openEditor(editingDef.id);
    } catch (e: any) {
      const raw = e?.response?.data?.error;
      setError(typeof raw === "string" ? raw : "Nu am putut salva tranziția");
    }
  }

  async function removeTransitionDraft(idx: number) {
    const draft = transitionDrafts[idx];
    if (!draft.id) {
      setTransitionDrafts((prev) => prev.filter((_, i) => i !== idx));
      return;
    }
    try {
      await deleteWorkflowTransition(draft.id);
      if (editingDef) await openEditor(editingDef.id);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Tranziția a fost deja folosită și nu poate fi ștearsă");
    }
  }

  async function handleAddGroup() {
    if (!newGroupName.trim()) return;
    try {
      await createWorkflowGroup(newGroupName);
      setNewGroupName("");
      loadList();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Nu am putut crea grupul");
    }
  }

  // ---------------- Editor complet al unui flux ----------------
  if (editingDef && defDraft) {
    return (
      <AppShell title={editingDef.name} subtitle="Editor complet de flux — detalii, stări, tranziții și graful vizual">
        <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
          <Button variant="ghost" onClick={closeEditor}>← Înapoi la listă</Button>
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost" onClick={async () => { await toggleWorkflowDefActive(editingDef.id, !editingDef.isActive); openEditor(editingDef.id); loadList(); }}>
              {editingDef.isActive ? "Dezactivează" : "Activează"}
            </Button>
            <Button variant="ghost" onClick={async () => { const dup = await duplicateWorkflowDef(editingDef.id); loadList(); openEditor(dup.id); }}>Duplică</Button>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  await deleteWorkflowDef(editingDef.id);
                  closeEditor();
                  loadList();
                } catch (e: any) {
                  setError(e?.response?.data?.error || "Nu am putut șterge fluxul");
                }
              }}
            >
              Șterge
            </Button>
          </div>
        </div>

        <Card style={{ marginBottom: 20 }}>
          <SectionHeader title="Detalii" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <FieldLabel>Iconiță</FieldLabel>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ICON_CHOICES.map(({ name, Icon }) => (
                  <button
                    key={name}
                    onClick={() => setDefDraft({ ...defDraft, icon: name })}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 7,
                      border: `1.5px solid ${defDraft.icon === name ? T.brand : T.line}`,
                      background: defDraft.icon === name ? T.brandTint : T.card,
                      color: T.brand,
                      cursor: "pointer",
                    }}
                  >
                    <Icon size={14} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <FieldLabel>Nume</FieldLabel>
              <input value={defDraft.name} onChange={(e) => setDefDraft({ ...defDraft, name: e.target.value })} style={{ width: "100%" }} />
            </div>
            <div>
              <FieldLabel>Categorie</FieldLabel>
              <input value={defDraft.category} onChange={(e) => setDefDraft({ ...defDraft, category: e.target.value })} style={{ width: "100%" }} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <FieldLabel>Vizibilitate</FieldLabel>
              <select value={defDraft.visibility} onChange={(e) => setDefDraft({ ...defDraft, visibility: e.target.value as WorkflowVisibility })} style={{ width: "100%" }}>
                {Object.entries(VISIBILITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Secțiune</FieldLabel>
              <select value={defDraft.section} onChange={(e) => setDefDraft({ ...defDraft, section: e.target.value as WorkflowSection })} style={{ width: "100%" }}>
                {Object.entries(SECTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Termen implicit</FieldLabel>
              <div style={{ display: "flex", gap: 8 }}>
                <input type="number" min={1} value={defDraft.dueDateQuantity || ""} onChange={(e) => setDefDraft({ ...defDraft, dueDateQuantity: e.target.value ? Number(e.target.value) : undefined })} style={{ width: 70 }} />
                <select value={defDraft.dueDateUnit || "BUSINESS_DAYS"} onChange={(e) => setDefDraft({ ...defDraft, dueDateUnit: e.target.value as DueDateUnit })}>
                  {Object.entries(DUE_UNIT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
          </div>
          <FieldLabel>Descriere</FieldLabel>
          <input value={defDraft.description || ""} onChange={(e) => setDefDraft({ ...defDraft, description: e.target.value })} style={{ width: "100%", marginBottom: 14 }} />
          <FieldLabel>Etichete (separate prin virgulă)</FieldLabel>
          <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} style={{ width: "100%", marginBottom: 14 }} />

          <SectionHeader title="Memento-uri termen" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
            {(defDraft.reminders || []).map((r, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select value={r.channel} onChange={(e) => setDefDraft({ ...defDraft, reminders: (defDraft.reminders || []).map((x, i) => (i === idx ? { ...x, channel: e.target.value as ReminderChannel } : x)) })}>
                  {Object.entries(REMINDER_CHANNEL_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <input
                  type="number"
                  min={1}
                  value={r.quantity}
                  onChange={(e) => setDefDraft({ ...defDraft, reminders: (defDraft.reminders || []).map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value) } : x)) })}
                  style={{ width: 70 }}
                />
                <select value={r.unit} onChange={(e) => setDefDraft({ ...defDraft, reminders: (defDraft.reminders || []).map((x, i) => (i === idx ? { ...x, unit: e.target.value as DueDateUnit } : x)) })}>
                  {Object.entries(DUE_UNIT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <Button variant="danger" style={{ padding: "5px 9px", fontSize: 12 }} onClick={() => setDefDraft({ ...defDraft, reminders: (defDraft.reminders || []).filter((_, i) => i !== idx) })}>✕</Button>
              </div>
            ))}
          </div>
          <Button variant="ghost" style={{ fontSize: 12, marginBottom: 14 }} onClick={() => setDefDraft({ ...defDraft, reminders: [...(defDraft.reminders || []), { channel: "PUSH", quantity: 1, unit: "BUSINESS_DAYS" }] })}>
            + Memento
          </Button>

          <div>
            <Button onClick={handleSaveDetails}>Salvează detaliile</Button>
          </div>
        </Card>

        <StatesManager states={states} onChange={loadList} />

        <Card style={{ marginBottom: 20 }}>
          <SectionHeader title="Grupuri (pentru acțiunea „Alocă unui grup”)" />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {groups.map((g) => <Pill key={g.id}>{g.name}</Pill>)}
            {groups.length === 0 && <span style={{ fontSize: 12, color: T.ink3 }}>Niciun grup creat încă.</span>}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Nume grup nou" style={{ width: 220 }} />
            <Button variant="ghost" onClick={handleAddGroup}>+ Grup</Button>
          </div>
        </Card>

        <Card id="workflow-diagram" style={{ marginBottom: 20 }}>
          <SectionHeader title="Graful fluxului" />
          <FlowchartCanvas states={states} transitions={(editingDef.transitions || []) as WorkflowTransitionDto[]} />
        </Card>

        <SectionHeader title={`Tranziții (${transitionDrafts.length})`} />
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
          {transitionDrafts.map((t, idx) => (
            <div key={t.id || `new-${idx}`}>
              <TransitionEditor
                transition={t}
                states={states}
                forms={forms}
                users={staffUsers}
                groups={groups}
                responseTemplates={responseTemplates}
                onChange={(patch) => updateTransitionDraft(idx, patch)}
                onRemove={() => removeTransitionDraft(idx)}
              />
              <div style={{ marginTop: 8, textAlign: "right" }}>
                <Button style={{ fontSize: 12 }} onClick={() => saveTransitionDraft(idx)}>Salvează tranziția</Button>
              </div>
            </div>
          ))}
        </div>
        <Button variant="ghost" onClick={addTransitionDraft}>+ Tranziție nouă</Button>

        {error && <p style={{ color: T.danger, marginTop: 14 }}>{error}</p>}
      </AppShell>
    );
  }

  // ---------------- Listă de fluxuri ----------------
  return (
    <AppShell title="Workflow Builder" subtitle="Fluxuri de lucru configurabile pe stări și tranziții, cu șabloane, validări, acțiuni și declanșatori">
      <div style={{ marginBottom: 20 }}>
        <Button id="workflow-new-btn" onClick={() => setShowCreateModal(true)}>+ Flux nou</Button>
      </div>
      {error && <p style={{ color: T.danger }}>{error}</p>}

      <SectionHeader title={`${defs.length} fluxuri configurate`} />
      <div style={{ display: "grid", gap: 12 }}>
        {defs.map((d) => {
          const Icon = IconOf(d.icon);
          return (
            <Card key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: T.brandTint, display: "flex", alignItems: "center", justifyContent: "center", color: T.brand }}>
                  <Icon size={18} />
                </div>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700 }}>{d.name}</span>
                    <Pill>{SECTION_LABELS[d.section]}</Pill>
                    <Pill color={d.visibility === "PUBLIC" ? T.info : T.ink3} bg={d.visibility === "PUBLIC" ? T.infoTint : T.line2}>{VISIBILITY_LABELS[d.visibility]}</Pill>
                    {!d.isActive && <Pill color={T.ink4} bg={T.line2}>Inactiv</Pill>}
                  </div>
                  <div style={{ fontSize: 12, color: T.ink3 }}>
                    categorie: {d.category} · {d.transitionCount ?? 0} tranziții
                    {d.tags?.length ? ` · ${d.tags.join(", ")}` : ""}
                  </div>
                </div>
              </div>
              <div style={{ position: "relative" }}>
                <Button variant="ghost" style={{ padding: "8px 12px", fontSize: 18 }} onClick={() => setMenuFor(menuFor === d.id ? null : d.id)}>⋯</Button>
                {menuFor === d.id && (
                  <div
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "110%",
                      background: T.card,
                      border: `1px solid ${T.line}`,
                      borderRadius: 10,
                      boxShadow: "0 8px 20px rgba(14,17,22,0.12)",
                      zIndex: 20,
                      overflow: "hidden",
                      minWidth: 180,
                    }}
                  >
                    {[
                      { label: "Editează", action: () => openEditor(d.id) },
                      { label: "Duplică", action: async () => { await duplicateWorkflowDef(d.id); loadList(); } },
                      { label: d.isActive ? "Dezactivează" : "Activează", action: async () => { await toggleWorkflowDefActive(d.id, !d.isActive); loadList(); } },
                      {
                        label: "Șterge",
                        action: async () => {
                          try {
                            await deleteWorkflowDef(d.id);
                            loadList();
                          } catch (e: any) {
                            setError(e?.response?.data?.error || "Nu am putut șterge fluxul");
                          }
                        },
                        danger: true,
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        onClick={() => {
                          setMenuFor(null);
                          item.action();
                        }}
                        style={{ padding: "10px 14px", fontSize: 13, cursor: "pointer", color: (item as any).danger ? T.danger : T.ink }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = T.line2)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {item.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
        {defs.length === 0 && <p style={{ color: T.ink3 }}>Niciun flux configurat încă.</p>}
      </div>

      {showCreateModal && (
        <CreateDefModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(created) => {
            setShowCreateModal(false);
            loadList();
            openEditor(created.id);
          }}
        />
      )}
    </AppShell>
  );
}
