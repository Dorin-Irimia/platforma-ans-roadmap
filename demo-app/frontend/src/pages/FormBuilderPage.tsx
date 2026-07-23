import { useEffect, useState } from "react";
import { FileText, ClipboardList, FileCheck2, FileWarning, Send, Award, Calendar, Banknote, Megaphone, ScrollText, Building2, Users as UsersIcon } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Card, Button, FieldLabel, SectionHeader, Pill } from "../components/ui";
import { Modal } from "../components/Modal";
import { useToast } from "../components/ToastProvider";
import { T } from "../theme";
import {
  fetchForms,
  createForm,
  updateForm,
  publishForm,
  unpublishForm,
  downloadFormPdf,
  FormDef,
  FormFieldDef,
  FormSectionDef,
  FormPayload,
  TemplateType,
} from "../features/dms/api";
import {
  fetchNomenclatoare,
  fetchFormNomenclatorLinks,
  linkNomenclatorToForm,
  unlinkNomenclatorFromForm,
  NomenclatorDto,
  FormNomenclatorLinkDto,
} from "../features/nomenclatoare/api";
import {
  FIELD_CATALOG,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  TEMPLATE_TYPE_LABELS,
  fieldsByCategory,
  FieldType,
  ConditionRule,
  CANONICAL_ROLES,
  CanonicalRole,
} from "../features/dms/fieldCatalog";

// Aceeași paritate ca iconițele de flux din Workflow Builder (nume lucide-react stocat
// ca string) — dar cu un set orientat spre tipuri de documente/șabloane.
const FORM_ICON_CHOICES: { name: string; Icon: typeof FileText }[] = [
  { name: "FileText", Icon: FileText },
  { name: "ClipboardList", Icon: ClipboardList },
  { name: "FileCheck2", Icon: FileCheck2 },
  { name: "FileWarning", Icon: FileWarning },
  { name: "Send", Icon: Send },
  { name: "Award", Icon: Award },
  { name: "Calendar", Icon: Calendar },
  { name: "Banknote", Icon: Banknote },
  { name: "Megaphone", Icon: Megaphone },
  { name: "ScrollText", Icon: ScrollText },
  { name: "Building2", Icon: Building2 },
  { name: "Users", Icon: UsersIcon },
];
const FORM_ICON_MAP: Record<string, typeof FileText> = Object.fromEntries(FORM_ICON_CHOICES.map((i) => [i.name, i.Icon]));
function formIconOf(name: string) {
  return FORM_ICON_MAP[name] || FileText;
}

function emptyField(type: FieldType): FormFieldDef {
  const entry = FIELD_CATALOG[type];
  return {
    key: "",
    internalTitle: entry.label,
    type,
    required: false,
    disabled: false,
    readOnly: false,
    label: entry.label,
    allowAiAutofill: false,
    autofillFromProfile: false,
    config: entry.defaultConfig ? { ...entry.defaultConfig } : undefined,
    conditions: [],
  };
}

function emptyForm(): FormPayload {
  return {
    icon: "FileText",
    name: "",
    category: "",
    templateType: "REQUEST_FORM",
    title: "",
    subtitle: "",
    titleEn: "",
    descriptionEn: "",
    completeness: "COMPLETE",
    requiresAuth: false,
    portalSection: null,
    description: "",
    sections: [],
    otherFields: [],
  };
}

// ——— Selector de tip câmp, grupat pe categorii ———
function FieldTypePicker({ onSelect, onClose }: { onSelect: (type: FieldType) => void; onClose: () => void }) {
  const grouped = fieldsByCategory();
  return (
    <Card style={{ marginTop: 8, background: T.bgSoft }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.ink3, textTransform: "uppercase" }}>Alege tipul câmpului</span>
        <Button variant="ghost" style={{ padding: "4px 8px", fontSize: 12 }} onClick={onClose}>✕</Button>
      </div>
      {CATEGORY_ORDER.map((cat) => (
        <div key={cat} style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.brand, marginBottom: 6 }}>{CATEGORY_LABELS[cat]}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {grouped[cat].map(({ type, entry }) => (
              <button
                key={type}
                onClick={() => onSelect(type)}
                title={entry.hint}
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  border: `1px solid ${T.line}`,
                  background: T.card,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </Card>
  );
}

// ——— Preview live al câmpului, exact tipul de randare pe care îl va vedea cetățeanul/angajatul ———
function FieldPreview({ field }: { field: FormFieldDef }) {
  const entry = FIELD_CATALOG[field.type];
  const options = (field.config?.options as string[] | undefined) || [];

  return (
    <div style={{ padding: 12, background: T.card, borderRadius: 8, border: `1px dashed ${T.line}` }}>
      <div style={{ fontSize: 11, color: T.ink3, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4 }}>Previzualizare</div>
      <FieldLabel>
        {field.label || entry.label}
        {field.required ? " *" : ""}
      </FieldLabel>
      {["DROPDOWN", "REGION"].includes(field.type) ? (
        <select disabled={field.disabled} style={{ width: "100%" }}>
          <option>{field.placeholder || "Selectează..."}</option>
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : ["RADIO", "MULTI_CHECKBOX", "NESTED_CHECKBOXES", "SURVEY"].includes(field.type) ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {(options.length ? options : ["Opțiune 1", "Opțiune 2"]).map((o) => (
            <label key={o} style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
              <input type={field.type === "RADIO" ? "radio" : "checkbox"} disabled={field.disabled} /> {o}
            </label>
          ))}
        </div>
      ) : field.type === "CHECKBOX" || field.type === "TOGGLE" ? (
        <input type="checkbox" disabled={field.disabled} />
      ) : field.type === "LONG_TEXT" ? (
        <textarea disabled={field.disabled} placeholder={field.placeholder} style={{ width: "100%", minHeight: 60 }} />
      ) : field.type === "STATIC_TEXT" ? (
        <p style={{ fontSize: 13, color: T.ink2 }}>{(field.config?.text as string) || "Text static..."}</p>
      ) : field.type === "STAR_RATING" ? (
        <div style={{ fontSize: 18, color: T.warn }}>{"★".repeat(Number(field.config?.maxStars) || 5)}</div>
      ) : field.type === "SCALE" ? (
        <input type="range" min={Number(field.config?.min) || 1} max={Number(field.config?.max) || 10} disabled={field.disabled} style={{ width: "100%" }} />
      ) : ["DATE", "DATETIME", "TIME"].includes(field.type) ? (
        <input type={field.type === "DATE" ? "date" : field.type === "TIME" ? "time" : "datetime-local"} disabled={field.disabled} style={{ width: "100%" }} />
      ) : ["FILE_UPLOAD", "FILE_UPLOAD_AI", "CARD_EXTRACT_AI"].includes(field.type) ? (
        <input type="file" disabled={field.disabled} />
      ) : entry.category === "SYSTEM" ? (
        <div style={{ fontSize: 12, color: T.ink3, fontStyle: "italic" }}>Câmp de sistem — configurare completă în Workflow Builder.</div>
      ) : (
        <input
          type={field.type === "EMAIL" ? "email" : field.type === "SHORT_NUMBER" ? "number" : "text"}
          disabled={field.disabled}
          placeholder={field.placeholder}
          style={{ width: "100%" }}
        />
      )}
      {field.helpText && <p style={{ fontSize: 11, color: T.ink3, marginTop: 6 }}>{field.helpText}</p>}
    </div>
  );
}

// ——— Editor complet de setări pentru un câmp selectat ———
function FieldEditor({
  field,
  allFieldKeys,
  onChange,
  onRemove,
}: {
  field: FormFieldDef;
  allFieldKeys: string[];
  onChange: (patch: Partial<FormFieldDef>) => void;
  onRemove: () => void;
}) {
  const entry = FIELD_CATALOG[field.type];
  const options = (field.config?.options as string[] | undefined) || [];

  function setOptions(next: string[]) {
    onChange({ config: { ...field.config, options: next } });
  }

  function updateCondition(idx: number, patch: Partial<ConditionRule>) {
    const next = [...(field.conditions || [])];
    next[idx] = { ...next[idx], ...patch };
    onChange({ conditions: next });
  }

  return (
    <Card style={{ marginTop: 8, background: T.bgSoft }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <FieldLabel>Titlu (nume intern)</FieldLabel>
              <input value={field.internalTitle} onChange={(e) => onChange({ internalTitle: e.target.value })} style={{ width: "100%" }} />
            </div>
            <div style={{ width: 120 }}>
              <FieldLabel>Cheie</FieldLabel>
              <input value={field.key} onChange={(e) => onChange({ key: e.target.value })} style={{ width: "100%" }} placeholder="cui" />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <FieldLabel>Descriere</FieldLabel>
            <input value={field.description || ""} onChange={(e) => onChange({ description: e.target.value })} style={{ width: "100%" }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <FieldLabel>Etichetă (text afișat)</FieldLabel>
            <input value={field.label} onChange={(e) => onChange({ label: e.target.value })} style={{ width: "100%" }} />
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <FieldLabel>Text sugestiv</FieldLabel>
              <input value={field.placeholder || ""} onChange={(e) => onChange({ placeholder: e.target.value })} style={{ width: "100%" }} />
            </div>
            <div style={{ flex: 1 }}>
              <FieldLabel>Indicator text</FieldLabel>
              <input value={field.textIndicator || ""} onChange={(e) => onChange({ textIndicator: e.target.value })} style={{ width: "100%" }} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <FieldLabel>Text de ajutor</FieldLabel>
            <input value={field.helpText || ""} onChange={(e) => onChange({ helpText: e.target.value })} style={{ width: "100%" }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <FieldLabel>Valoare implicită</FieldLabel>
            <input value={field.defaultValue || ""} onChange={(e) => onChange({ defaultValue: e.target.value })} style={{ width: "100%" }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <FieldLabel>Mapare pe entitatea Cerere</FieldLabel>
            <select
              value={field.canonicalRole || ""}
              onChange={(e) => onChange({ canonicalRole: (e.target.value || null) as CanonicalRole | null })}
              style={{ width: "100%" }}
            >
              <option value="">— fără mapare —</option>
              {CANONICAL_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {entry.hasLengthLimits && (
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <FieldLabel>Lungime minimă</FieldLabel>
                <input type="number" value={field.minLength ?? ""} onChange={(e) => onChange({ minLength: e.target.value ? Number(e.target.value) : undefined })} style={{ width: "100%" }} />
              </div>
              <div style={{ flex: 1 }}>
                <FieldLabel>Lungime maximă</FieldLabel>
                <input type="number" value={field.maxLength ?? ""} onChange={(e) => onChange({ maxLength: e.target.value ? Number(e.target.value) : undefined })} style={{ width: "100%" }} />
              </div>
            </div>
          )}
          {entry.hasValueLimits && (
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <FieldLabel>Valoare minimă</FieldLabel>
                <input type="number" value={field.minValue ?? ""} onChange={(e) => onChange({ minValue: e.target.value ? Number(e.target.value) : undefined })} style={{ width: "100%" }} />
              </div>
              <div style={{ flex: 1 }}>
                <FieldLabel>Valoare maximă</FieldLabel>
                <input type="number" value={field.maxValue ?? ""} onChange={(e) => onChange({ maxValue: e.target.value ? Number(e.target.value) : undefined })} style={{ width: "100%" }} />
              </div>
            </div>
          )}

          {entry.hasOptions && (
            <div style={{ marginBottom: 10 }}>
              <FieldLabel>Opțiuni</FieldLabel>
              {options.map((opt, i) => (
                <div key={i} style={{ display: "flex", gap: 6, marginBottom: 4 }}>
                  <input
                    value={opt}
                    onChange={(e) => setOptions(options.map((o, idx) => (idx === i ? e.target.value : o)))}
                    style={{ flex: 1 }}
                  />
                  <Button variant="danger" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => setOptions(options.filter((_, idx) => idx !== i))}>✕</Button>
                </div>
              ))}
              <Button variant="ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => setOptions([...options, `Opțiune ${options.length + 1}`])}>+ Opțiune</Button>
            </div>
          )}

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 10 }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
              <input type="checkbox" checked={field.required} onChange={(e) => onChange({ required: e.target.checked })} /> Obligatoriu
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
              <input type="checkbox" checked={field.disabled} onChange={(e) => onChange({ disabled: e.target.checked })} /> Dezactivat
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
              <input type="checkbox" checked={field.readOnly} onChange={(e) => onChange({ readOnly: e.target.checked })} /> Doar citire
            </label>
            {entry.supportsAiAutofill && (
              <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
                <input type="checkbox" checked={field.allowAiAutofill} onChange={(e) => onChange({ allowAiAutofill: e.target.checked })} /> Completare automată cu IA
              </label>
            )}
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }} title="Precompletare din profilul utilizatorului autentificat (4.5.1 R40) — mapează câmpul pe NUME/EMAIL în cardul de Mapare de mai jos.">
              <input type="checkbox" checked={!!field.autofillFromProfile} onChange={(e) => onChange({ autofillFromProfile: e.target.checked })} /> Precompletare din profil
            </label>
          </div>

          <SectionHeader title="Condiții de vizibilitate" />
          {(field.conditions || []).map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: T.ink3 }}>Dacă</span>
              <select value={c.field} onChange={(e) => updateCondition(i, { field: e.target.value })} style={{ flex: 1 }}>
                {allFieldKeys.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <select value={c.operator} onChange={(e) => updateCondition(i, { operator: e.target.value as ConditionRule["operator"] })}>
                <option value="equals">este egal cu</option>
                <option value="not_equals">nu este egal cu</option>
              </select>
              <input value={c.value} onChange={(e) => updateCondition(i, { value: e.target.value })} style={{ width: 120 }} />
              <Button variant="danger" style={{ padding: "4px 8px", fontSize: 12 }} onClick={() => onChange({ conditions: (field.conditions || []).filter((_, idx) => idx !== i) })}>✕</Button>
            </div>
          ))}
          <Button
            variant="ghost"
            id="form-builder-add-condition-btn"
            style={{ fontSize: 12, padding: "5px 10px" }}
            onClick={() => onChange({ conditions: [...(field.conditions || []), { field: allFieldKeys[0] || "", operator: "equals", value: "" }] })}
          >
            + Condiție
          </Button>
        </div>

        <div>
          <FieldPreview field={field} />
          <Button variant="danger" style={{ marginTop: 12, fontSize: 12 }} onClick={onRemove}>Șterge câmpul</Button>
        </div>
      </div>
    </Card>
  );
}

function FieldRow({
  field,
  isOpen,
  onToggle,
  allFieldKeys,
  onChange,
  onRemove,
}: {
  field: FormFieldDef;
  isOpen: boolean;
  onToggle: () => void;
  allFieldKeys: string[];
  onChange: (patch: Partial<FormFieldDef>) => void;
  onRemove: () => void;
}) {
  const entry = FIELD_CATALOG[field.type];
  return (
    <div>
      <div
        onClick={onToggle}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: T.line2, borderRadius: 8, cursor: "pointer" }}
      >
        <Pill>{entry.label}</Pill>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{field.internalTitle || "(fără titlu)"}</span>
        <span style={{ fontSize: 12, color: T.ink3 }}>{field.key && `#${field.key}`}</span>
        {field.required && <Pill color={T.danger} bg={T.dangerTint}>Obligatoriu</Pill>}
        <span style={{ marginLeft: "auto", color: T.ink3 }}>{isOpen ? "▲" : "▼"}</span>
      </div>
      {isOpen && <FieldEditor field={field} allFieldKeys={allFieldKeys} onChange={onChange} onRemove={onRemove} />}
    </div>
  );
}

// Previzualizare completă a formularului — exact ce va vedea petentul în Portal
// (titlu, subtitlu, secțiuni în ordine, „Alte cerințe”), nu doar câmp cu câmp ca în
// editor. Câmpurile cu condiții de vizibilitate sunt marcate distinct, pentru că
// starea lor reală depinde de răspunsurile efective la depunere.
function FullFormPreview({ form, onClose }: { form: FormPayload; onClose: () => void }) {
  return (
    <Modal isOpen onClose={onClose} width={560} maxHeight="88vh">
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: T.brand, marginBottom: 6 }}>
                Previzualizare formular
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.4, margin: 0 }}>{form.title || form.name || "(fără titlu)"}</h2>
              {form.subtitle && <p style={{ color: T.ink3, fontSize: 13.5, margin: "4px 0 0" }}>{form.subtitle}</p>}
            </div>
            <Button variant="ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={onClose}>✕</Button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 22, marginTop: 20 }}>
            {form.sections.map((section, sIdx) => (
              <div key={sIdx}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: T.ink3, marginBottom: 10 }}>
                  {section.name}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {section.fields.map((field, fIdx) => (
                    <div key={fIdx}>
                      {!!field.conditions?.length && (
                        <Pill color={T.progress} bg={T.progressTint} style={{ marginBottom: 4 }}>Vizibil condiționat</Pill>
                      )}
                      <FieldPreview field={field} />
                    </div>
                  ))}
                  {section.fields.length === 0 && <p style={{ color: T.ink3, fontSize: 12.5 }}>Secțiune fără câmpuri încă.</p>}
                </div>
              </div>
            ))}

            {form.otherFields.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: T.ink3, marginBottom: 10 }}>
                  Alte cerințe
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {form.otherFields.map((field, fIdx) => (
                    <div key={fIdx}>
                      {!!field.conditions?.length && (
                        <Pill color={T.progress} bg={T.progressTint} style={{ marginBottom: 4 }}>Vizibil condiționat</Pill>
                      )}
                      <FieldPreview field={field} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {form.sections.length === 0 && form.otherFields.length === 0 && (
              <p style={{ color: T.ink3, fontSize: 13 }}>Adaugă secțiuni sau cerințe pentru a vedea previzualizarea.</p>
            )}
          </div>

          <p style={{ fontSize: 11.5, color: T.ink3, marginTop: 20, marginBottom: 0 }}>
            Previzualizare statică — câmpurile marcate „Vizibil condiționat” apar sau nu la depunerea reală, în funcție de răspunsurile petentului.
          </p>
        </Card>
    </Modal>
  );
}

// Nomenclatoare atașate șablonului — la completare (Portal), o intrare aleasă
// precompletează automat câmpurile mapate mai jos. Doar la nivel de formular (nu per
// câmp), pentru că un nomenclator mapează de regulă mai multe câmpuri deodată.
function NomenclatorLinksSection({ formId, allFieldKeys }: { formId: string; allFieldKeys: string[] }) {
  const [links, setLinks] = useState<FormNomenclatorLinkDto[]>([]);
  const [available, setAvailable] = useState<NomenclatorDto[]>([]);
  const [pickedId, setPickedId] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchFormNomenclatorLinks(formId).then(setLinks).catch(() => setLinks([]));
    fetchNomenclatoare().then(setAvailable).catch(() => setAvailable([]));
  }
  useEffect(load, [formId]);

  const picked = available.find((n) => n.id === pickedId);
  const linkedIds = new Set(links.map((l) => l.nomenclatorId));

  async function handleAttach() {
    if (!picked) return;
    if (picked.fields.some((f) => !mapping[f.key])) {
      setError("Alege un câmp din formular pentru fiecare câmp al nomenclatorului");
      return;
    }
    setError(null);
    try {
      await linkNomenclatorToForm(formId, picked.id, mapping);
      setPickedId("");
      setMapping({});
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Nu am putut atașa nomenclatorul");
    }
  }

  return (
    <Card style={{ marginBottom: 20 }}>
      <SectionHeader title="Nomenclatoare asociate" />
      <p style={{ fontSize: 12.5, color: T.ink3, marginTop: -6, marginBottom: 14 }}>
        La completarea formularului, o intrare aleasă dintr-un nomenclator atașat precompletează automat câmpurile mapate.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {links.map((l) => (
          <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: T.bgSoft, borderRadius: 10, fontSize: 13 }}>
            <div>
              <strong>{l.nomenclator?.name}</strong>
              <span style={{ color: T.ink3, marginLeft: 8, fontSize: 12 }}>
                {Object.entries(l.fieldMapping).map(([nk, fk]) => `${nk}→${fk}`).join(", ")}
              </span>
            </div>
            <Button variant="ghost" style={{ padding: "5px 10px", fontSize: 11.5 }} onClick={() => unlinkNomenclatorFromForm(formId, l.id).then(load)}>
              Elimină
            </Button>
          </div>
        ))}
        {links.length === 0 && <p style={{ color: T.ink3, fontSize: 12.5 }}>Niciun nomenclator atașat încă.</p>}
      </div>

      <FieldLabel>Atașează un nomenclator</FieldLabel>
      <select value={pickedId} onChange={(e) => { setPickedId(e.target.value); setMapping({}); }} style={{ width: "100%", marginBottom: 10 }}>
        <option value="">Alege un nomenclator...</option>
        {available.filter((n) => !linkedIds.has(n.id)).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
      </select>

      {picked && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
          {picked.fields.map((f) => (
            <div key={f.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <span style={{ width: 140, color: T.ink2 }}>{f.label} →</span>
              <select value={mapping[f.key] || ""} onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })} style={{ flex: 1 }}>
                <option value="">Alege câmpul din formular...</option>
                {allFieldKeys.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
          ))}
          <div><Button onClick={handleAttach}>Atașează</Button></div>
        </div>
      )}
      {error && <p style={{ color: T.danger, fontSize: 12.5 }}>{error}</p>}
    </Card>
  );
}

export default function FormBuilderPage() {
  const toast = useToast();
  const [forms, setForms] = useState<FormDef[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<FormPayload | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [openFieldPath, setOpenFieldPath] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null>(null); // "other" sau "section-<idx>"
  const [previewing, setPreviewing] = useState(false);

  function load() {
    fetchForms().then(setForms).catch((e) => setError(e?.response?.data?.error || "Eroare la încărcare"));
  }
  useEffect(load, []);

  function startCreate() {
    setEditing(emptyForm());
    setEditingId(null);
  }

  function startEdit(form: FormDef) {
    setEditing({
      icon: form.icon,
      name: form.name,
      description: form.description,
      category: form.category,
      templateType: form.templateType,
      title: form.title,
      subtitle: form.subtitle,
      titleEn: form.titleEn || "",
      descriptionEn: form.descriptionEn || "",
      completeness: form.completeness,
      requiresAuth: form.requiresAuth,
      portalSection: form.portalSection,
      sections: form.sections.map((s) => ({ ...s })),
      otherFields: form.fields,
    });
    setEditingId(form.id);
  }

  const allFieldKeys = editing
    ? [...editing.sections.flatMap((s) => s.fields), ...editing.otherFields].map((f) => f.key).filter(Boolean)
    : [];
  const allFields: FormFieldDef[] = editing ? [...editing.sections.flatMap((s) => s.fields), ...editing.otherFields] : [];

  function updateSectionField(sIdx: number, fIdx: number, patch: Partial<FormFieldDef>) {
    if (!editing) return;
    const sections = [...editing.sections];
    const fields = [...sections[sIdx].fields];
    fields[fIdx] = { ...fields[fIdx], ...patch };
    sections[sIdx] = { ...sections[sIdx], fields };
    setEditing({ ...editing, sections });
  }

  function updateOtherField(fIdx: number, patch: Partial<FormFieldDef>) {
    if (!editing) return;
    const otherFields = [...editing.otherFields];
    otherFields[fIdx] = { ...otherFields[fIdx], ...patch };
    setEditing({ ...editing, otherFields });
  }

  function addSection() {
    if (!editing) return;
    setEditing({ ...editing, sections: [...editing.sections, { name: `Secțiune ${editing.sections.length + 1}`, fields: [] }] });
  }

  function removeSection(sIdx: number) {
    if (!editing) return;
    setEditing({ ...editing, sections: editing.sections.filter((_, i) => i !== sIdx) });
  }

  function addFieldToSection(sIdx: number, type: FieldType) {
    if (!editing) return;
    const sections = [...editing.sections];
    sections[sIdx] = { ...sections[sIdx], fields: [...sections[sIdx].fields, emptyField(type)] };
    setEditing({ ...editing, sections });
    setPickerFor(null);
    setOpenFieldPath(`section-${sIdx}-${sections[sIdx].fields.length - 1}`);
  }

  function addOtherField(type: FieldType) {
    if (!editing) return;
    setEditing({ ...editing, otherFields: [...editing.otherFields, emptyField(type)] });
    setPickerFor(null);
    setOpenFieldPath(`other-${editing.otherFields.length}`);
  }

  async function handleSave() {
    if (!editing) return;
    setError(null);
    try {
      if (editingId) await updateForm(editingId, editing);
      else await createForm(editing);
      toast.success(editingId ? "Șablon actualizat." : "Șablon creat.");
      setEditing(null);
      setEditingId(null);
      load();
    } catch (e: any) {
      const raw = e?.response?.data?.error;
      // `raw` poate fi un obiect Zod (flatten()) dacă validarea a eșuat pe backend —
      // nu-l randăm direct ca JSX (ar crăpa React), afișăm un mesaj generic în schimb.
      const message = typeof raw === "string" ? raw : raw ? "Date invalide — verifică toate câmpurile obligatorii (Cheie, Titlu, Etichetă)." : "Nu am putut salva șablonul";
      setError(message);
    }
  }

  async function togglePublish(f: FormDef) {
    if (f.status === "PUBLISHED") await unpublishForm(f.id);
    else await publishForm(f.id);
    load();
  }

  if (editing) {
    return (
      <AppShell title={editingId ? "Editare șablon" : "Șablon nou"} subtitle="Formular cerere, document intern sau document extern — cu bibliotecă extinsă de câmpuri">
        <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
          <Button variant="ghost" onClick={() => setEditing(null)}>← Înapoi la listă</Button>
          <Button variant="ghost" onClick={() => setPreviewing(true)}>Previzualizare formular</Button>
        </div>

        {previewing && <FullFormPreview form={editing} onClose={() => setPreviewing(false)} />}

        <Card style={{ marginBottom: 20 }}>
          <SectionHeader title="Detalii șablon" />
          <FieldLabel>Iconiță</FieldLabel>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
            {FORM_ICON_CHOICES.map(({ name, Icon }) => (
              <button
                key={name}
                onClick={() => setEditing({ ...editing, icon: name })}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 7,
                  border: `1.5px solid ${editing.icon === name ? T.brand : T.line}`,
                  background: editing.icon === name ? T.brandTint : T.card,
                  color: T.brand,
                  cursor: "pointer",
                }}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <FieldLabel>Tip șablon</FieldLabel>
              <select value={editing.templateType} onChange={(e) => setEditing({ ...editing, templateType: e.target.value as TemplateType })} style={{ width: "100%" }}>
                {Object.entries(TEMPLATE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <FieldLabel>Nume (intern)</FieldLabel>
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} style={{ width: "100%" }} />
            </div>
            <div>
              <FieldLabel>Categorie (leagă de workflow/registratură)</FieldLabel>
              <input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} style={{ width: "100%" }} placeholder="ex: cis" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <FieldLabel>Titlu (afișat în document)</FieldLabel>
              <input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} style={{ width: "100%" }} />
            </div>
            <div>
              <FieldLabel>Subtitlu</FieldLabel>
              <input value={editing.subtitle || ""} onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })} style={{ width: "100%" }} />
            </div>
          </div>
          <FieldLabel>Descriere</FieldLabel>
          <input value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} style={{ width: "100%" }} />
        </Card>

        {editing.templateType === "REQUEST_FORM" && (
          <Card id="form-builder-portal-config-card" style={{ marginBottom: 20 }}>
            <SectionHeader title="Configurare Portal" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div>
                <FieldLabel>Secțiune catalog public</FieldLabel>
                <select value={editing.portalSection || ""} onChange={(e) => setEditing({ ...editing, portalSection: (e.target.value || null) as any })} style={{ width: "100%" }}>
                  <option value="">Fără secțiune</option>
                  <option value="INFO">Informații</option>
                  <option value="DOCUMENTE">Documente</option>
                  <option value="PETITII">Petiții</option>
                  <option value="AUDIENTE">Audiențe</option>
                </select>
              </div>
              <div>
                <FieldLabel>Tip serviciu electronic</FieldLabel>
                <select value={editing.completeness || "COMPLETE"} onChange={(e) => setEditing({ ...editing, completeness: e.target.value as any })} style={{ width: "100%" }}>
                  <option value="COMPLETE">Complet (integral online)</option>
                  <option value="PARTIAL">Parțial (necesită și pas fizic)</option>
                </select>
              </div>
              <div>
                <FieldLabel>Acces</FieldLabel>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 8 }}>
                  <input type="checkbox" checked={!!editing.requiresAuth} onChange={(e) => setEditing({ ...editing, requiresAuth: e.target.checked })} />
                  Necesită autentificare (invizibil pentru vizitatori anonimi)
                </label>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <FieldLabel>Titlu (EN, opțional)</FieldLabel>
                <input value={editing.titleEn || ""} onChange={(e) => setEditing({ ...editing, titleEn: e.target.value })} style={{ width: "100%" }} />
              </div>
              <div>
                <FieldLabel>Descriere (EN, opțional)</FieldLabel>
                <input value={editing.descriptionEn || ""} onChange={(e) => setEditing({ ...editing, descriptionEn: e.target.value })} style={{ width: "100%" }} />
              </div>
            </div>
          </Card>
        )}

        <Card id="form-builder-mapping-card" style={{ marginBottom: 20 }}>
          <SectionHeader title="Mapare pe entitatea Cerere" />
          <p style={{ fontSize: 12.5, color: T.ink3, marginTop: -8, marginBottom: 12 }}>
            Nume și E-mail sunt colectate automat (din cont sau formularul petentului) — nu necesită mapare. Pentru celelalte roluri, mapează-le pe un câmp din formular mai jos.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>Nume</span>
              <Pill color={T.success} bg={T.successTint}>colectat automat</Pill>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span>E-mail</span>
              <Pill color={T.success} bg={T.successTint}>colectat automat</Pill>
            </div>
            {CANONICAL_ROLES.filter((r) => r.value !== "NUME" && r.value !== "EMAIL").map((r) => {
              const mapped = allFields.find((f) => f.canonicalRole === r.value);
              return (
                <div key={r.value} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span>{r.label}</span>
                  {mapped ? (
                    <Pill color={T.success} bg={T.successTint}>mapat pe „{mapped.label}”</Pill>
                  ) : (
                    <Pill color={T.warn} bg={T.warnTint}>nemapat încă</Pill>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {editingId ? (
          <NomenclatorLinksSection formId={editingId} allFieldKeys={allFieldKeys} />
        ) : (
          <Card style={{ marginBottom: 20 }}>
            <SectionHeader title="Nomenclatoare asociate" />
            <p style={{ fontSize: 12.5, color: T.ink3, margin: 0 }}>Salvează șablonul întâi — nomenclatoarele se pot atașa doar unui șablon deja salvat.</p>
          </Card>
        )}

        <Card style={{ marginBottom: 20 }}>
          <SectionHeader title="Formular (secțiuni vizibile solicitantului)" />
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {editing.sections.map((section, sIdx) => (
              <div key={sIdx} style={{ padding: 14, background: T.bgSoft, borderRadius: 12 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 10, alignItems: "center" }}>
                  <input
                    value={section.name}
                    onChange={(e) => {
                      const sections = [...editing.sections];
                      sections[sIdx] = { ...sections[sIdx], name: e.target.value };
                      setEditing({ ...editing, sections });
                    }}
                    style={{ flex: 1, fontWeight: 700 }}
                  />
                  <Button variant="danger" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => removeSection(sIdx)}>Șterge secțiunea</Button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {section.fields.map((field, fIdx) => (
                    <FieldRow
                      key={fIdx}
                      field={field}
                      isOpen={openFieldPath === `section-${sIdx}-${fIdx}`}
                      onToggle={() => setOpenFieldPath(openFieldPath === `section-${sIdx}-${fIdx}` ? null : `section-${sIdx}-${fIdx}`)}
                      allFieldKeys={allFieldKeys}
                      onChange={(patch) => updateSectionField(sIdx, fIdx, patch)}
                      onRemove={() => {
                        const sections = [...editing.sections];
                        sections[sIdx] = { ...sections[sIdx], fields: sections[sIdx].fields.filter((_, i) => i !== fIdx) };
                        setEditing({ ...editing, sections });
                      }}
                    />
                  ))}
                </div>
                <Button id={sIdx === 0 ? "form-builder-add-field-btn" : undefined} variant="ghost" style={{ marginTop: 10, fontSize: 12 }} onClick={() => setPickerFor(pickerFor === `section-${sIdx}` ? null : `section-${sIdx}`)}>
                  + Câmp în secțiune
                </Button>
                {pickerFor === `section-${sIdx}` && <FieldTypePicker onSelect={(t) => addFieldToSection(sIdx, t)} onClose={() => setPickerFor(null)} />}
              </div>
            ))}
          </div>
          <Button id="form-builder-add-section-btn" variant="ghost" style={{ marginTop: 14 }} onClick={addSection}>+ Secțiune</Button>
        </Card>

        <Card style={{ marginBottom: 20 }}>
          <SectionHeader title="Alte cerințe (câmpuri fără secțiune)" />
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {editing.otherFields.map((field, fIdx) => (
              <FieldRow
                key={fIdx}
                field={field}
                isOpen={openFieldPath === `other-${fIdx}`}
                onToggle={() => setOpenFieldPath(openFieldPath === `other-${fIdx}` ? null : `other-${fIdx}`)}
                allFieldKeys={allFieldKeys}
                onChange={(patch) => updateOtherField(fIdx, patch)}
                onRemove={() => setEditing({ ...editing, otherFields: editing.otherFields.filter((_, i) => i !== fIdx) })}
              />
            ))}
          </div>
          <Button variant="ghost" style={{ marginTop: 10 }} onClick={() => setPickerFor(pickerFor === "other" ? null : "other")}>+ Cerință</Button>
          {pickerFor === "other" && <FieldTypePicker onSelect={addOtherField} onClose={() => setPickerFor(null)} />}
        </Card>

        {error && <p style={{ color: T.danger, marginBottom: 14 }}>{error}</p>}
        <Button onClick={handleSave}>Salvează șablonul</Button>
      </AppShell>
    );
  }

  return (
    <AppShell title="Editor de șabloane" subtitle="Formulare de cerere, documente interne și externe — configurabile, fără cod">
      <div style={{ marginBottom: 20 }}>
        <Button id="form-builder-new-btn" onClick={startCreate}>+ Șablon nou</Button>
      </div>
      {error && <p style={{ color: T.danger }}>{error}</p>}
      <SectionHeader title={`${forms.length} șabloane`} />
      <div style={{ display: "grid", gap: 12 }}>
        {forms.map((f, fIdx) => {
          const Icon = formIconOf(f.icon);
          return (
          <Card key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: T.brandTint, display: "flex", alignItems: "center", justifyContent: "center", color: T.brand, flexShrink: 0 }}>
                <Icon size={18} />
              </div>
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontWeight: 700 }}>{f.name}</span>
                  <Pill>{TEMPLATE_TYPE_LABELS[f.templateType]}</Pill>
                </div>
                <div style={{ fontSize: 12, color: T.ink3 }}>
                  categorie: {f.category} · {f.sections.reduce((n, s) => n + s.fields.length, 0) + f.fields.length} câmpuri
                </div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {f.status === "PUBLISHED" ? (
                <Pill color={T.success} bg={T.successTint}>Publicat</Pill>
              ) : (
                <Pill color={T.warn} bg={T.warnTint}>Ciornă</Pill>
              )}
              <Button variant="ghost" style={{ padding: "8px 12px", fontSize: 12 }} onClick={() => downloadFormPdf(f.id, f.category)}>⬇ PDF</Button>
              <Button variant="ghost" style={{ padding: "8px 12px", fontSize: 12 }} onClick={() => startEdit(f)}>Editează</Button>
              <Button id={fIdx === 0 ? "form-builder-publish-btn" : undefined} variant="ghost" style={{ padding: "8px 12px", fontSize: 12 }} onClick={() => togglePublish(f)}>
                {f.status === "PUBLISHED" ? "Retrage" : "Publică"}
              </Button>
            </div>
          </Card>
          );
        })}
        {forms.length === 0 && <p style={{ color: T.ink3 }}>Niciun șablon creat încă.</p>}
      </div>
    </AppShell>
  );
}
