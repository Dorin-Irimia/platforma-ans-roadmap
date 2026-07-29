import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Lock, ArrowUp, ArrowDown, Trash2, Plus, Check, Settings, ArrowLeft } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Card, Button, FieldLabel, SectionHeader, Pill } from "../components/ui";
import { T } from "../theme";
import { useAuth } from "../features/iam/AuthContext";
import { useToast } from "../components/ToastProvider";
import { fetchUsers } from "../features/iam/api";
import {
  fetchProject,
  updateProject,
  deleteProject,
  attachExistingCourse,
  attachNewCourse,
  removeProjectCourse,
  reorderProjectCourses,
  enrollInProject,
  fetchProjectEnrollments,
  decideProjectEnrollment,
  revokeProjectAccess,
  fetchCourses,
  LmsProjectDto,
  LmsCourseSummary,
  LmsProjectEnrollmentRosterDto,
  LmsProjectAccessMode,
  LmsProjectProgression,
} from "../features/lms/api";

const PLATFORM_ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN_INSTITUTIE"];

const ACCESS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  OPEN: { label: "Acces liber", color: T.success, bg: T.successTint },
  APPROVAL: { label: "Cu aprobare", color: T.warn, bg: T.warnTint },
  INVITE_ONLY: { label: "Numire explicită", color: T.progress, bg: T.progressTint },
};

// Formular de atașare curs — fie unul existent (dintre cursurile proprii), fie unul nou,
// creat și atașat direct din pagina proiectului, fără să mai treacă prin altă pagină.
const NO_PROJECT_FILTER = "__none__";

function AddCourseForm({ projectId, onAdded }: { projectId: string; onAdded: () => void }) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [myCourses, setMyCourses] = useState<LmsCourseSummary[]>([]);
  const [sourceProjectFilter, setSourceProjectFilter] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCourses().then(setMyCourses).catch(() => setMyCourses([]));
  }, []);

  // Un curs reutilizat în mai multe proiecte e ACELAȘI curs (lecții, comentarii etc. rămân
  // comune) — filtrul de mai jos e doar o ajutare la găsirea rapidă a cursului potrivit,
  // nu creează o copie separată per proiect.
  const sourceProjects = Array.from(
    new Map(myCourses.flatMap((c) => c.projectLinks || []).map((l) => [l.project.id, l.project])).values()
  );
  const filteredCourses = !sourceProjectFilter
    ? myCourses
    : sourceProjectFilter === NO_PROJECT_FILTER
    ? myCourses.filter((c) => !c.projectLinks || c.projectLinks.length === 0)
    : myCourses.filter((c) => c.projectLinks?.some((l) => l.project.id === sourceProjectFilter));

  async function handleSubmit() {
    setError(null);
    if (mode === "existing" && !selectedCourseId) return setError("Alege un curs");
    if (mode === "new" && !title.trim()) return setError("Titlul e obligatoriu");
    setSaving(true);
    try {
      if (mode === "existing") await attachExistingCourse(projectId, selectedCourseId);
      else await attachNewCourse(projectId, title.trim(), description || undefined);
      setSelectedCourseId("");
      setTitle("");
      setDescription("");
      onAdded();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Nu am putut adăuga cursul");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${T.line}` }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <Button variant={mode === "existing" ? "primary" : "ghost"} style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => setMode("existing")}>
          Curs existent
        </Button>
        <Button variant={mode === "new" ? "primary" : "ghost"} style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => setMode("new")}>
          + Curs nou
        </Button>
      </div>
      {mode === "existing" ? (
        <div>
          {sourceProjects.length > 0 && (
            <select
              value={sourceProjectFilter}
              onChange={(e) => { setSourceProjectFilter(e.target.value); setSelectedCourseId(""); }}
              style={{ width: "100%", marginBottom: 8, fontSize: 12.5 }}
            >
              <option value="">Filtrează după proiectul-sursă: toate</option>
              {sourceProjects.map((p) => (
                <option key={p.id} value={p.id}>Doar din: {p.title}</option>
              ))}
              <option value={NO_PROJECT_FILTER}>Doar cursuri fără niciun proiect</option>
            </select>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} style={{ flex: 1 }}>
              <option value="">Alege un curs...</option>
              {filteredCourses.map((c) => {
                const projectNames = (c.projectLinks || []).map((l) => l.project.title);
                const suffix = projectNames.length ? ` (deja în: ${projectNames.join(", ")})` : " (fără proiect)";
                return (
                  <option key={c.id} value={c.id}>{c.title}{suffix}</option>
                );
              })}
            </select>
            <Button onClick={handleSubmit} style={{ opacity: saving ? 0.6 : 1 }}>{saving ? "..." : "Atașează"}</Button>
          </div>
        </div>
      ) : (
        <div>
          <input placeholder="Titlu curs nou" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="Descriere (opțional)" value={description} onChange={(e) => setDescription(e.target.value)} style={{ flex: 1 }} />
            <Button onClick={handleSubmit} style={{ opacity: saving ? 0.6 : 1 }}>{saving ? "..." : "Creează și atașează"}</Button>
          </div>
        </div>
      )}
      {error && <p style={{ color: T.danger, fontSize: 12, marginTop: 6 }}>{error}</p>}
    </div>
  );
}

// Roster + cereri de înscriere — vizibil doar owner/admin proiect. Adăugarea directă a
// unui utilizator (pt. numire explicită, INVITE_ONLY) folosește lista completă de conturi
// (GET /api/iam/users), care e rezervată admin-ilor platformă — un autor/CNFPA owner de
// proiect non-admin tot vede roster-ul și poate revoca, dar nu poate "căuta" un utilizator
// nou fără un admin (limitare cunoscută, documentată în plan).
function EnrollmentRoster({ projectId, isPlatformAdmin }: { projectId: string; isPlatformAdmin: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<LmsProjectEnrollmentRosterDto[]>([]);
  const [users, setUsers] = useState<{ id: string; name?: string; email: string }[]>([]);
  const [pickUserId, setPickUserId] = useState("");

  function load() {
    fetchProjectEnrollments(projectId).then(setRows).catch(() => setRows([]));
  }
  useEffect(load, [projectId]);
  useEffect(() => {
    if (isPlatformAdmin) fetchUsers().then(setUsers).catch(() => setUsers([]));
  }, [isPlatformAdmin]);

  async function handleDecide(userId: string, status: "ACTIVE" | "REJECTED") {
    await decideProjectEnrollment(projectId, userId, status);
    load();
  }
  async function handleRevoke(userId: string) {
    await revokeProjectAccess(projectId, userId);
    load();
  }
  async function handleAssign() {
    if (!pickUserId) return;
    await decideProjectEnrollment(projectId, pickUserId, "ACTIVE");
    setPickUserId("");
    toast.success("Utilizator adăugat în proiect.");
    load();
  }

  const pending = rows.filter((r) => r.status === "PENDING");
  const active = rows.filter((r) => r.status === "ACTIVE");
  const alreadyIds = new Set(rows.map((r) => r.userId));
  const assignable = users.filter((u) => !alreadyIds.has(u.id));

  return (
    <Card>
      <SectionHeader title="Înscrieri" />
      {isPlatformAdmin && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <select value={pickUserId} onChange={(e) => setPickUserId(e.target.value)} style={{ flex: 1 }}>
            <option value="">Adaugă utilizator direct (numire explicită)...</option>
            {assignable.map((u) => (
              <option key={u.id} value={u.id}>{u.name || u.email}</option>
            ))}
          </select>
          <Button variant="ghost" onClick={handleAssign} style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
            <Plus size={13} /> Adaugă
          </Button>
        </div>
      )}

      {pending.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: T.ink3, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 }}>
            Cereri în așteptare
          </div>
          {pending.map((r) => (
            <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.line2}` }}>
              <span style={{ fontSize: 13 }}>{r.user.name || r.user.email}</span>
              <div style={{ display: "flex", gap: 6 }}>
                <Button variant="ghost" style={{ fontSize: 11.5, padding: "4px 10px" }} onClick={() => handleDecide(r.userId, "ACTIVE")}>Aprobă</Button>
                <Button variant="danger" style={{ fontSize: 11.5, padding: "4px 10px" }} onClick={() => handleDecide(r.userId, "REJECTED")}>Respinge</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 11.5, fontWeight: 700, color: T.ink3, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 }}>
        Membri activi ({active.length})
      </div>
      {active.map((r) => (
        <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.line2}` }}>
          <span style={{ fontSize: 13 }}>{r.user.name || r.user.email}</span>
          <Button variant="ghost" style={{ fontSize: 11.5, padding: "4px 10px", color: T.danger }} onClick={() => handleRevoke(r.userId)}>Revocă</Button>
        </div>
      ))}
      {active.length === 0 && <p style={{ color: T.ink3, fontSize: 13, margin: 0 }}>Niciun membru activ încă.</p>}
    </Card>
  );
}

// Editare setări proiect (titlu/descriere/acces/parcurgere) — owner/admin. Ascunsă în
// spatele unui buton "Editează" ca să nu aglomereze vizual pagina pentru un cursant.
function ProjectSettingsForm({ project, onSaved, onCancel }: { project: LmsProjectDto; onSaved: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description || "");
  const [accessMode, setAccessMode] = useState<LmsProjectAccessMode>(project.accessMode);
  const [progression, setProgression] = useState<LmsProjectProgression>(project.progression);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim()) return setError("Titlul este obligatoriu");
    setSaving(true);
    setError(null);
    try {
      await updateProject(project.id, { title: title.trim(), description: description || undefined, accessMode, progression });
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Salvare eșuată");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.line}` }}>
      <FieldLabel>Titlu</FieldLabel>
      <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", marginBottom: 10 }} />
      <FieldLabel>Descriere</FieldLabel>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: "100%", minHeight: 60, marginBottom: 10 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
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
      {error && <p style={{ color: T.danger, fontSize: 12, marginBottom: 10 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8 }}>
        <Button onClick={handleSave} style={{ opacity: saving ? 0.6 : 1 }}>{saving ? "..." : "Salvează"}</Button>
        <Button variant="ghost" onClick={onCancel}>Anulează</Button>
      </div>
    </div>
  );
}

export default function LmsProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [project, setProject] = useState<LmsProjectDto | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  function load() {
    if (id) fetchProject(id).then(setProject).catch(() => setProject(null));
  }
  useEffect(load, [id]);

  if (!project) return <AppShell title="Proiect" subtitle="Se încarcă..."><div /></AppShell>;

  const isOwnerOrAdmin = !!user && (project.ownerId === user.id || PLATFORM_ADMIN_ROLES.includes(user.role));
  const isPlatformAdmin = !!user && PLATFORM_ADMIN_ROLES.includes(user.role);
  const access = ACCESS_LABEL[project.accessMode];

  async function handleEnroll() {
    setEnrolling(true);
    try {
      const res = await enrollInProject(project!.id);
      toast.success(res.status === "ACTIVE" ? "Te-ai înscris în proiect." : "Cererea ta a fost trimisă spre aprobare.");
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Înscriere eșuată");
    } finally {
      setEnrolling(false);
    }
  }

  async function handleRemoveCourse(courseId: string) {
    if (!window.confirm("Elimini acest curs din proiect?")) return;
    await removeProjectCourse(project!.id, courseId);
    load();
  }

  async function handleDeleteProject() {
    if (!project) return;
    if (!window.confirm(`Ștergi definitiv proiectul „${project.title}”? Cursurile atașate rămân, doar legătura cu proiectul se pierde. Acțiunea nu poate fi anulată.`)) return;
    try {
      await deleteProject(project.id);
      toast.success("Proiect șters.");
      navigate("/lms");
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Ștergere eșuată");
    }
  }

  async function moveCourse(index: number, direction: -1 | 1) {
    const ids = project!.courses.map((c) => c.courseId);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await reorderProjectCourses(project!.id, ids);
    load();
  }

  function renderEnrollAction() {
    if (isOwnerOrAdmin) return null;
    if (project!.myEnrollmentStatus === "ACTIVE") {
      return <Pill color={T.success} bg={T.successTint}><Check size={12} style={{ marginRight: 4, verticalAlign: -2 }} />Ești înscris</Pill>;
    }
    if (project!.myEnrollmentStatus === "PENDING") {
      return <Pill color={T.warn} bg={T.warnTint}>Cerere în așteptare</Pill>;
    }
    if (project!.accessMode === "INVITE_ONLY") {
      return <Pill>Acces doar prin numire explicită</Pill>;
    }
    return (
      <Button id="lms-project-enroll-btn" onClick={handleEnroll} style={{ opacity: enrolling ? 0.6 : 1 }}>
        {enrolling ? "..." : project!.accessMode === "OPEN" ? "Înscrie-te" : "Cere acces"}
      </Button>
    );
  }

  return (
    <AppShell title={project.title} subtitle={project.description || "Program de formare"}>
      <div style={{ marginBottom: 14 }}>
        <Link to="/lms" style={{ fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={13} /> Înapoi la proiecte
        </Link>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill color={access.color} bg={access.bg}>{access.label}</Pill>
            <Pill>{project.progression === "SEQUENTIAL" ? "Parcurgere secvențială" : "Parcurgere liberă"}</Pill>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {renderEnrollAction()}
            {isOwnerOrAdmin && !showSettings && (
              <>
                <Button variant="ghost" onClick={() => setShowSettings(true)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 14px" }}>
                  <Settings size={14} /> Editează
                </Button>
                <Button variant="danger" onClick={handleDeleteProject} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, padding: "8px 14px" }}>
                  <Trash2 size={14} /> Șterge proiect
                </Button>
              </>
            )}
          </div>
        </div>
        {isOwnerOrAdmin && showSettings && (
          <ProjectSettingsForm
            project={project}
            onCancel={() => setShowSettings(false)}
            onSaved={() => { setShowSettings(false); load(); }}
          />
        )}
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <SectionHeader title="Cursuri" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {project.courses.map((pc, idx) => {
            const canOpen = (isOwnerOrAdmin || project!.myEnrollmentStatus === "ACTIVE") && !pc.locked;
            return (
              <div
                key={pc.id}
                id={idx === 0 ? "lms-project-first-course-row" : undefined}
                onClick={() => canOpen && navigate(`/lms/courses/${pc.courseId}/learn?projectId=${project!.id}`)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: T.line2,
                  opacity: canOpen ? 1 : 0.6,
                  cursor: canOpen ? "pointer" : "default",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{idx + 1}. {pc.course.title}</span>
                  {pc.locked && <Lock size={13} color={T.ink4} />}
                </div>
                {isOwnerOrAdmin && (
                  <div style={{ display: "flex", gap: 4, alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      style={{ fontSize: 11.5, padding: "4px 10px" }}
                      onClick={() => navigate(`/lms/courses/${pc.courseId}`)}
                    >
                      Editează
                    </Button>
                    <button disabled={idx === 0} onClick={() => moveCourse(idx, -1)} style={{ background: "none", border: "none", cursor: idx === 0 ? "default" : "pointer", color: idx === 0 ? T.ink4 : T.ink2, padding: 4 }}>
                      <ArrowUp size={14} />
                    </button>
                    <button disabled={idx === project.courses.length - 1} onClick={() => moveCourse(idx, 1)} style={{ background: "none", border: "none", cursor: idx === project.courses.length - 1 ? "default" : "pointer", color: idx === project.courses.length - 1 ? T.ink4 : T.ink2, padding: 4 }}>
                      <ArrowDown size={14} />
                    </button>
                    <button onClick={() => handleRemoveCourse(pc.courseId)} style={{ background: "none", border: "none", cursor: "pointer", color: T.danger, padding: 4 }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {project.courses.length === 0 && <p style={{ color: T.ink3, fontSize: 13, margin: 0 }}>Niciun curs atașat încă.</p>}
        </div>
        {isOwnerOrAdmin && <AddCourseForm projectId={project.id} onAdded={load} />}
      </Card>

      {isOwnerOrAdmin && <EnrollmentRoster projectId={project.id} isPlatformAdmin={isPlatformAdmin} />}
    </AppShell>
  );
}
