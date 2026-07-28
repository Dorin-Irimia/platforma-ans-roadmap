import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FolderKanban, Plus, Lock, Users, ArrowRight } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Card, Button, FieldLabel, SectionHeader, Pill } from "../components/ui";
import { Modal } from "../components/Modal";
import { T } from "../theme";
import { useAuth } from "../features/iam/AuthContext";
import { fetchProjects, createProject, LmsProjectDto, LmsProjectAccessMode, LmsProjectProgression } from "../features/lms/api";

const CREATOR_ROLES = ["SUPER_ADMIN", "ADMIN_INSTITUTIE", "AUTOR", "CNFPA"];
// Evaluator nu creează proiecte, dar tot are nevoie să ajungă la "Cursurile mele" pentru
// evaluare (vezi LMS_AUTHORING_ROLES în App.tsx, care gate-uiește ruta /lms/mine).
const AUTHORING_ROLES = [...CREATOR_ROLES, "EVALUATOR"];

const ACCESS_LABEL: Record<LmsProjectAccessMode, { label: string; color: string; bg: string }> = {
  OPEN: { label: "Acces liber", color: T.success, bg: T.successTint },
  APPROVAL: { label: "Cu aprobare", color: T.warn, bg: T.warnTint },
  INVITE_ONLY: { label: "Numire explicită", color: T.progress, bg: T.progressTint },
};

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: "Înscris", color: T.success, bg: T.successTint },
  PENDING: { label: "Cerere în așteptare", color: T.warn, bg: T.warnTint },
  REJECTED: { label: "Cerere respinsă", color: T.danger, bg: T.dangerTint },
};

function CreateProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: (p: LmsProjectDto) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [accessMode, setAccessMode] = useState<LmsProjectAccessMode>("OPEN");
  const [progression, setProgression] = useState<LmsProjectProgression>("FREE");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!title.trim()) {
      setError("Titlul este obligatoriu");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await createProject({ title, description: description || undefined, accessMode, progression });
      onCreated(created);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Nu am putut crea proiectul");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} width={460}>
      <Card>
        <SectionHeader title="Proiect nou" />
        <FieldLabel>Titlu</FieldLabel>
        <input id="lms-create-project-title-input" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", marginBottom: 12 }} />
        <FieldLabel>Descriere</FieldLabel>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: "100%", minHeight: 70, marginBottom: 14 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <FieldLabel>Acces</FieldLabel>
            <select value={accessMode} onChange={(e) => setAccessMode(e.target.value as LmsProjectAccessMode)} style={{ width: "100%" }}>
              <option value="OPEN">Liber (autoînscriere)</option>
              <option value="APPROVAL">Cu aprobare</option>
              <option value="INVITE_ONLY">Numire explicită</option>
            </select>
          </div>
          <div>
            <FieldLabel>Parcurgere cursuri</FieldLabel>
            <select value={progression} onChange={(e) => setProgression(e.target.value as LmsProjectProgression)} style={{ width: "100%" }}>
              <option value="FREE">Liberă (orice ordine)</option>
              <option value="SEQUENTIAL">Secvențială (curs 1 → 2 → ...)</option>
            </select>
          </div>
        </div>
        {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onClose}>Anulează</Button>
          <Button id="lms-create-project-submit-btn" onClick={handleCreate} style={{ opacity: saving ? 0.6 : 1 }}>{saving ? "Se creează..." : "Creează"}</Button>
        </div>
      </Card>
    </Modal>
  );
}

export default function LmsProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<LmsProjectDto[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const canCreate = !!user && CREATOR_ROLES.includes(user.role);
  const canSeeAuthoring = !!user && AUTHORING_ROLES.includes(user.role);

  function load() {
    fetchProjects().then(setProjects).catch(() => setProjects([]));
  }
  useEffect(load, []);

  return (
    <AppShell title="Proiecte" subtitle="Programe de formare — grupează mai multe cursuri sub o singură înscriere">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        {canCreate ? (
          <Button id="lms-new-project-btn" onClick={() => setShowCreate(true)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={15} /> Proiect nou
          </Button>
        ) : <span />}
        {canSeeAuthoring && (
          <Link to="/lms/mine" style={{ fontSize: 13 }}>
            Cursurile mele →
          </Link>
        )}
      </div>

      <SectionHeader title={`${projects.length} proiecte`} />
      <div style={{ display: "grid", gap: 12 }}>
        {projects.map((p, pIdx) => {
          const access = ACCESS_LABEL[p.accessMode];
          const status = p.myEnrollmentStatus ? STATUS_LABEL[p.myEnrollmentStatus] : null;
          return (
            <Card
              key={p.id}
              id={pIdx === 0 ? "lms-first-project-card" : undefined}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
              onClick={() => navigate(`/lms/projects/${p.id}`)}
            >
              <div style={{ display: "flex", gap: 14, alignItems: "center", minWidth: 0 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: T.brandTint, display: "flex", alignItems: "center", justifyContent: "center", color: T.brand, flexShrink: 0 }}>
                  <FolderKanban size={18} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5 }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: T.ink3, display: "flex", alignItems: "center", gap: 6 }}>
                    <Users size={11} /> {p.courses.length} {p.courses.length === 1 ? "curs" : "cursuri"}
                    {p.progression === "SEQUENTIAL" && " · secvențial"}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {status && <Pill color={status.color} bg={status.bg}>{status.label}</Pill>}
                <Pill color={access.color} bg={access.bg}>
                  {p.accessMode === "INVITE_ONLY" && <Lock size={11} style={{ marginRight: 4, verticalAlign: -1 }} />}
                  {access.label}
                </Pill>
                <ArrowRight size={15} color={T.ink4} />
              </div>
            </Card>
          );
        })}
        {projects.length === 0 && <p style={{ color: T.ink3 }}>Niciun proiect disponibil încă.</p>}
      </div>

      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={(p) => { setShowCreate(false); navigate(`/lms/projects/${p.id}`); }}
        />
      )}
    </AppShell>
  );
}
