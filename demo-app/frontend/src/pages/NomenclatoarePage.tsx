import { useEffect, useRef, useState } from "react";
import { Upload, Download, Plus, Trash2 } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Card, Button, FieldLabel, SectionHeader, Pill } from "../components/ui";
import { Modal } from "../components/Modal";
import { useToast } from "../components/ToastProvider";
import { T } from "../theme";
import {
  fetchNomenclatoare,
  fetchNomenclator,
  createNomenclator,
  deleteNomenclator,
  createNomenclatorEntry,
  updateNomenclatorEntry,
  deleteNomenclatorEntry,
  importNomenclatorEntries,
  exportNomenclator,
  NomenclatorDto,
  NomenclatorFieldDef,
  NomenclatorFieldType,
} from "../features/nomenclatoare/api";

function CreateNomenclatorForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState<NomenclatorFieldDef[]>([{ key: "nume", label: "Nume", type: "TEXT" }]);
  const [error, setError] = useState<string | null>(null);

  function updateField(idx: number, patch: Partial<NomenclatorFieldDef>) {
    setFields(fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }

  async function handleCreate() {
    if (!name.trim() || fields.some((f) => !f.key.trim() || !f.label.trim())) {
      setError("Completează numele nomenclatorului și toate câmpurile (cheie + etichetă)");
      return;
    }
    setError(null);
    try {
      await createNomenclator({ name, description: description || undefined, fields });
      setName("");
      setDescription("");
      setFields([{ key: "nume", label: "Nume", type: "TEXT" }]);
      onCreated();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Nu am putut crea nomenclatorul");
    }
  }

  return (
    <Card style={{ marginBottom: 20 }}>
      <SectionHeader title="Nomenclator nou" />
      <FieldLabel>Nume (ex. „Persoane")</FieldLabel>
      <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", marginBottom: 10 }} />
      <FieldLabel>Descriere (opțional)</FieldLabel>
      <input value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: "100%", marginBottom: 14 }} />

      <FieldLabel>Câmpuri</FieldLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
        {fields.map((f, i) => (
          <div key={i} style={{ display: "flex", gap: 8 }}>
            <input value={f.key} onChange={(e) => updateField(i, { key: e.target.value })} placeholder="cheie (ex: cnp)" style={{ flex: 1 }} />
            <input value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} placeholder="etichetă (ex: CNP)" style={{ flex: 1 }} />
            <select value={f.type} onChange={(e) => updateField(i, { type: e.target.value as NomenclatorFieldType })} style={{ width: 110 }}>
              <option value="TEXT">Text</option>
              <option value="NUMBER">Număr</option>
              <option value="DATE">Dată</option>
            </select>
            <Button variant="ghost" style={{ padding: "6px 10px" }} onClick={() => setFields(fields.filter((_, idx) => idx !== i))}>
              <Trash2 size={13} />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="ghost" style={{ fontSize: 12, marginBottom: 14 }} onClick={() => setFields([...fields, { key: "", label: "", type: "TEXT" }])}>
        + Câmp
      </Button>

      {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}
      <div>
        <Button id="nomenclatoare-create-btn" onClick={handleCreate}>Creează nomenclatorul</Button>
      </div>
    </Card>
  );
}

function NomenclatorDetail({ nomenclator, onClose, onChanged }: { nomenclator: NomenclatorDto; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<NomenclatorDto | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  function load() {
    fetchNomenclator(nomenclator.id).then(setDetail).catch(() => setDetail(null));
  }
  useEffect(load, [nomenclator.id]);

  async function handleAddEntry() {
    if (!detail) return;
    try {
      await createNomenclatorEntry(detail.id, draft);
      setDraft({});
      load();
      onChanged();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Nu am putut adăuga intrarea");
    }
  }

  async function handleImport(file: File) {
    if (!detail) return;
    try {
      const result = await importNomenclatorEntries(detail.id, file);
      load();
      onChanged();
      setError(null);
      toast.success(`${result.imported} intrări importate.`);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Import eșuat");
    }
  }

  if (!detail) return null;

  return (
    <Modal isOpen onClose={onClose} width={720} maxHeight="86vh">
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <SectionHeader title={detail.name} />
            <div style={{ display: "flex", gap: 8 }}>
              <input ref={fileInputRef} type="file" accept=".xlsx,.csv" style={{ display: "none" }} onChange={(e) => e.target.files?.[0] && handleImport(e.target.files[0])} />
              <Button id="nomenclatoare-import-btn" variant="ghost" style={{ padding: "6px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }} onClick={() => fileInputRef.current?.click()}>
                <Upload size={12} /> Importă
              </Button>
              <Button id="nomenclatoare-export-btn" variant="ghost" style={{ padding: "6px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }} onClick={() => exportNomenclator(detail)}>
                <Download size={12} /> Exportă
              </Button>
            </div>
          </div>
          {detail.description && <p style={{ fontSize: 12.5, color: T.ink3, marginTop: 0 }}>{detail.description}</p>}

          <table style={{ marginBottom: 14 }}>
            <thead>
              <tr>
                {detail.fields.map((f) => <th key={f.key}>{f.label}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(detail.entries || []).map((entry) => (
                <tr key={entry.id}>
                  {detail.fields.map((f) => <td key={f.key}>{String(entry.values[f.key] ?? "")}</td>)}
                  <td>
                    <Button variant="ghost" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => deleteNomenclatorEntry(detail.id, entry.id).then(() => { load(); onChanged(); })}>
                      <Trash2 size={12} />
                    </Button>
                  </td>
                </tr>
              ))}
              {(detail.entries || []).length === 0 && (
                <tr><td colSpan={detail.fields.length + 1} style={{ padding: "10px 0", color: T.ink3 }}>Nicio intrare încă.</td></tr>
              )}
            </tbody>
          </table>

          <FieldLabel>Adaugă intrare</FieldLabel>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            {detail.fields.map((f) => (
              <input
                key={f.key}
                value={draft[f.key] || ""}
                onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                placeholder={f.label}
                style={{ flex: 1, minWidth: 120 }}
              />
            ))}
            <Button onClick={handleAddEntry} style={{ display: "flex", alignItems: "center", gap: 4 }}><Plus size={13} /> Adaugă</Button>
          </div>
          {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}

          <Button variant="ghost" onClick={onClose}>Închide</Button>
        </Card>
    </Modal>
  );
}

export default function NomenclatoarePage() {
  const [items, setItems] = useState<NomenclatorDto[]>([]);
  const [open, setOpen] = useState<NomenclatorDto | null>(null);

  function load() {
    fetchNomenclatoare().then(setItems).catch(() => setItems([]));
  }
  useEffect(load, []);

  return (
    <AppShell title="Nomenclatoare" subtitle="Liste de referință reutilizabile — atașabile unui șablon de formular pentru precompletare automată">
      <CreateNomenclatorForm onCreated={load} />

      <SectionHeader title={`${items.length} nomenclatoare`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((n) => (
          <Card key={n.id} onClick={() => setOpen(n)} style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{n.name}</div>
              <div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>{n.fields.map((f) => f.label).join(", ")}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }} onClick={(e) => e.stopPropagation()}>
              <Pill color={T.ink3} bg={T.line2}>{n._count?.entries ?? 0} intrări</Pill>
              <Button
                variant="ghost"
                style={{ padding: "6px 10px", fontSize: 11.5 }}
                onClick={() => { if (window.confirm(`Ștergi nomenclatorul „${n.name}"?`)) deleteNomenclator(n.id).then(load); }}
              >
                <Trash2 size={13} />
              </Button>
            </div>
          </Card>
        ))}
        {items.length === 0 && <p style={{ color: T.ink3 }}>Niciun nomenclator creat încă.</p>}
      </div>

      {open && <NomenclatorDetail nomenclator={open} onClose={() => setOpen(null)} onChanged={load} />}
    </AppShell>
  );
}
