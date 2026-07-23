import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { Card, Button, FieldLabel, SectionHeader, Pill } from "../components/ui";
import { FileText } from "lucide-react";
import { useAuth } from "../features/iam/AuthContext";
import { T, statusFor } from "../theme";
import {
  fetchPortalForms,
  submitForm,
  fetchMyRequests,
  fetchMyRequestDetail,
  fetchDocumentBlob,
  FormDef,
  FormFieldDef,
  MyRequestSummary,
  MyRequestDetail,
  PortalSection,
} from "../features/dms/api";

// Grupare catalog public pe cele 4 secțiuni cerute explicit (4.5.1 R37) — `null`
// (formulare vechi, fără secțiune asignată) cade în categoria implicită "Altele".
const PORTAL_SECTION_ORDER: (PortalSection | null)[] = ["INFO", "DOCUMENTE", "PETITII", "AUDIENTE", null];
const PORTAL_SECTION_LABELS: Record<string, string> = {
  INFO: "Informații",
  DOCUMENTE: "Documente",
  PETITII: "Petiții",
  AUDIENTE: "Audiențe",
  ALTELE: "Alte servicii",
};
import { FIELD_CATALOG } from "../features/dms/fieldCatalog";
import { fetchFormNomenclatorLinks, FormNomenclatorLinkDto } from "../features/nomenclatoare/api";

async function openDocument(documentId: string) {
  const blob = await fetchDocumentBlob(documentId);
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
}

function conditionsSatisfied(field: FormFieldDef, values: Record<string, unknown>): boolean {
  const conditions = field.conditions || [];
  return conditions.every((c) => {
    const actual = String(values[c.field] ?? "");
    return c.operator === "not_equals" ? actual !== c.value : actual === c.value;
  });
}

// Câmpurile din categoria "Sistem" (Cont, Înregistrare, Definiție acces etc.) nu se
// afișează cetățeanului — sunt administrative, populate/activate de motorul de workflow.
function isCitizenFacing(field: FormFieldDef): boolean {
  return FIELD_CATALOG[field.type].category !== "SYSTEM";
}

function FieldInput({ field, value, onChange }: { field: FormFieldDef; value: unknown; onChange: (v: unknown) => void }) {
  const options = (field.config?.options as string[] | undefined) || [];

  switch (field.type) {
    case "STATIC_TEXT":
      return <p style={{ fontSize: 13, color: T.ink2, margin: 0 }}>{(field.config?.text as string) || field.label}</p>;
    case "LINK": {
      const url = (field.config?.url as string) || "#";
      return <a href={url} target="_blank" rel="noopener noreferrer">{(field.config?.linkLabel as string) || field.label}</a>;
    }
    case "MEDIA":
      return field.config?.mediaUrl ? <img src={field.config.mediaUrl as string} alt={field.label} style={{ maxWidth: "100%", borderRadius: 8 }} /> : null;
    case "DROPDOWN":
    case "REGION":
      return (
        <select value={(value as string) || ""} onChange={(e) => onChange(e.target.value)} style={{ width: "100%" }} disabled={field.disabled || field.readOnly}>
          <option value="">{field.placeholder || "Selectează..."}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    case "RADIO":
    case "SURVEY":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {options.map((o) => (
            <label key={o} style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
              <input type="radio" name={field.key} checked={value === o} onChange={() => onChange(o)} disabled={field.disabled || field.readOnly} /> {o}
            </label>
          ))}
        </div>
      );
    case "MULTI_CHECKBOX":
    case "NESTED_CHECKBOXES": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {options.map((o) => (
            <label key={o} style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={selected.includes(o)}
                onChange={(e) => onChange(e.target.checked ? [...selected, o] : selected.filter((s) => s !== o))}
                disabled={field.disabled || field.readOnly}
              />
              {o}
            </label>
          ))}
        </div>
      );
    }
    case "CHECKBOX":
    case "TOGGLE":
      return <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} disabled={field.disabled || field.readOnly} />;
    case "STAR_RATING": {
      const max = Number(field.config?.maxStars) || 5;
      const current = Number(value) || 0;
      return (
        <div style={{ fontSize: 22, cursor: field.readOnly ? "default" : "pointer" }}>
          {Array.from({ length: max }).map((_, i) => (
            <span key={i} onClick={() => !field.readOnly && onChange(i + 1)} style={{ color: i < current ? T.warn : T.line }}>★</span>
          ))}
        </div>
      );
    }
    case "SCALE": {
      const min = Number(field.config?.min) || 1;
      const max = Number(field.config?.max) || 10;
      return (
        <div>
          <input type="range" min={min} max={max} value={Number(value) || min} onChange={(e) => onChange(Number(e.target.value))} style={{ width: "100%" }} disabled={field.readOnly} />
          <div style={{ fontSize: 12, color: T.ink3 }}>{Number(value) || min} ({min}–{max})</div>
        </div>
      );
    }
    case "LONG_TEXT":
      return (
        <textarea
          value={(value as string) || field.defaultValue || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          maxLength={field.maxLength}
          style={{ width: "100%", minHeight: 90 }}
          disabled={field.disabled || field.readOnly}
        />
      );
    case "DATE":
    case "DATETIME":
    case "TIME":
      return (
        <input
          type={field.type === "DATE" ? "date" : field.type === "TIME" ? "time" : "datetime-local"}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%" }}
          disabled={field.disabled || field.readOnly}
        />
      );
    case "SCHEDULE":
      return (
        <input
          type="text"
          placeholder="ex: Luni-Vineri, 09:00-14:00"
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%" }}
        />
      );
    case "MAP_POINT":
      return (
        <div>
          <input
            type="text"
            placeholder="latitudine, longitudine"
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: "100%" }}
          />
          <p style={{ fontSize: 11, color: T.ink3, marginTop: 4 }}>Selector interactiv de hartă — în lucru; introdu coordonatele manual deocamdată.</p>
        </div>
      );
    case "FILE_UPLOAD":
    case "FILE_UPLOAD_AI":
    case "CARD_EXTRACT_AI":
      return (
        <p style={{ fontSize: 12, color: T.ink3, fontStyle: "italic", margin: 0 }}>
          Poți atașa acest document după înregistrare, din ecranul de detalii al cererii.
        </p>
      );
    case "SHORT_NUMBER":
      return (
        <input
          type="number"
          value={(value as string) ?? field.defaultValue ?? ""}
          min={field.minValue}
          max={field.maxValue}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%" }}
          disabled={field.disabled || field.readOnly}
        />
      );
    case "EMAIL":
      return (
        <input
          type="email"
          value={(value as string) ?? field.defaultValue ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          style={{ width: "100%" }}
          disabled={field.disabled || field.readOnly}
        />
      );
    default:
      return (
        <input
          type="text"
          value={(value as string) ?? field.defaultValue ?? ""}
          maxLength={field.maxLength}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          style={{ width: "100%" }}
          disabled={field.disabled || field.readOnly}
        />
      );
  }
}

function FieldBlock({ field, value, onChange }: { field: FormFieldDef; value: unknown; onChange: (v: unknown) => void }) {
  if (field.type === "STATIC_TEXT" || field.type === "LINK" || field.type === "MEDIA") {
    return <div style={{ marginBottom: 14 }}><FieldInput field={field} value={value} onChange={onChange} /></div>;
  }
  return (
    <div style={{ marginBottom: 14 }}>
      <FieldLabel>
        {field.label}
        {field.required ? " *" : ""}
      </FieldLabel>
      <FieldInput field={field} value={value} onChange={onChange} />
      {field.helpText && <p style={{ fontSize: 11, color: T.ink3, marginTop: 4 }}>{field.helpText}</p>}
    </div>
  );
}

function SubmissionForm({ form, onDone }: { form: FormDef; onDone: (registryNumber: string) => void }) {
  const { user } = useAuth();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [anonName, setAnonName] = useState("");
  const [anonEmail, setAnonEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nomenclatorLinks, setNomenclatorLinks] = useState<FormNomenclatorLinkDto[]>([]);
  const [nomenclatorPicks, setNomenclatorPicks] = useState<Record<string, string>>({}); // linkId -> entryId

  useEffect(() => {
    fetchFormNomenclatorLinks(form.id).then(setNomenclatorLinks).catch(() => setNomenclatorLinks([]));
  }, [form.id]);

  // Precompletare din profil (4.5.1 R40) — doar câmpurile marcate explicit
  // `autofillFromProfile`, mapate pe NUME/EMAIL prin `canonicalRole` (deja existent).
  useEffect(() => {
    if (!user) return;
    const allFields = [...form.sections.flatMap((s) => s.fields), ...form.fields];
    const patch: Record<string, unknown> = {};
    for (const f of allFields) {
      if (!f.autofillFromProfile) continue;
      if (f.canonicalRole === "NUME" && user.name) patch[f.key] = user.name;
      if (f.canonicalRole === "EMAIL") patch[f.key] = user.email;
    }
    if (Object.keys(patch).length) setValues((prev) => ({ ...patch, ...prev }));
  }, [form, user]);

  // La alegerea unei intrări dintr-un nomenclator atașat, precompletăm dintr-o dată
  // toate câmpurile mapate (cerință explicită) — nu doar unul singur.
  function applyNomenclatorEntry(link: FormNomenclatorLinkDto, entryId: string) {
    setNomenclatorPicks((prev) => ({ ...prev, [link.id]: entryId }));
    const entry = link.nomenclator?.entries?.find((e) => e.id === entryId);
    if (!entry) return;
    const patch: Record<string, unknown> = {};
    for (const [nomenclatorFieldKey, formFieldKey] of Object.entries(link.fieldMapping)) {
      patch[formFieldKey] = entry.values[nomenclatorFieldKey];
    }
    setValues((prev) => ({ ...prev, ...patch }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const submitterName = user ? user.name || user.email : anonName.trim();
    const submitterEmail = user ? user.email : anonEmail.trim();
    if (!submitterName || !submitterEmail) {
      setError("Numele și adresa de e-mail sunt obligatorii.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitForm(form.id, { submitterName, submitterEmail, data: values });
      onDone(result.registryNumber);
    } catch (err: any) {
      const raw = err?.response?.data?.error;
      setError(typeof raw === "string" ? raw : raw ? "Date invalide în formular." : "Depunere eșuată");
    } finally {
      setSubmitting(false);
    }
  }

  const visibleSections = form.sections.map((s) => ({
    ...s,
    fields: s.fields.filter((f) => isCitizenFacing(f) && conditionsSatisfied(f, values)),
  }));
  const visibleOtherFields = form.fields.filter((f) => isCitizenFacing(f) && conditionsSatisfied(f, values));

  return (
    <Card>
      {form.title && <h2 style={{ fontSize: 20, marginBottom: 2 }}>{form.title}</h2>}
      {form.subtitle && <p style={{ color: T.ink3, marginTop: 0, marginBottom: 18 }}>{form.subtitle}</p>}
      {!form.title && <SectionHeader title={form.name} />}
      {user ? (
        <p id="portal-auth-status" style={{ fontSize: 12, color: T.ink3, marginTop: -8, marginBottom: 18 }}>
          Depui ca <strong>{user.name || user.email}</strong> — cererea va apărea în „Cererile mele”.
        </p>
      ) : (
        <div id="portal-auth-status" style={{ marginBottom: 18, padding: 12, background: T.bgSoft, borderRadius: 10 }}>
          <p style={{ fontSize: 12, color: T.ink3, marginTop: 0, marginBottom: 10 }}>
            Depui ca vizitator neautentificat. Poți depune fără cont, dar cererea nu va putea fi urmărită în „Cererile mele” —{" "}
            <Link to="/login" style={{ color: T.brand }}>autentifică-te</Link> pentru a o putea urmări online.
          </p>
          <FieldLabel>Nume complet *</FieldLabel>
          <input type="text" value={anonName} onChange={(e) => setAnonName(e.target.value)} style={{ width: "100%", marginBottom: 10 }} />
          <FieldLabel>E-mail *</FieldLabel>
          <input type="email" value={anonEmail} onChange={(e) => setAnonEmail(e.target.value)} style={{ width: "100%" }} />
        </div>
      )}
      {nomenclatorLinks.length > 0 && (
        <div style={{ marginBottom: 18, padding: 12, background: T.brandTint, borderRadius: 10 }}>
          {nomenclatorLinks.map((link) => (
            <div key={link.id} style={{ marginBottom: 8 }}>
              <FieldLabel>Selectează din {link.nomenclator?.name}</FieldLabel>
              <select
                value={nomenclatorPicks[link.id] || ""}
                onChange={(e) => applyNomenclatorEntry(link, e.target.value)}
                style={{ width: "100%" }}
              >
                <option value="">Alege o intrare pentru precompletare automată...</option>
                {(link.nomenclator?.entries || []).map((entry) => {
                  const fields = link.nomenclator!.fields;
                  const label = fields.map((f) => entry.values[f.key]).filter(Boolean).join(" — ");
                  return <option key={entry.id} value={entry.id}>{label || entry.id}</option>;
                })}
              </select>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={handleSubmit}>
        {visibleSections.map((section) => (
          <div key={section.name} style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: T.indigo }}>{section.name}</div>
            {section.fields.map((field) => (
              <FieldBlock key={field.key} field={field} value={values[field.key]} onChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))} />
            ))}
          </div>
        ))}
        {visibleOtherFields.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: T.indigo }}>Alte cerințe</div>
            {visibleOtherFields.map((field) => (
              <FieldBlock key={field.key} field={field} value={values[field.key]} onChange={(v) => setValues((prev) => ({ ...prev, [field.key]: v }))} />
            ))}
          </div>
        )}
        {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}
        <Button id="portal-submit-btn" type="submit" style={{ opacity: submitting ? 0.7 : 1 }}>
          {submitting ? "Se depune..." : "Depune cererea"}
        </Button>
      </form>
    </Card>
  );
}

function TabButton({ active, onClick, children, id }: { active: boolean; onClick: () => void; children: React.ReactNode; id?: string }) {
  return (
    <button
      id={id}
      onClick={onClick}
      style={{
        padding: "8px 16px",
        borderRadius: 999,
        border: "none",
        background: active ? T.indigo : T.line2,
        color: active ? "#fff" : T.ink2,
        fontWeight: 700,
        fontSize: 13,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// "Cererile mele" — vizibil doar pentru un cont autentificat (Scenariul 1, pct. 5 și 16):
// listă cereri proprii +, odată semnat, răspunsul oficial disponibil pentru descărcare.
function MyRequestsTab() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<MyRequestSummary[] | null>(null);
  const [detail, setDetail] = useState<MyRequestDetail | null>(null);

  useEffect(() => {
    if (!user) return;
    fetchMyRequests()
      .then(setRequests)
      .catch(() => setRequests([]));
  }, [user]);

  if (!user) {
    return (
      <Card>
        <p style={{ color: T.ink2, marginTop: 0 }}>
          Autentifică-te pentru a-ți vedea cererile depuse și răspunsurile oficiale primite.
        </p>
        <div style={{ display: "flex", gap: 10 }}>
          <Link to="/login"><Button>Autentificare</Button></Link>
          <Link to="/register"><Button variant="ghost">Creează cont</Button></Link>
        </div>
      </Card>
    );
  }

  if (detail) {
    const signedResponse = detail.responses.find((r) => r.status === "SIGNED" || r.status === "SENT");
    return (
      <div>
        <div style={{ marginBottom: 14 }}>
          <Button variant="ghost" onClick={() => setDetail(null)}>← Înapoi la cererile mele</Button>
        </div>
        <Card>
          <SectionHeader title={`Cererea ${detail.registryNumber}`} />
          <p style={{ fontSize: 13, color: T.ink3, marginTop: -8 }}>{detail.form?.title || detail.form?.name}</p>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }}>
            {detail.workflowCase?.currentState && (
              <Pill color={detail.workflowCase.currentState.color} bg={T.line2}>{detail.workflowCase.currentState.name}</Pill>
            )}
            {detail.legalDeadline && (() => {
              const days = Math.ceil((new Date(detail.legalDeadline!).getTime() - Date.now()) / 86_400_000);
              const st = statusFor(days);
              return <Pill color={st.color} bg={st.bg}>Termen legal: {st.label}</Pill>;
            })()}
          </div>
          {signedResponse ? (
            <div style={{ padding: 14, background: T.bgSoft, borderRadius: 10, marginBottom: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Răspuns oficial nr. {signedResponse.outboundNumber}</div>
              {signedResponse.document && (
                <Button variant="ghost" onClick={() => openDocument(signedResponse.document!.id)}>Vezi documentul semnat</Button>
              )}
            </div>
          ) : (
            <p style={{ color: T.ink3, fontSize: 13 }}>
              Cererea este încă în lucru — răspunsul oficial va apărea aici, disponibil pentru descărcare, odată semnat și transmis.
            </p>
          )}
          {detail.documents.length > 0 && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Documente atașate de tine</div>
              {detail.documents.map((d) => (
                <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${T.line}` }}>
                  <span style={{ fontSize: 13 }}>{d.filename}</span>
                  <Button variant="ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => openDocument(d.id)}>Deschide</Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {requests === null && <p style={{ color: T.ink3 }}>Se încarcă...</p>}
      {requests?.map((r) => {
        const signed = r.responses.find((x) => x.status === "SIGNED" || x.status === "SENT");
        return (
          <Card key={r.id} style={{ cursor: "pointer" }}>
            <div
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              onClick={() => fetchMyRequestDetail(r.id).then(setDetail)}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{r.registryNumber} — {r.form?.name}</div>
                <div style={{ fontSize: 12, color: T.ink3 }}>Depusă la {new Date(r.registeredAt).toLocaleDateString("ro-RO")}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {r.workflowCase?.currentState && (
                  <Pill color={r.workflowCase.currentState.color} bg={T.line2}>{r.workflowCase.currentState.name}</Pill>
                )}
                {signed && <Pill color={T.success} bg={T.successTint}>Răspuns disponibil</Pill>}
              </div>
            </div>
          </Card>
        );
      })}
      {requests?.length === 0 && <p style={{ color: T.ink3 }}>Nu ai depus încă nicio cerere.</p>}
    </div>
  );
}

export default function PortalPage() {
  const [tab, setTab] = useState<"forms" | "mine">("forms");
  const [forms, setForms] = useState<FormDef[]>([]);
  const [selected, setSelected] = useState<FormDef | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  useEffect(() => {
    fetchPortalForms().then(setForms).catch(() => setForms([]));
  }, []);

  if (confirmation) {
    return (
      <AppShell title="Cerere depusă" subtitle="Portalul public ANS">
        <Card>
          <p id="portal-success-msg" style={{ fontSize: 16, color: T.ink }}>
            Cererea ta a fost înregistrată cu numărul <strong>{confirmation}</strong>.
          </p>
          <p style={{ color: T.ink3, fontSize: 13 }}>Vei primi o notificare pe email la actualizarea statusului.</p>
          <Button
            onClick={() => {
              setConfirmation(null);
              setSelected(null);
            }}
          >
            Înapoi la formulare
          </Button>
        </Card>
      </AppShell>
    );
  }

  if (selected) {
    return (
      <AppShell title={selected.name} subtitle="Completează formularul de mai jos">
        <div style={{ marginBottom: 14 }}>
          <Button variant="ghost" onClick={() => setSelected(null)}>← Înapoi</Button>
        </div>
        <SubmissionForm form={selected} onDone={(nr) => setConfirmation(nr)} />
      </AppShell>
    );
  }

  return (
    <AppShell title="Portal servicii ANS" subtitle="Formulare publicate și cererile tale">
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <TabButton id="portal-tab-forms" active={tab === "forms"} onClick={() => setTab("forms")}>Formulare disponibile</TabButton>
        <TabButton active={tab === "mine"} onClick={() => setTab("mine")}>Cererile mele</TabButton>
      </div>

      {tab === "forms" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {PORTAL_SECTION_ORDER.map((sectionKey) => {
            const sectionForms = forms.filter((f) => (f.portalSection || null) === sectionKey);
            if (sectionForms.length === 0) return null;
            return (
              <div key={sectionKey || "altele"}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: T.ink3, marginBottom: 10 }}>
                  {PORTAL_SECTION_LABELS[sectionKey || "ALTELE"]}
                </div>
                <div style={{ display: "grid", gap: 12 }}>
                  {sectionForms.map((f, fIdx) => (
                    <Card key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} >
                      <div onClick={() => setSelected(f)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 14 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: T.brandTint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: T.brand }}>
                          <FileText size={20} />
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ fontWeight: 700 }}>{f.name}</div>
                            <Pill color={f.completeness === "COMPLETE" ? T.success : T.warn} bg={f.completeness === "COMPLETE" ? T.successTint : T.warnTint}>
                              {f.completeness === "COMPLETE" ? "Serviciu complet online" : "Serviciu parțial online"}
                            </Pill>
                          </div>
                          {f.description && <div style={{ fontSize: 13, color: T.ink3, marginTop: 2 }}>{f.description}</div>}
                        </div>
                      </div>
                      <Button id={fIdx === 0 && sectionKey === PORTAL_SECTION_ORDER[0] ? "portal-complete-btn" : undefined} style={{ padding: "8px 14px", fontSize: 13 }} onClick={() => setSelected(f)}>Completează</Button>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
          {forms.length === 0 && <p style={{ color: T.ink3 }}>Niciun formular publicat momentan.</p>}
        </div>
      ) : (
        <MyRequestsTab />
      )}

      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 32, paddingTop: 20, borderTop: `1px solid ${T.line}` }}>
        <Link to="/pagini/termeni-si-conditii" style={{ fontSize: 12.5, color: T.ink3 }}>Termeni și condiții</Link>
        <Link to="/pagini/politica-de-confidentialitate" style={{ fontSize: 12.5, color: T.ink3 }}>Politică de confidențialitate</Link>
        <Link to="/pagini/contact" style={{ fontSize: 12.5, color: T.ink3 }}>Contact</Link>
      </div>
    </AppShell>
  );
}
