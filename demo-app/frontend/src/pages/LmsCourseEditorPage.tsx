import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Monitor, Tablet, Smartphone, Eye, Sparkles, Plus, GripVertical, UserPlus } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Card, Button, FieldLabel, SectionHeader, Pill } from "../components/ui";
import { Modal } from "../components/Modal";
import { T } from "../theme";
import { fetchUsers } from "../features/iam/api";
import {
  fetchCourse,
  updateCourse,
  fetchLessons,
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
  generateStructure,
  addCollaborator,
  fetchCourseEnrollments,
  LmsCourseSummary,
  LmsLessonDto,
  LessonBlock,
  LmsEnrollmentRosterDto,
} from "../features/lms/api";
import { LessonBlocksView } from "../components/lms/LessonBlocksView";
import { BlockEditor } from "../components/lms/BlockEditor";
import { ReviewPanel } from "../components/lms/ReviewPanel";
import { AssistantPanel } from "../components/lms/AssistantPanel";

const PREVIEW_WIDTHS: Record<"desktop" | "tablet" | "mobile", string> = { desktop: "100%", tablet: "768px", mobile: "375px" };

function GenerateStructureModal({ courseId, onClose, onGenerated }: { courseId: string; onClose: () => void; onGenerated: () => void }) {
  const [subject, setSubject] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setBusy(true);
    setError(null);
    try {
      await generateStructure(courseId, subject, file);
      onGenerated();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Generarea structurii a eșuat");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} width={460}>
        <Card>
          <SectionHeader title="Generează structură cu AI" />
          <FieldLabel>Subiect / descriere material</FieldLabel>
          <textarea value={subject} onChange={(e) => setSubject(e.target.value)} style={{ width: "100%", minHeight: 100, marginBottom: 12 }} placeholder="ex: Introducere în managementul proiectelor sportive..." />
          <FieldLabel>Sau încarcă un fișier (opțional)</FieldLabel>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ marginBottom: 14 }} />
          {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={onClose}>Anulează</Button>
            <Button onClick={handleGenerate} style={{ opacity: busy ? 0.6 : 1 }}>{busy ? "Se generează..." : "Generează"}</Button>
          </div>
        </Card>
    </Modal>
  );
}

function InviteCollaboratorModal({ courseId, onClose, onInvited }: { courseId: string; onClose: () => void; onInvited: () => void }) {
  const [users, setUsers] = useState<{ id: string; email: string; name?: string }[]>([]);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    fetchUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  async function handleInvite() {
    if (!userId) return;
    await addCollaborator(courseId, userId, "COAUTHOR");
    onInvited();
  }

  return (
    <Modal onClose={onClose} width={400}>
        <Card>
          <SectionHeader title="Invită Co-autor" />
          <FieldLabel>Utilizator</FieldLabel>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} style={{ width: "100%", marginBottom: 14 }}>
            <option value="">Alege un cont...</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
          </select>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={onClose}>Anulează</Button>
            <Button onClick={handleInvite}>Invită</Button>
          </div>
        </Card>
    </Modal>
  );
}

// Regulă automată: o înscriere fără progres nou de prea multe zile e semnalată "stagnantă"
// (LmsAssistantSettings.stalledAfterDays), evaluată leneș la deschiderea acestui tab.
function EnrollmentsTab({ courseId }: { courseId: string }) {
  const [enrollments, setEnrollments] = useState<LmsEnrollmentRosterDto[]>([]);

  useEffect(() => {
    fetchCourseEnrollments(courseId).then(setEnrollments).catch(() => setEnrollments([]));
  }, [courseId]);

  return (
    <div>
      <SectionHeader title={`${enrollments.length} cursanți înscriși`} />
      <table>
        <thead>
          <tr>
            <th style={{ paddingLeft: 0 }}>Cursant</th>
            <th>Progres</th>
            <th>Ultima activitate</th>
            <th>Stare</th>
          </tr>
        </thead>
        <tbody>
          {enrollments.map((e) => (
            <tr key={e.id}>
              <td style={{ paddingLeft: 0, fontWeight: 600 }}>{e.user.name || e.user.email}</td>
              <td>{e.progressPercent}%</td>
              <td>{new Date(e.updatedAt).toLocaleDateString("ro-RO")}</td>
              <td>{e.stalled && <Pill color={T.warn} bg={T.warnTint}>Stagnantă</Pill>}</td>
            </tr>
          ))}
          {enrollments.length === 0 && (
            <tr><td colSpan={4} style={{ padding: "12px 0", color: T.ink3 }}>Niciun cursant înscris încă.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function LmsCourseEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<LmsCourseSummary | null>(null);
  const [lessons, setLessons] = useState<LmsLessonDto[]>([]);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState<LessonBlock[]>([]);
  const [draftDirty, setDraftDirty] = useState(false);
  const [tab, setTab] = useState<"lectii" | "colaborare" | "asistent" | "cursanti">("lectii");
  const [previewing, setPreviewing] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [showGenerate, setShowGenerate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  function loadCourse() {
    if (!id) return;
    fetchCourse(id).then(setCourse).catch(() => setCourse(null));
  }
  function loadLessons() {
    if (!id) return;
    fetchLessons(id).then((ls) => {
      setLessons(ls);
      if (!activeLessonId && ls.length > 0) setActiveLessonId(ls[0].id);
    });
  }
  useEffect(loadCourse, [id]);
  useEffect(loadLessons, [id]);

  const activeLesson = lessons.find((l) => l.id === activeLessonId) || null;

  useEffect(() => {
    if (activeLesson) {
      setDraftContent(activeLesson.content);
      setDraftDirty(false);
    }
  }, [activeLessonId]);

  async function handleAddLesson() {
    if (!id) return;
    const created = await createLesson(id, `Lecție ${lessons.length + 1}`);
    loadLessons();
    setActiveLessonId(created.id);
  }

  async function handleSaveLesson() {
    if (!activeLesson) return;
    await updateLesson(activeLesson.id, { content: draftContent });
    setDraftDirty(false);
    loadLessons();
  }

  function addBlock(type: LessonBlock["type"]) {
    const id = crypto.randomUUID();
    let block: LessonBlock;
    if (type === "TEXT") block = { id, type: "TEXT", text: "" };
    else if (type === "IMAGE") block = { id, type: "IMAGE", url: "" };
    else if (type === "VIDEO") block = { id, type: "VIDEO", url: "" };
    else block = { id, type: "QUIZ", questions: [], requiredScoreToUnlockNext: 70 };
    setDraftContent([...draftContent, block]);
    setDraftDirty(true);
  }

  async function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId || !id) return;
    const reordered = [...lessons];
    const fromIdx = reordered.findIndex((l) => l.id === dragId);
    const toIdx = reordered.findIndex((l) => l.id === targetId);
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    setLessons(reordered);
    setDragId(null);
    await reorderLessons(id, reordered.map((l, idx) => ({ id: l.id, order: idx })));
    loadLessons();
  }

  if (!course) return <AppShell title="Curs" subtitle="Se încarcă..."><div /></AppShell>;

  return (
    <AppShell title={course.title} subtitle="Editor de curs — lecții, colaborare și configurare asistent">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Button variant="ghost" onClick={() => navigate("/lms")}>← Înapoi la cursuri</Button>
        <div style={{ display: "flex", gap: 8 }}>
          <Button id="lms-invite-coauthor-btn" variant="ghost" onClick={() => setShowInvite(true)} style={{ display: "flex", alignItems: "center", gap: 6 }}><UserPlus size={14} /> Invită Co-autor</Button>
          <Button
            variant="ghost"
            onClick={async () => { await updateCourse(course.id, { status: course.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED" }); loadCourse(); }}
          >
            {course.status === "PUBLISHED" ? "Retrage" : "Publică"}
          </Button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: `1px solid ${T.line}` }}>
        {[{ key: "lectii" as const, label: "Lecții" }, { key: "colaborare" as const, label: "Colaborare" }, { key: "asistent" as const, label: "Asistent" }, { key: "cursanti" as const, label: "Cursanți" }].map((t) => (
          <button
            key={t.key}
            id={`lms-editor-tab-${t.key}`}
            onClick={() => setTab(t.key)}
            style={{ border: "none", background: "none", padding: "8px 4px", marginRight: 18, fontSize: 13, fontWeight: 700, cursor: "pointer", color: tab === t.key ? T.brand : T.ink3, borderBottom: tab === t.key ? `2px solid ${T.brand}` : "2px solid transparent" }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "lectii" && (
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 20 }}>
          <Card style={{ padding: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
              {lessons.map((l, lIdx) => (
                <div
                  key={l.id}
                  id={lIdx === 0 ? "lms-editor-lesson-row" : undefined}
                  draggable
                  onDragStart={() => setDragId(l.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(l.id)}
                  onClick={() => setActiveLessonId(l.id)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: activeLessonId === l.id ? T.brandTint : "transparent" }}
                >
                  <GripVertical size={13} color={T.ink4} />
                  <span style={{ fontSize: 13, fontWeight: activeLessonId === l.id ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.title}</span>
                </div>
              ))}
            </div>
            <Button variant="ghost" style={{ width: "100%", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={handleAddLesson}>
              <Plus size={13} /> Lecție nouă
            </Button>
            <Button id="lms-generate-structure-btn" variant="ghost" style={{ width: "100%", fontSize: 12, marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }} onClick={() => setShowGenerate(true)}>
              <Sparkles size={13} /> Generează structură AI
            </Button>
          </Card>

          {!activeLesson ? (
            <Card><p style={{ color: T.ink3 }}>Adaugă o lecție pentru a începe.</p></Card>
          ) : previewing ? (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <div id="lms-preview-width-buttons" style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setPreviewWidth("desktop")} style={{ padding: 8, borderRadius: 8, border: `1px solid ${previewWidth === "desktop" ? T.brand : T.line}`, background: previewWidth === "desktop" ? T.brandTint : T.card, cursor: "pointer", color: T.brand }}><Monitor size={15} /></button>
                  <button onClick={() => setPreviewWidth("tablet")} style={{ padding: 8, borderRadius: 8, border: `1px solid ${previewWidth === "tablet" ? T.brand : T.line}`, background: previewWidth === "tablet" ? T.brandTint : T.card, cursor: "pointer", color: T.brand }}><Tablet size={15} /></button>
                  <button onClick={() => setPreviewWidth("mobile")} style={{ padding: 8, borderRadius: 8, border: `1px solid ${previewWidth === "mobile" ? T.brand : T.line}`, background: previewWidth === "mobile" ? T.brandTint : T.card, cursor: "pointer", color: T.brand }}><Smartphone size={15} /></button>
                </div>
                <Button variant="ghost" onClick={() => setPreviewing(false)}>Ieși din previzualizare</Button>
              </div>
              <div style={{ maxWidth: PREVIEW_WIDTHS[previewWidth], margin: "0 auto", transition: "max-width .2s ease" }}>
                <Card>
                  <h3 style={{ marginTop: 0 }}>{activeLesson.title}</h3>
                  <LessonBlocksView blocks={draftContent} />
                </Card>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <input
                  value={activeLesson.title}
                  onChange={(e) => setLessons(lessons.map((l) => (l.id === activeLesson.id ? { ...l, title: e.target.value } : l)))}
                  onBlur={(e) => updateLesson(activeLesson.id, { title: e.target.value })}
                  style={{ fontSize: 16, fontWeight: 700, border: "none", background: "none", flex: 1 }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <Button id="lms-editor-preview-btn" variant="ghost" style={{ display: "flex", alignItems: "center", gap: 6 }} onClick={() => setPreviewing(true)}><Eye size={14} /> Previzualizare</Button>
                  <Button variant="danger" onClick={async () => { await deleteLesson(activeLesson.id); setActiveLessonId(null); loadLessons(); }}>Șterge lecția</Button>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
                {draftContent.map((block, idx) => (
                  <BlockEditor
                    key={block.id}
                    block={block}
                    onChange={(b) => { setDraftContent(draftContent.map((x, i) => (i === idx ? b : x))); setDraftDirty(true); }}
                    onRemove={() => { setDraftContent(draftContent.filter((_, i) => i !== idx)); setDraftDirty(true); }}
                  />
                ))}
              </div>

              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                <Button variant="ghost" style={{ fontSize: 12 }} onClick={() => addBlock("TEXT")}>+ Text</Button>
                <Button variant="ghost" style={{ fontSize: 12 }} onClick={() => addBlock("IMAGE")}>+ Imagine</Button>
                <Button variant="ghost" style={{ fontSize: 12 }} onClick={() => addBlock("VIDEO")}>+ Video</Button>
                <Button variant="ghost" style={{ fontSize: 12 }} onClick={() => addBlock("QUIZ")}>+ Test</Button>
              </div>

              <Button onClick={handleSaveLesson} style={{ opacity: draftDirty ? 1 : 0.6 }}>{draftDirty ? "Salvează modificările" : "Salvat"}</Button>
            </div>
          )}
        </div>
      )}

      {tab === "colaborare" && activeLesson && (
        <ReviewPanel courseId={course.id} lessonId={activeLesson.id} blocks={activeLesson.content} />
      )}
      {tab === "colaborare" && !activeLesson && <p style={{ color: T.ink3 }}>Alege o lecție din tab-ul „Lecții" pentru a vedea comentariile.</p>}

      {tab === "asistent" && <AssistantPanel courseId={course.id} />}
      {tab === "cursanti" && <EnrollmentsTab courseId={course.id} />}

      {showGenerate && <GenerateStructureModal courseId={course.id} onClose={() => setShowGenerate(false)} onGenerated={() => { setShowGenerate(false); loadLessons(); }} />}
      {showInvite && <InviteCollaboratorModal courseId={course.id} onClose={() => setShowInvite(false)} onInvited={() => { setShowInvite(false); loadCourse(); }} />}
    </AppShell>
  );
}
