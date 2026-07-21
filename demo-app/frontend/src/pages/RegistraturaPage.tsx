import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Settings2, Download, Upload, Search } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Card, Button, FieldLabel, SectionHeader, Pill } from "../components/ui";
import { Modal } from "../components/Modal";
import { T, statusFor } from "../theme";
import {
  fetchRequests,
  fetchRegistries,
  createRegistry,
  updateRegistry,
  fetchTemplates,
  updateTemplateNumbering,
  exportRequestsXlsx,
  importRequests,
  DmsRequestSummary,
  NumberingRegistryDto,
  ResponseTemplateDto,
  RegistryKind,
  RequestFilters,
} from "../features/dms/api";

// Semantică de culoare aliniată cu convenția URBIO: albastru = în verificare,
// mov = în progres, galben = în așteptare, verde = finalizat, roșu = respins.
const STATUS_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  NOU: { color: T.info, bg: T.infoTint, label: "Nou" },
  IN_LUCRU: { color: T.progress, bg: T.progressTint, label: "În lucru" },
  IN_ASTEPTARE: { color: T.warn, bg: T.warnTint, label: "În așteptare" },
  FINALIZAT: { color: T.success, bg: T.successTint, label: "Finalizat" },
  RESPINS: { color: T.danger, bg: T.dangerTint, label: "Respins" },
};

const KIND_LABELS: Record<RegistryKind, string> = { INTRARE: "Intrare", INTERN: "Intern", IESIRE: "Ieșire" };

function fmtDate(iso?: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("ro-RO") : "";
}

function RegistriesPanel({ onClose }: { onClose: () => void }) {
  const [registries, setRegistries] = useState<NumberingRegistryDto[]>([]);
  const [templates, setTemplates] = useState<ResponseTemplateDto[]>([]);
  const [draft, setDraft] = useState<{ name: string; code: string; kind: RegistryKind; startNumber: string }>({
    name: "",
    code: "",
    kind: "INTRARE",
    startNumber: "1",
  });
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetchRegistries().then(setRegistries).catch(() => setRegistries([]));
    fetchTemplates().then(setTemplates).catch(() => setTemplates([]));
  }
  useEffect(load, []);

  async function handleCreate() {
    setError(null);
    try {
      await createRegistry({ name: draft.name, code: draft.code.toUpperCase(), kind: draft.kind, startNumber: Number(draft.startNumber) || 1 });
      setDraft({ name: "", code: "", kind: "INTRARE", startNumber: "1" });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Nu am putut crea registrul");
    }
  }

  async function handleSetDefault(r: NumberingRegistryDto) {
    await updateRegistry(r.id, { isDefault: true });
    load();
  }

  async function handleTemplateModeChange(t: ResponseTemplateDto, outboundMode: "SAME_AS_ENTRY" | "FROM_REGISTRY") {
    await updateTemplateNumbering(t.id, { outboundMode, outboundRegistryId: outboundMode === "SAME_AS_ENTRY" ? null : t.outboundRegistryId });
    load();
  }

  async function handleTemplateRegistryChange(t: ResponseTemplateDto, outboundRegistryId: string) {
    await updateTemplateNumbering(t.id, { outboundRegistryId: outboundRegistryId || null });
    load();
  }

  const iesireRegistries = registries.filter((r) => r.kind === "IESIRE");

  return (
    <Modal onClose={onClose} width={720} maxHeight="86vh">
        <Card>
          <SectionHeader title="Registre de numerotare" />
          <p style={{ fontSize: 12.5, color: T.ink3, marginTop: -8, marginBottom: 16 }}>Fiecare registru are propriul contor anual — poate porni de la orice număr ales.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
            {registries.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: T.bgSoft, borderRadius: 10, fontSize: 13 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Pill color={T.ink3} bg={T.line2}>{KIND_LABELS[r.kind]}</Pill>
                  <span style={{ fontWeight: 700 }}>{r.name}</span>
                  <span style={{ color: T.ink3, fontFamily: "monospace" }}>{r.code ? `${r.code}-N/AN` : "N/AN"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ color: T.ink3, fontSize: 12 }}>
                    start: {r.startNumber} · ultimul emis {new Date().getFullYear()}: {r.currentYearLastNumber ?? "—"}
                  </span>
                  {r.isDefault ? (
                    <Pill color={T.success} bg={T.successTint}>implicit</Pill>
                  ) : (
                    <Button variant="ghost" style={{ padding: "4px 10px", fontSize: 11.5 }} onClick={() => handleSetDefault(r)}>Fă implicit</Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: `1px solid ${T.line2}`, paddingTop: 14, marginBottom: 18 }}>
            <FieldLabel>Registru nou</FieldLabel>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Nume (ex. Registru intrări Direcția Juridică)" style={{ flex: 2 }} />
              <input value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value })} placeholder="Cod (ex. JUR)" style={{ flex: 1 }} />
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as RegistryKind })} style={{ flex: 1 }}>
                <option value="INTRARE">Intrare</option>
                <option value="INTERN">Intern</option>
                <option value="IESIRE">Ieșire</option>
              </select>
              <input type="number" min={1} value={draft.startNumber} onChange={(e) => setDraft({ ...draft, startNumber: e.target.value })} placeholder="Pornește de la nr." style={{ flex: 1 }} />
              <Button onClick={handleCreate}>Creează</Button>
            </div>
            {error && <p style={{ color: T.danger, fontSize: 12.5 }}>{error}</p>}
          </div>

          <div style={{ borderTop: `1px solid ${T.line2}`, paddingTop: 14 }}>
            <FieldLabel>Numerotare ieșiri per șablon de răspuns</FieldLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {templates.map((t) => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: T.bgSoft, borderRadius: 10, fontSize: 13 }}>
                  <span style={{ fontWeight: 700 }}>{t.name}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select value={t.outboundMode} onChange={(e) => handleTemplateModeChange(t, e.target.value as "SAME_AS_ENTRY" | "FROM_REGISTRY")} style={{ fontSize: 12.5 }}>
                      <option value="SAME_AS_ENTRY">Același ca nr. intrare</option>
                      <option value="FROM_REGISTRY">Următorul dintr-un registru</option>
                    </select>
                    {t.outboundMode === "FROM_REGISTRY" && (
                      <select value={t.outboundRegistryId || ""} onChange={(e) => handleTemplateRegistryChange(t, e.target.value)} style={{ fontSize: 12.5 }}>
                        <option value="">Registrul de ieșire implicit</option>
                        {iesireRegistries.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              ))}
              {templates.length === 0 && <p style={{ color: T.ink3, fontSize: 12.5 }}>Niciun șablon de răspuns configurat încă.</p>}
            </div>
          </div>

          <Button variant="ghost" style={{ marginTop: 18 }} onClick={onClose}>Închide</Button>
        </Card>
    </Modal>
  );
}

const NUMBER_KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Toate seriile" },
  { value: "INTRARE", label: "Intrare" },
  { value: "INTERN", label: "Intern" },
];
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Toate statusurile" },
  { value: "NOU", label: "Nou" },
  { value: "IN_LUCRU", label: "În lucru" },
  { value: "IN_ASTEPTARE", label: "În așteptare" },
  { value: "FINALIZAT", label: "Finalizat" },
  { value: "RESPINS", label: "Respins" },
];

export default function RegistraturaPage() {
  const [requests, setRequests] = useState<DmsRequestSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showRegistries, setShowRegistries] = useState(false);
  const [filters, setFilters] = useState<RequestFilters>({});
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  function load() {
    fetchRequests(filters).then(setRequests).catch((e) => setError(e?.response?.data?.error || "Eroare la încărcare"));
  }
  useEffect(load, [filters]);

  async function handleImport(file: File) {
    setImportMsg(null);
    try {
      const result = await importRequests(file);
      setImportMsg(`${result.imported} cereri importate${result.errors.length ? `, ${result.errors.length} erori` : ""}.`);
      load();
    } catch (e: any) {
      setImportMsg(e?.response?.data?.error || "Import eșuat");
    }
  }

  return (
    <AppShell title="Registratură electronică" subtitle="Cereri înregistrate din Portal, cu termene și status de procesare">
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 14 }}>
        <input ref={fileInputRef} type="file" accept=".xlsx,.csv" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} />
        <Button id="registratura-import-btn" variant="ghost" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={() => fileInputRef.current?.click()}>
          <Upload size={14} /> Importă
        </Button>
        <Button id="registratura-export-btn" variant="ghost" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={() => exportRequestsXlsx(filters)}>
          <Download size={14} /> Exportă
        </Button>
        <Button id="registratura-registries-btn" variant="ghost" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={() => setShowRegistries(true)}>
          <Settings2 size={14} /> Gestionează registre
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <FieldLabel>Categorie</FieldLabel>
            <input value={filters.category || ""} onChange={(e) => setFilters({ ...filters, category: e.target.value || undefined })} placeholder="ex: cis" style={{ width: 140 }} />
          </div>
          <div>
            <FieldLabel>Status</FieldLabel>
            <select value={filters.status || ""} onChange={(e) => setFilters({ ...filters, status: e.target.value || undefined })} style={{ width: 150 }}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Serie</FieldLabel>
            <select value={filters.numberKind || ""} onChange={(e) => setFilters({ ...filters, numberKind: e.target.value || undefined })} style={{ width: 130 }}>
              {NUMBER_KIND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>De la</FieldLabel>
            <input type="date" value={filters.from || ""} onChange={(e) => setFilters({ ...filters, from: e.target.value || undefined })} />
          </div>
          <div>
            <FieldLabel>Până la</FieldLabel>
            <input type="date" value={filters.to || ""} onChange={(e) => setFilters({ ...filters, to: e.target.value || undefined })} />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <FieldLabel>Caută (petent, email, nr.)</FieldLabel>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={filters.q || ""} onChange={(e) => setFilters({ ...filters, q: e.target.value || undefined })} style={{ flex: 1 }} />
              <Button id="registratura-search-btn" variant="ghost" style={{ padding: "8px 12px" }} onClick={load}><Search size={14} /></Button>
            </div>
          </div>
        </div>
      </Card>
      {importMsg && <p style={{ fontSize: 13, color: T.ink2 }}>{importMsg}</p>}

      <Card padded={false}>
        <div id="registratura-table" style={{ padding: "20px 20px 0" }}>
          <SectionHeader title={`${requests.length} cereri înregistrate`} />
        </div>
        {error && <p style={{ color: T.danger, padding: "0 20px" }}>{error}</p>}
        <table>
          <thead>
            <tr>
              <th style={{ paddingLeft: 20 }}>Nr. intrare / intern</th>
              <th>Nr. ieșire (legătură)</th>
              <th>Petent</th>
              <th>Categorie</th>
              <th>Status</th>
              <th>Termen</th>
              <th style={{ paddingRight: 20 }}>Workflow</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r, rIdx) => {
              const st = STATUS_STYLE[r.status] || STATUS_STYLE.NOU;
              const deadlineDays = r.legalDeadline
                ? Math.ceil((new Date(r.legalDeadline).getTime() - Date.now()) / 86_400_000)
                : null;
              const deadlinePill = statusFor(deadlineDays);
              const outbound = r.responses.filter((resp) => resp.outboundNumber);
              return (
                <tr
                  key={r.id}
                  id={rIdx === 0 ? "registratura-first-row" : undefined}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/registratura/${r.id}`)}
                >
                  <td style={{ paddingLeft: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700 }}>{r.registryNumber}</span>
                      {r.numberKind === "INTERN" ? (
                        <Pill color={T.info} bg={T.infoTint}>intern</Pill>
                      ) : (
                        <Pill color={T.ink3} bg={T.line2}>intrare</Pill>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: T.ink4, marginTop: 2 }}>din {fmtDate(r.registeredAt)}</div>
                  </td>
                  <td>
                    {outbound.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {outbound.map((resp, i) => (
                          <div key={i}>
                            <Pill color={T.success} bg={T.successTint}>→ {resp.outboundNumber}</Pill>
                            <span style={{ fontSize: 11, color: T.ink4, marginLeft: 6 }}>din {fmtDate(resp.signedAt)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: T.ink4 }}>—</span>
                    )}
                  </td>
                  <td>{r.submitterName}</td>
                  <td>{r.category}</td>
                  <td><Pill color={st.color} bg={st.bg}>{st.label}</Pill></td>
                  <td><Pill color={deadlinePill.color} bg={deadlinePill.bg}>{deadlinePill.label}</Pill></td>
                  <td style={{ paddingRight: 20 }}>
                    {r.workflowCase ? (
                      <Pill color={T.ink3} bg={T.line2}>{r.workflowCase.currentState.name}</Pill>
                    ) : (
                      <span style={{ fontSize: 12, color: T.ink4 }}>neinițiat</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {requests.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 20, color: T.ink3 }}>Nicio cerere înregistrată încă.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {showRegistries && <RegistriesPanel onClose={() => setShowRegistries(false)} />}
    </AppShell>
  );
}
