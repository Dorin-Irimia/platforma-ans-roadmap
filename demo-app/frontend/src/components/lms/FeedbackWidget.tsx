import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { T } from "../../theme";
import { Button } from "../ui";
import { useToast } from "../ToastProvider";
import { fetchMyFeedback, submitFeedback, LmsFeedbackScope } from "../../features/lms/api";
import { StarRating } from "./StarRating";

// Widget de evaluare (stele + comentariu opțional) pentru o țintă anume — un element din
// lecție (scope=BLOCK) sau cursul întreg (scope=COURSE). Autonom: își încarcă singur
// evaluarea proprie existentă la montare.
//
// Randare în două nivele, ca lecția să rămână cursivă și necombinată de un formular mereu
// deschis sub fiecare bloc: rândul cu stelele e mereu vizibil (compact, o singură linie),
// iar tot ce ține de comentariu (adăugare/editare/afișare) stă strâns sub o săgeată "vezi
// mai multe" chiar lângă stele — implicit închisă. Un comentariu deja trimis se arată ca
// un comentariu propriu-zis (autor + dată/oră), nu ca un textarea gol redeschis la reload.
export function FeedbackWidget({
  courseId,
  scope,
  lessonId,
  blockId,
  projectId,
  label,
}: {
  courseId: string;
  scope: LmsFeedbackScope;
  lessonId?: string;
  blockId?: string;
  projectId?: string;
  label: string;
}) {
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [savedComment, setSavedComment] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchMyFeedback(courseId, scope, lessonId, blockId, projectId).then((mine) => {
      if (cancelled) return;
      if (mine.rating) setRating(mine.rating);
      setSavedComment(mine.comment);
      setSavedAt(mine.updatedAt);
      setLoaded(true);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, scope, lessonId, blockId, projectId]);

  async function persist(nextRating: number, nextComment: string | null) {
    setSubmitting(true);
    try {
      await submitFeedback(courseId, { scope, lessonId, blockId, projectId, rating: nextRating, comment: nextComment || undefined });
      setSavedComment(nextComment);
      setSavedAt(new Date().toISOString());
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Evaluarea nu a putut fi trimisă");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRate(nextRating: number) {
    setRating(nextRating);
    await persist(nextRating, savedComment);
  }

  async function handleSaveComment() {
    if (!rating) return;
    await persist(rating, draft.trim() || null);
    setEditing(false);
  }

  function startEditing() {
    setDraft(savedComment || "");
    setEditing(true);
  }

  if (!loaded) return null;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12, color: T.ink3, fontWeight: 600 }}>{label}</span>
        <StarRating value={rating} onChange={handleRate} size={16} disabled={submitting} />
        <button
          onClick={() => setExpanded((e) => !e)}
          title={expanded ? "Ascunde" : "Vezi mai multe"}
          style={{ display: "flex", alignItems: "center", background: "none", border: "none", cursor: "pointer", color: T.ink4, padding: 2 }}
        >
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 6, maxWidth: 380 }}>
          {savedComment && !editing ? (
            <div style={{ padding: 8, background: T.line2, borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: T.ink3, marginBottom: 3 }}>
                Tu{savedAt ? ` · ${new Date(savedAt).toLocaleString("ro-RO")}` : ""}
              </div>
              <div style={{ fontSize: 12.5, color: T.ink2, marginBottom: 4 }}>{savedComment}</div>
              <button onClick={startEditing} style={{ background: "none", border: "none", color: T.brand, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                Editează
              </button>
            </div>
          ) : rating > 0 ? (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <textarea
                autoFocus={editing}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ce ai apreciat sau ce s-ar putea îmbunătăți?"
                style={{ flex: 1, minHeight: 44, fontSize: 12.5, resize: "vertical", padding: 6, borderRadius: 8, border: `1px solid ${T.line}` }}
              />
              <Button
                style={{ fontSize: 11.5, padding: "5px 10px", opacity: submitting ? 0.6 : 1 }}
                disabled={submitting}
                onClick={handleSaveComment}
              >
                Trimite
              </Button>
              {editing && (
                <Button variant="ghost" style={{ fontSize: 11.5, padding: "5px 10px" }} onClick={() => setEditing(false)}>
                  Anulează
                </Button>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: T.ink4, margin: 0 }}>Alege mai întâi un număr de stele.</p>
          )}
        </div>
      )}
    </div>
  );
}
