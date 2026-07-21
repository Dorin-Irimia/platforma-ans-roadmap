import { useEffect, useState } from "react";
import { Search, FolderPlus, FileText, Eye } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Card, Button, FieldLabel, SectionHeader, Pill } from "../components/ui";
import { Modal } from "../components/Modal";
import { PdfPreview } from "../components/PdfPreview";
import { T } from "../theme";
import {
  fetchArchiveFolders,
  createArchiveFolder,
  fetchArchiveFolder,
  updateArchiveFolder,
  assignDocumentsToFolder,
  searchArchive,
  fetchRequests,
  fetchRequestDetail,
  ArchiveFolderDto,
  ArchiveFolderStage,
} from "../features/dms/api";

function DocumentPreviewModal({ id, filename, onClose }: { id: string; filename: string; onClose: () => void }) {
  return (
    <Modal onClose={onClose} width="auto" maxHeight="88vh">
      <Card style={{ maxHeight: "88vh", overflowY: "auto" }}>
        <SectionHeader title={filename} />
        <PdfPreview documentId={id} width={560} />
        <Button variant="ghost" style={{ marginTop: 14 }} onClick={onClose}>Închide</Button>
      </Card>
    </Modal>
  );
}

const STAGE_LABELS: Record<ArchiveFolderStage, string> = {
  INTAKE: "Preluare",
  GROUPED: "Grupare",
  BOUND: "Legare",
  INVENTORIED: "Inventariere",
  DIGITIZED: "Digitizare",
  INDEXED: "Indexare",
  ARCHIVED: "Păstrare",
};
const STAGE_ORDER: ArchiveFolderStage[] = ["INTAKE", "GROUPED", "BOUND", "INVENTORIED", "DIGITIZED", "INDEXED", "ARCHIVED"];

function AssignDocumentsModal({ folderId, onClose, onAssigned }: { folderId: string; onClose: () => void; onAssigned: () => void }) {
  const [requests, setRequests] = useState<{ id: string; registryNumber: string }[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [documents, setDocuments] = useState<{ id: string; filename: string }[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRequests().then((rs) => setRequests(rs.map((r) => ({ id: r.id, registryNumber: r.registryNumber })))).catch(() => setRequests([]));
  }, []);

  useEffect(() => {
    if (!selectedRequestId) return;
    fetchRequestDetail(selectedRequestId).then((r) => setDocuments(r.documents)).catch(() => setDocuments([]));
  }, [selectedRequestId]);

  async function handleAssign() {
    if (selectedDocIds.size === 0) return;
    setError(null);
    try {
      await assignDocumentsToFolder(folderId, Array.from(selectedDocIds));
      onAssigned();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Nu am putut asocia documentele");
    }
  }

  return (
    <Modal onClose={onClose} width={460}>
        <Card>
          <SectionHeader title="Asociază documente existente" />
          <FieldLabel>Cerere din Registratură</FieldLabel>
          <select value={selectedRequestId} onChange={(e) => setSelectedRequestId(e.target.value)} style={{ width: "100%", marginBottom: 12 }}>
            <option value="">Alege cererea...</option>
            {requests.map((r) => <option key={r.id} value={r.id}>{r.registryNumber}</option>)}
          </select>
          {documents.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
              {documents.map((d) => (
                <label key={d.id} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={selectedDocIds.has(d.id)}
                    onChange={(e) => {
                      const next = new Set(selectedDocIds);
                      if (e.target.checked) next.add(d.id);
                      else next.delete(d.id);
                      setSelectedDocIds(next);
                    }}
                  />
                  {d.filename}
                </label>
              ))}
            </div>
          )}
          {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={onClose}>Anulează</Button>
            <Button onClick={handleAssign}>Asociază</Button>
          </div>
        </Card>
    </Modal>
  );
}

export default function ArchivePage() {
  const [folders, setFolders] = useState<ArchiveFolderDto[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ name: "", indexFields: [{ label: "", value: "" }] });
  const [assignFor, setAssignFor] = useState<ArchiveFolderDto | null>(null);
  const [openFolder, setOpenFolder] = useState<ArchiveFolderDto | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; filename: string; mimeType: string; archiveFolder?: { id: string; name: string } }[] | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ id: string; filename: string } | null>(null);

  function load() {
    fetchArchiveFolders().then(setFolders).catch(() => setFolders([]));
  }
  useEffect(load, []);

  async function handleCreate() {
    await createArchiveFolder({ name: draft.name, indexFields: draft.indexFields.filter((f) => f.label && f.value) });
    setShowCreate(false);
    setDraft({ name: "", indexFields: [{ label: "", value: "" }] });
    load();
  }

  async function handleOpenFolder(id: string) {
    const folder = await fetchArchiveFolder(id);
    setOpenFolder(folder);
  }

  async function handleSearch() {
    if (!query.trim()) return setSearchResults(null);
    setSearchResults(await searchArchive(query));
  }

  return (
    <AppShell title="Arhivă" subtitle="Organizare, indexare și căutare pe documentele deja digitale din Registratură">
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <div style={{ flex: 1, display: "flex", gap: 8 }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="Caută documente arhivate..." style={{ flex: 1 }} />
          <Button variant="ghost" onClick={handleSearch} style={{ display: "flex", alignItems: "center", gap: 6 }}><Search size={14} /> Caută</Button>
        </div>
        <Button onClick={() => setShowCreate((s) => !s)} style={{ display: "flex", alignItems: "center", gap: 6 }}><FolderPlus size={15} /> Dosar nou</Button>
      </div>

      {searchResults && (
        <Card style={{ marginBottom: 20 }}>
          <SectionHeader title={`${searchResults.length} rezultate căutare`} />
          {searchResults.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 13, cursor: "pointer" }} onClick={() => setPreviewDoc({ id: r.id, filename: r.filename })}>
              <span><FileText size={13} style={{ marginRight: 6 }} />{r.filename}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: T.ink3 }}>{r.archiveFolder?.name}</span>
                <Eye size={13} color={T.ink3} />
              </span>
            </div>
          ))}
          {searchResults.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Niciun rezultat.</p>}
        </Card>
      )}

      {showCreate && (
        <Card style={{ marginBottom: 20 }}>
          <FieldLabel>Nume dosar</FieldLabel>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={{ width: "100%", marginBottom: 12 }} />
          <FieldLabel>Câmpuri de indexare (max 5)</FieldLabel>
          {draft.indexFields.map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <input value={f.label} onChange={(e) => setDraft({ ...draft, indexFields: draft.indexFields.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)) })} placeholder="Etichetă (ex: CNP)" style={{ flex: 1 }} />
              <input value={f.value} onChange={(e) => setDraft({ ...draft, indexFields: draft.indexFields.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)) })} placeholder="Valoare" style={{ flex: 1 }} />
            </div>
          ))}
          {draft.indexFields.length < 5 && (
            <Button variant="ghost" style={{ fontSize: 12, marginBottom: 12 }} onClick={() => setDraft({ ...draft, indexFields: [...draft.indexFields, { label: "", value: "" }] })}>+ Câmp</Button>
          )}
          <div><Button onClick={handleCreate}>Salvează dosarul</Button></div>
        </Card>
      )}

      <SectionHeader title={`${folders.length} dosare`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {folders.map((f) => (
          <Card key={f.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ cursor: "pointer", flex: 1 }} onClick={() => handleOpenFolder(f.id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{f.name}</div>
                  {f.stalled && <Pill color={T.warn} bg={T.warnTint}>Stagnant</Pill>}
                </div>
                <div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>{f._count?.documents ?? 0} documente</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select
                  value={f.stage}
                  onChange={(e) => updateArchiveFolder(f.id, { stage: e.target.value as ArchiveFolderStage }).then(load)}
                  style={{ fontSize: 12 }}
                >
                  {STAGE_ORDER.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                </select>
                <Button variant="ghost" style={{ padding: "6px 10px", fontSize: 11.5 }} onClick={() => setAssignFor(f)}>+ Documente</Button>
              </div>
            </div>
          </Card>
        ))}
        {folders.length === 0 && <p style={{ color: T.ink3 }}>Niciun dosar creat încă.</p>}
      </div>

      {openFolder && (
        <Modal onClose={() => setOpenFolder(null)} width={460}>
            <Card>
              <SectionHeader title={openFolder.name} />
              <div style={{ marginBottom: 12 }}>
                {openFolder.indexFields.map((f, i) => <Pill key={i} style={{ marginRight: 6, marginBottom: 6 }}>{f.label}: {f.value}</Pill>)}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {openFolder.documents?.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => setPreviewDoc({ id: d.id, filename: d.filename })}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: `1px solid ${T.line2}`, cursor: "pointer" }}
                  >
                    <span><FileText size={13} style={{ marginRight: 6 }} />{d.filename}</span>
                    <Eye size={13} color={T.ink3} />
                  </div>
                ))}
                {(!openFolder.documents || openFolder.documents.length === 0) && <p style={{ color: T.ink3, fontSize: 13 }}>Niciun document asociat încă.</p>}
              </div>
              <Button variant="ghost" style={{ marginTop: 14 }} onClick={() => setOpenFolder(null)}>Închide</Button>
            </Card>
        </Modal>
      )}

      {assignFor && (
        <AssignDocumentsModal
          folderId={assignFor.id}
          onClose={() => setAssignFor(null)}
          onAssigned={() => { setAssignFor(null); load(); }}
        />
      )}

      {previewDoc && (
        <DocumentPreviewModal id={previewDoc.id} filename={previewDoc.filename} onClose={() => setPreviewDoc(null)} />
      )}
    </AppShell>
  );
}
