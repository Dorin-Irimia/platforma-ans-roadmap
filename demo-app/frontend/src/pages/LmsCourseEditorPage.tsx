import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Monitor, Tablet, Smartphone, Eye, Sparkles, Plus, GripVertical, UserPlus, UserMinus, ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AppShell } from "../components/AppShell";
import { Card, Button, FieldLabel, SectionHeader, Pill } from "../components/ui";
import { Modal } from "../components/Modal";
import { useToast } from "../components/ToastProvider";
import { T } from "../theme";
import { fetchUsers } from "../features/iam/api";
import {
  fetchCourse,
  updateCourse,
  deleteCourse,
  fetchLessons,
  createLesson,
  updateLesson,
  deleteLesson,
  reorderLessons,
  generateStructure,
  addCollaborator,
  removeCollaborator,
  fetchCourseEnrollments,
  fetchQuizReport,
  LmsCourseSummary,
  LmsLessonDto,
  LessonBlock,
  LmsEnrollmentRosterDto,
  LmsQuizLessonReport,
} from "../features/lms/api";
import { generateId } from "../lib/id";
import { LessonBlocksView } from "../components/lms/LessonBlocksView";
import { BlockEditor } from "../components/lms/BlockEditor";
import { ReviewPanel } from "../components/lms/ReviewPanel";
import { AssistantPanel } from "../components/lms/AssistantPanel";

const PREVIEW_WIDTHS: Record<"desktop" | "tablet" | "mobile", string> = { desktop: "100%", tablet: "768px", mobile: "375px" };

// Reordonare lecții prin drag-and-drop (@dnd-kit — accesibil de la tastatură/touch,
// înlocuiește DnD-ul HTML5 nativ folosit anterior). Handle-ul dedicat (GripVertical)
// primește listener-ii de drag, nu tot rândul, ca "onClick" de selecție să rămână
// neatins (același rând rămâne clickabil normal pentru a activa lecția).
function SortableLessonRow({ lesson, isActive, isFirst, onSelect }: { lesson: LmsLessonDto; isActive: boolean; isFirst: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });
  return (
    <div
      ref={setNodeRef}
      id={isFirst ? "lms-editor-lesson-row" : undefined}
      onClick={onSelect}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 10px",
        borderRadius: 8,
        cursor: "pointer",
        background: isActive ? T.brandTint : "transparent",
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <button {...attributes} {...listeners} style={{ background: "none", border: "none", cursor: "grab", padding: 0, display: "flex" }} aria-label="Reordonează lecția">
        <GripVertical size={13} color={T.ink4} />
      </button>
      <span style={{ fontSize: 13, fontWeight: isActive ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lesson.title}</span>
    </div>
  );
}

// Reordonare blocuri de conținut (text/imagine/video/quiz) în interiorul unei lecții —
// funcție nouă, nu exista deloc înainte (doar adăugare/ștergere de blocuri). Handle-ul
// e pasat ca prop în BlockEditor, ca acesta să rămână agnostic de mecanismul de DnD.
function SortableBlockItem({ block, isFirst, onChange, onRemove }: { block: LessonBlock; isFirst: boolean; onChange: (b: LessonBlock) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }}>
      <BlockEditor
        block={block}
        onChange={onChange}
        onRemove={onRemove}
        dragHandle={
          <button
            id={isFirst ? "lms-block-drag-handle" : undefined}
            {...attributes}
            {...listeners}
            style={{ background: "none", border: "none", cursor: "grab", padding: 0, display: "flex", color: T.ink4 }}
            aria-label="Reordonează blocul"
          >
            <GripVertical size={14} />
          </button>
        }
      />
    </div>
  );
}

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
    <Modal isOpen onClose={onClose} width={460}>
        <Card>
          <SectionHeader title="Generează structură cu AI" />
          <FieldLabel>Subiect / descriere material</FieldLabel>
          <textarea id="lms-generate-structure-subject-input" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ width: "100%", minHeight: 100, marginBottom: 12 }} placeholder="ex: Introducere în managementul proiectelor sportive..." />
          <FieldLabel>Sau încarcă un fișier (opțional)</FieldLabel>
          <input id="lms-generate-structure-file-input" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ marginBottom: 14 }} />
          {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={onClose}>Anulează</Button>
            <Button id="lms-generate-structure-submit-btn" onClick={handleGenerate} style={{ opacity: busy ? 0.6 : 1 }}>{busy ? "Se generează..." : "Generează"}</Button>
          </div>
        </Card>
    </Modal>
  );
}

function InviteCollaboratorModal({ courseId, onClose, onInvited }: { courseId: string; onClose: () => void; onInvited: () => void }) {
  const toast = useToast();
  const [users, setUsers] = useState<{ id: string; email: string; name?: string }[]>([]);
  const [userId, setUserId] = useState("");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchUsers().then(setUsers).catch(() => setUsers([]));
  }, []);

  async function handleInvite() {
    if (!userId) return;
    setInviting(true);
    try {
      const picked = users.find((u) => u.id === userId);
      await addCollaborator(courseId, userId, "COAUTHOR");
      // Nu există (încă) un sistem de notificări în platformă — contul invitat NU e
      // anunțat automat. Confirmăm cel puțin clar, aici, ce s-a întâmplat: contul apare
      // instant în lista lui de cursuri, cu drept de editare, la următoarea reîmprospătare.
      toast.success(`${picked?.name || picked?.email || "Utilizatorul"} are acum acces de Co-autor pe acest curs — va vedea cursul la următoarea autentificare/reîmprospătare a listei. Platforma nu trimite încă o notificare automată.`, { duration: 7000 });
      onInvited();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Invitația a eșuat");
    } finally {
      setInviting(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} width={400}>
        <Card>
          <SectionHeader title="Invită Co-autor" />
          <FieldLabel>Utilizator</FieldLabel>
          <select value={userId} onChange={(e) => setUserId(e.target.value)} style={{ width: "100%", marginBottom: 14 }}>
            <option value="">Alege un cont...</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
          </select>
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={onClose}>Anulează</Button>
            <Button onClick={handleInvite} style={{ opacity: inviting ? 0.6 : 1 }}>{inviting ? "Se invită..." : "Invită"}</Button>
          </div>
        </Card>
    </Modal>
  );
}

// Elimină accesul de editare al unui colaborator (pct. 12). Autorul cursului (course.authorId)
// nu poate fi eliminat din această listă — rândul lui de tip AUTHOR e legat de proprietatea
// cursului, nu doar de o invitație, așa că ar rămâne un curs orfan de editor.
function CollaboratorsPanel({ course, onChanged }: { course: LmsCourseSummary; onChanged: () => void }) {
  const toast = useToast();
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function handleRemove(userId: string, label: string) {
    if (!window.confirm(`Elimini accesul de editare al lui ${label} pe acest curs? Persoana nu va mai putea vedea sau modifica lecțiile — poate fi reinvitată oricând.`)) return;
    setRemovingId(userId);
    try {
      await removeCollaborator(course.id, userId);
      toast.success(`${label} nu mai are acces de editare pe acest curs.`);
      onChanged();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || "Nu am putut elimina colaboratorul");
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Card style={{ marginBottom: 16 }}>
      <SectionHeader title="Colaboratori" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {course.collaborators.map((c) => {
          const label = c.user.name || c.user.email;
          const isOwner = c.userId === course.authorId;
          return (
            <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderRadius: 8, border: `1px solid ${T.line}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{label}</div>
                <Pill color={c.courseRole === "AUTHOR" ? T.brand : T.ink3} bg={c.courseRole === "AUTHOR" ? T.brandTint : T.line}>
                  {c.courseRole === "AUTHOR" ? "Autor" : "Co-autor"}
                </Pill>
              </div>
              {!isOwner && (
                <Button
                  variant="ghost"
                  style={{ fontSize: 12, color: T.danger, display: "flex", alignItems: "center", gap: 6, opacity: removingId === c.userId ? 0.6 : 1 }}
                  onClick={() => handleRemove(c.userId, label)}
                >
                  <UserMinus size={13} /> {removingId === c.userId ? "Se elimină..." : "Elimină"}
                </Button>
              )}
            </div>
          );
        })}
        {course.collaborators.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Niciun colaborator încă.</p>}
      </div>
    </Card>
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

// Raport agregat de răspunsuri la teste, per curs — pentru fiecare lecție cu test,
// rezumat (cursanți testați/promovare/scor mediu) + un breakdown expandabil per întrebare
// (distribuția opțiunilor alese, opțiunile corecte evidențiate).
function QuizReportTab({ courseId }: { courseId: string }) {
  const [report, setReport] = useState<LmsQuizLessonReport[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchQuizReport(courseId).then(setReport).catch(() => setReport([]));
  }, [courseId]);

  function toggle(lessonId: string) {
    const next = new Set(expanded);
    if (next.has(lessonId)) next.delete(lessonId);
    else next.add(lessonId);
    setExpanded(next);
  }

  if (report.length === 0) {
    return <p style={{ color: T.ink3 }}>Niciun test nu are încă răspunsuri înregistrate.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {report.map((r) => (
        <Card key={r.lessonId} style={{ padding: 16 }}>
          <div
            onClick={() => toggle(r.lessonId)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {expanded.has(r.lessonId) ? <ChevronDown size={15} color={T.ink3} /> : <ChevronRight size={15} color={T.ink3} />}
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>{r.lessonTitle}</div>
            </div>
            <div style={{ display: "flex", gap: 18, fontSize: 12.5, color: T.ink3 }}>
              <span>{r.attemptedCount} cursanți testați</span>
              <span>Promovare: <b style={{ color: T.ink }}>{r.passRate}%</b></span>
              <span>Scor mediu: <b style={{ color: T.ink }}>{r.avgScore}%</b></span>
            </div>
          </div>

          {expanded.has(r.lessonId) && (
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 16 }}>
              {r.questions.map((q, qi) => (
                <div key={q.questionId} style={{ borderTop: `1px solid ${T.line}`, paddingTop: 12 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>
                    {qi + 1}. {q.text} <span style={{ fontWeight: 400, color: T.ink3, fontSize: 12 }}>({q.correctRate}% răspunsuri corecte din {q.answeredCount})</span>
                  </div>
                  {q.options.map((o, oi) => {
                    const isCorrect = q.correctIndexes.includes(oi);
                    const pct = q.answeredCount ? Math.round((q.optionCounts[oi] / q.answeredCount) * 100) : 0;
                    return (
                      <div key={oi} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, fontSize: 12.5 }}>
                        <div style={{ width: 160, flexShrink: 0, display: "flex", alignItems: "center", gap: 4, color: isCorrect ? T.success : T.ink2, fontWeight: isCorrect ? 700 : 400 }}>
                          {isCorrect && <CheckCircle2 size={12} />} {o}
                        </div>
                        <div style={{ flex: 1, height: 8, background: T.line2, borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${pct}%`, height: "100%", background: isCorrect ? T.success : T.brand, borderRadius: 4 }} />
                        </div>
                        <div style={{ width: 60, textAlign: "right", color: T.ink3 }}>{q.optionCounts[oi]} ({pct}%)</div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// Comutatoare de politică ale cursului — vezi schema.prisma (model LmsCourse) pentru
// ce controlează fiecare, în detaliu.
const SETTINGS_META: { key: "allowLearnerComments" | "requireQuizToAdvance" | "issueCertificate"; label: string; help: string; invert?: boolean }[] = [
  {
    key: "allowLearnerComments",
    label: "Permite cursanților să adauge comentarii",
    help: "Doar pe lecțiile pe care le-au deblocat deja. Comentariile unui cursant sunt vizibile lui și colaboratorilor cursului — nu și altor cursanți.",
  },
  {
    key: "requireQuizToAdvance",
    label: "Permite trecerea la lecția următoare fără finalizarea testului",
    help: "Dacă e bifat, Bariera Logică e dezactivată complet pentru acest curs — cursanții pot avansa indiferent de scorul la teste.",
    invert: true,
  },
  {
    key: "issueCertificate",
    label: "Generează certificat la finalizarea cursului",
    help: "Certificatul se emite doar dacă această opțiune e activă ȘI cursantul a promovat toate testele din curs.",
  },
];

function CourseSettingsTab({ course, onChanged }: { course: LmsCourseSummary; onChanged: () => void }) {
  const [saving, setSaving] = useState<string | null>(null);

  async function handleToggle(key: "allowLearnerComments" | "requireQuizToAdvance" | "issueCertificate", nextChecked: boolean, invert?: boolean) {
    setSaving(key);
    try {
      await updateCourse(course.id, { [key]: invert ? !nextChecked : nextChecked });
      onChanged();
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card>
      <SectionHeader title="Setări curs" />
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {SETTINGS_META.map((s) => {
          const rawValue = course[s.key];
          const checked = s.invert ? !rawValue : rawValue;
          return (
            <label key={s.key} style={{ display: "flex", gap: 12, alignItems: "flex-start", cursor: "pointer", opacity: saving === s.key ? 0.6 : 1 }}>
              <input
                type="checkbox"
                checked={checked}
                disabled={saving === s.key}
                onChange={(e) => handleToggle(s.key, e.target.checked, s.invert)}
                style={{ marginTop: 3 }}
              />
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>{s.label}</div>
                <div style={{ fontSize: 12, color: T.ink3, marginTop: 2 }}>{s.help}</div>
              </div>
            </label>
          );
        })}
      </div>
    </Card>
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
  const [tab, setTab] = useState<"lectii" | "colaborare" | "asistent" | "cursanti" | "rapoarte" | "setari">("lectii");
  const [previewing, setPreviewing] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [showGenerate, setShowGenerate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

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
    // Cheie pe activeLesson?.id (nu activeLessonId): la crearea unei lecții noi,
    // activeLessonId se schimbă imediat, dar lista `lessons` (deci `activeLesson`)
    // se actualizează abia după ce fetchLessons() răspunde, un moment mai târziu.
    // Legat doar de activeLessonId, efectul rula o singură dată cu activeLesson
    // încă null (nu făcea nimic) și nu mai rula a doua oară când lecția nouă
    // apărea în `lessons` — draftContent rămânea blocat pe conținutul lecției
    // anterioare, iar +Text/+Imagine/+Test editau de fapt draftul vechi.
    if (activeLesson) {
      setDraftContent(activeLesson.content);
      setDraftDirty(false);
    }
  }, [activeLesson?.id]);

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
    const id = generateId();
    let block: LessonBlock;
    if (type === "TEXT") block = { id, type: "TEXT", text: "" };
    else if (type === "IMAGE") block = { id, type: "IMAGE", url: "" };
    else if (type === "VIDEO") block = { id, type: "VIDEO", url: "" };
    else block = { id, type: "QUIZ", questions: [], requiredScoreToUnlockNext: 70 };
    setDraftContent([...draftContent, block]);
    setDraftDirty(true);
  }

  async function handleLessonDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !id) return;
    const oldIdx = lessons.findIndex((l) => l.id === active.id);
    const newIdx = lessons.findIndex((l) => l.id === over.id);
    const reordered = arrayMove(lessons, oldIdx, newIdx);
    setLessons(reordered);
    await reorderLessons(id, reordered.map((l, idx) => ({ id: l.id, order: idx })));
    loadLessons();
  }

  function handleBlockDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = draftContent.findIndex((b) => b.id === active.id);
    const newIdx = draftContent.findIndex((b) => b.id === over.id);
    setDraftContent(arrayMove(draftContent, oldIdx, newIdx));
    setDraftDirty(true);
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
          <Button
            id="lms-delete-course-btn"
            variant="danger"
            onClick={async () => {
              if (!window.confirm(`Ștergi definitiv cursul "${course.title}"? Se șterg ireversibil toate lecțiile, comentariile, colaboratorii, înscrierile cursanților și certificatele deja emise pentru acest curs. Acțiunea nu poate fi anulată.`)) return;
              await deleteCourse(course.id);
              navigate("/lms");
            }}
          >
            Șterge cursul
          </Button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: `1px solid ${T.line}` }}>
        {[{ key: "lectii" as const, label: "Lecții" }, { key: "colaborare" as const, label: "Colaborare" }, { key: "asistent" as const, label: "Asistent" }, { key: "cursanti" as const, label: "Cursanți" }, { key: "rapoarte" as const, label: "Rapoarte" }, { key: "setari" as const, label: "Setări" }].map((t) => (
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
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLessonDragEnd}>
              <SortableContext items={lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                  {lessons.map((l, lIdx) => (
                    <SortableLessonRow key={l.id} lesson={l} isActive={activeLessonId === l.id} isFirst={lIdx === 0} onSelect={() => setActiveLessonId(l.id)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
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

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleBlockDragEnd}>
                <SortableContext items={draftContent.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 16 }}>
                    {draftContent.map((block, idx) => (
                      <SortableBlockItem
                        key={block.id}
                        block={block}
                        isFirst={idx === 0}
                        onChange={(b) => { setDraftContent(draftContent.map((x, i) => (i === idx ? b : x))); setDraftDirty(true); }}
                        onRemove={() => { setDraftContent(draftContent.filter((_, i) => i !== idx)); setDraftDirty(true); }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

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

      {tab === "colaborare" && (
        <CollaboratorsPanel course={course} onChanged={loadCourse} />
      )}
      {tab === "colaborare" && activeLesson && (
        <ReviewPanel courseId={course.id} lessonId={activeLesson.id} blocks={activeLesson.content} />
      )}
      {tab === "colaborare" && !activeLesson && <p style={{ color: T.ink3 }}>Alege o lecție din tab-ul „Lecții" pentru a vedea comentariile.</p>}

      {tab === "asistent" && <AssistantPanel courseId={course.id} />}
      {tab === "cursanti" && <EnrollmentsTab courseId={course.id} />}
      {tab === "rapoarte" && <QuizReportTab courseId={course.id} />}
      {tab === "setari" && <CourseSettingsTab course={course} onChanged={loadCourse} />}

      {showGenerate && <GenerateStructureModal courseId={course.id} onClose={() => setShowGenerate(false)} onGenerated={() => { setShowGenerate(false); loadLessons(); }} />}
      {showInvite && <InviteCollaboratorModal courseId={course.id} onClose={() => setShowInvite(false)} onInvited={() => { setShowInvite(false); loadCourse(); }} />}
    </AppShell>
  );
}
