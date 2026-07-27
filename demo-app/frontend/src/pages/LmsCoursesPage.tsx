import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, Plus } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Card, Button, FieldLabel, SectionHeader, Pill } from "../components/ui";
import { Modal } from "../components/Modal";
import { T } from "../theme";
import { useAuth } from "../features/iam/AuthContext";
import { fetchCourses, createCourse, LmsCourseSummary } from "../features/lms/api";

const CREATOR_ROLES = ["SUPER_ADMIN", "ADMIN_INSTITUTIE", "AUTOR", "CNFPA"];
// Acces necondiționat de editor la ORICE curs (platformă/evaluare) — restul utilizatorilor
// ajung în editor doar pe cursurile unde chiar sunt autor/colaborator (vezi canEditCourse
// mai jos), nu pe baza rolului global — invitarea ca Co-autor nu schimbă rolul global.
const PLATFORM_EDITOR_ROLES = ["SUPER_ADMIN", "ADMIN_INSTITUTIE", "EVALUATOR"];

function canEditCourse(course: LmsCourseSummary, userId?: string, userRole?: string): boolean {
  if (!userId) return false;
  if (PLATFORM_EDITOR_ROLES.includes(userRole || "")) return true;
  if (course.authorId === userId) return true;
  return course.collaborators.some((c) => c.userId === userId);
}

function CreateCourseModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: LmsCourseSummary) => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
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
      const created = await createCourse({ title, description: description || undefined });
      onCreated(created);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Nu am putut crea cursul");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal isOpen onClose={onClose} width={440}>
        <Card>
          <SectionHeader title="Curs nou" />
          <FieldLabel>Titlu</FieldLabel>
          <input id="lms-create-course-title-input" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: "100%", marginBottom: 12 }} />
          <FieldLabel>Descriere</FieldLabel>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: "100%", minHeight: 80, marginBottom: 14 }} />
          {error && <p style={{ color: T.danger, fontSize: 13 }}>{error}</p>}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={onClose}>Anulează</Button>
            <Button id="lms-create-course-submit-btn" onClick={handleCreate} style={{ opacity: saving ? 0.6 : 1 }}>{saving ? "Se creează..." : "Creează"}</Button>
          </div>
        </Card>
    </Modal>
  );
}

export default function LmsCoursesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [courses, setCourses] = useState<LmsCourseSummary[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const canCreate = user && CREATOR_ROLES.includes(user.role);

  function load() {
    fetchCourses().then(setCourses).catch(() => setCourses([]));
  }
  useEffect(load, []);

  return (
    <AppShell title="Cursuri" subtitle="Platforma de învățare (LMS) — creare, colaborare și parcurgere cursuri">
      {canCreate && (
        <div style={{ marginBottom: 20 }}>
          <Button id="lms-new-course-btn" onClick={() => setShowCreate(true)} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Plus size={15} /> Curs nou
          </Button>
        </div>
      )}
      <SectionHeader title={`${courses.length} cursuri`} />
      <div style={{ display: "grid", gap: 12 }}>
        {courses.map((c, cIdx) => (
          <Card
            key={c.id}
            id={cIdx === 0 ? "lms-first-course-card" : undefined}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
            onClick={() => navigate(canEditCourse(c, user?.id, user?.role) ? `/lms/courses/${c.id}` : `/lms/courses/${c.id}/learn`)}
          >
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: T.brandTint, display: "flex", alignItems: "center", justifyContent: "center", color: T.brand }}>
                <GraduationCap size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{c.title}</div>
                <div style={{ fontSize: 12, color: T.ink3 }}>{c.lessons.length} lecții · {c.collaborators.length} colaboratori</div>
              </div>
            </div>
            {c.status === "PUBLISHED" ? (
              <Pill color={T.success} bg={T.successTint}>Publicat</Pill>
            ) : (
              <Pill color={T.warn} bg={T.warnTint}>Ciornă</Pill>
            )}
          </Card>
        ))}
        {courses.length === 0 && <p style={{ color: T.ink3 }}>Niciun curs disponibil încă.</p>}
      </div>

      {showCreate && (
        <CreateCourseModal
          onClose={() => setShowCreate(false)}
          onCreated={(c) => { setShowCreate(false); navigate(`/lms/courses/${c.id}`); }}
        />
      )}
    </AppShell>
  );
}
