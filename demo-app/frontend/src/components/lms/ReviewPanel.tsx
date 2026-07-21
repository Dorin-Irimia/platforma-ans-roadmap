import { useEffect, useState } from "react";
import { Card, Button, FieldLabel, SectionHeader, Pill } from "../ui";
import { T } from "../../theme";
import {
  fetchComments,
  addComment,
  resolveComment,
  fetchRubric,
  saveRubric,
  submitRubricScore,
  fetchRubricScores,
  LmsCommentDto,
  LmsRubricCriterion,
  LmsRubricScoreDto,
  LessonBlock,
} from "../../features/lms/api";

// Panou de revizuire — comentarii contextuale pe bloc + rezolvare, plus rubrică de
// evaluare cu feedback structurat (pct. 12).
export function ReviewPanel({ courseId, lessonId, blocks }: { courseId: string; lessonId: string; blocks: LessonBlock[] }) {
  const [comments, setComments] = useState<LmsCommentDto[]>([]);
  const [newCommentBlockId, setNewCommentBlockId] = useState(blocks[0]?.id || "");
  const [newCommentBody, setNewCommentBody] = useState("");
  const [criteria, setCriteria] = useState<LmsRubricCriterion[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [rubricScores, setRubricScores] = useState<LmsRubricScoreDto[]>([]);

  function loadComments() {
    fetchComments(lessonId).then(setComments).catch(() => setComments([]));
  }
  useEffect(loadComments, [lessonId]);

  useEffect(() => {
    fetchRubric(courseId).then((r) => setCriteria(r?.criteria || [])).catch(() => setCriteria([]));
    fetchRubricScores(lessonId).then(setRubricScores).catch(() => setRubricScores([]));
  }, [courseId, lessonId]);

  async function handleAddComment() {
    if (!newCommentBody.trim() || !newCommentBlockId) return;
    await addComment(lessonId, newCommentBlockId, newCommentBody.trim());
    setNewCommentBody("");
    loadComments();
  }

  async function handleAddCriterion() {
    const next = [...criteria, { label: `Criteriu ${criteria.length + 1}`, maxScore: 10 }];
    setCriteria(next);
    await saveRubric(courseId, next);
  }

  async function handleSubmitScores() {
    const payload = criteria.map((c) => ({ label: c.label, score: scores[c.label] ?? 0 }));
    await submitRubricScore(lessonId, payload);
    fetchRubricScores(lessonId).then(setRubricScores);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <SectionHeader title="Comentarii contextuale" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
          {comments.map((c, cIdx) => (
            <div key={c.id} style={{ padding: 10, background: T.line2, borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: T.ink3, marginBottom: 4 }}>
                bloc: {blocks.findIndex((b) => b.id === c.blockId) + 1 || "?"} · {new Date(c.createdAt).toLocaleString("ro-RO")}
                {c.resolved && <Pill color={T.success} bg={T.successTint} style={{ marginLeft: 8 }}>Rezolvat</Pill>}
              </div>
              <div style={{ fontSize: 13.5, color: T.ink }}>{c.body}</div>
              {!c.resolved && (
                <Button
                  id={cIdx === 0 ? "lms-comment-resolve-btn" : undefined}
                  variant="ghost"
                  style={{ fontSize: 11.5, padding: "4px 10px", marginTop: 6 }}
                  onClick={async () => { await resolveComment(c.id); loadComments(); }}
                >
                  Marchează ca rezolvat
                </Button>
              )}
            </div>
          ))}
          {comments.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Niciun comentariu pe această lecție încă.</p>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={newCommentBlockId} onChange={(e) => setNewCommentBlockId(e.target.value)} style={{ width: 140 }}>
            {blocks.map((b, i) => <option key={b.id} value={b.id}>Bloc {i + 1} ({b.type})</option>)}
          </select>
          <input value={newCommentBody} onChange={(e) => setNewCommentBody(e.target.value)} placeholder="Comentariu nou..." style={{ flex: 1 }} />
          <Button id="lms-comment-send-btn" onClick={handleAddComment}>Trimite</Button>
        </div>
      </Card>

      <Card>
        <SectionHeader title="Rubrică de evaluare" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          {criteria.map((c, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 13.5, flex: 1 }}>{c.label} (max {c.maxScore})</span>
              <input
                type="number"
                min={0}
                max={c.maxScore}
                value={scores[c.label] ?? ""}
                onChange={(e) => setScores({ ...scores, [c.label]: Number(e.target.value) })}
                style={{ width: 70 }}
              />
            </div>
          ))}
          {criteria.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Niciun criteriu definit încă.</p>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button id="lms-rubric-add-criterion-btn" variant="ghost" onClick={handleAddCriterion}>+ Criteriu</Button>
          {criteria.length > 0 && <Button id="lms-rubric-save-score-btn" onClick={handleSubmitScores}>Salvează scorul</Button>}
        </div>

        {rubricScores.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.ink3, marginBottom: 8 }}>Scoruri anterioare</div>
            {rubricScores.map((s) => (
              <div key={s.id} style={{ fontSize: 12.5, color: T.ink2, marginBottom: 4 }}>
                {new Date(s.createdAt).toLocaleString("ro-RO")} — {s.scores.map((sc) => `${sc.label}: ${sc.score}`).join(", ")}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
