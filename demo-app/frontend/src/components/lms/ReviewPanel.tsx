import { useEffect, useState } from "react";
import { Card, Button, SectionHeader, Pill } from "../ui";
import { T } from "../../theme";
import {
  fetchComments,
  addComment,
  replyToComment,
  updateCommentStatus,
  fetchRubric,
  saveRubric,
  submitRubricScore,
  fetchRubricScores,
  LmsCommentDto,
  LmsCommentStatus,
  LmsRubricCriterion,
  LmsRubricScoreDto,
  LessonBlock,
} from "../../features/lms/api";
import { CommentableLessonView, scrollToCommentAnchor, blockTypeLabel } from "./CommentableLessonView";

const STATUS_META: Record<LmsCommentStatus, { label: string; color: string; tint: string }> = {
  OPEN: { label: "Deschis", color: T.warn, tint: T.warnTint },
  RESOLVED: { label: "Rezolvat", color: T.success, tint: T.successTint },
  REJECTED: { label: "Respins", color: T.danger, tint: T.dangerTint },
};

function CommentItem({
  comment,
  blocks,
  isFirst,
  onStatusChange,
  onReply,
}: {
  comment: LmsCommentDto;
  blocks: LessonBlock[];
  isFirst: boolean;
  onStatusChange: (id: string, status: LmsCommentStatus) => Promise<void>;
  onReply: (id: string, body: string) => Promise<void>;
}) {
  const [replying, setReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const meta = STATUS_META[comment.status];

  async function handleReplySubmit() {
    if (!replyBody.trim()) return;
    setSubmitting(true);
    try {
      await onReply(comment.id, replyBody.trim());
      setReplyBody("");
      setReplying(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div id={`lms-comment-${comment.id}`} style={{ padding: 10, background: T.line2, borderRadius: 10 }}>
      <div style={{ fontSize: 12, color: T.ink3, marginBottom: 4, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
        <strong style={{ color: T.ink2 }}>{comment.author?.name || comment.author?.email || "Utilizator"}</strong>
        <span>· {new Date(comment.createdAt).toLocaleString("ro-RO")}</span>
        <button
          onClick={() => scrollToCommentAnchor(comment, blocks)}
          style={{ background: "none", border: "none", color: T.brand, fontWeight: 700, cursor: "pointer", padding: 0, fontSize: 12 }}
        >
          · vezi în lecție ({blockTypeLabel(blocks, comment.blockId)})
        </button>
        <Pill color={meta.color} bg={meta.tint}>{meta.label}</Pill>
      </div>
      {comment.quote && (
        <div style={{ fontSize: 12.5, fontStyle: "italic", color: T.ink3, borderLeft: `3px solid ${T.brand}`, paddingLeft: 8, marginBottom: 6 }}>
          „{comment.quote}”
        </div>
      )}
      <div style={{ fontSize: 13.5, color: T.ink, marginBottom: 6 }}>{comment.body}</div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {comment.status === "OPEN" ? (
          <>
            <Button
              id={isFirst ? "lms-comment-resolve-btn" : undefined}
              variant="ghost"
              style={{ fontSize: 11.5, padding: "4px 10px" }}
              onClick={() => onStatusChange(comment.id, "RESOLVED")}
            >
              Marchează ca rezolvat
            </Button>
            <Button variant="ghost" style={{ fontSize: 11.5, padding: "4px 10px" }} onClick={() => onStatusChange(comment.id, "REJECTED")}>
              Respinge
            </Button>
          </>
        ) : (
          <Button variant="ghost" style={{ fontSize: 11.5, padding: "4px 10px" }} onClick={() => onStatusChange(comment.id, "OPEN")}>
            Redeschide
          </Button>
        )}
        <Button variant="ghost" style={{ fontSize: 11.5, padding: "4px 10px" }} onClick={() => setReplying(!replying)}>
          Răspunde
        </Button>
      </div>

      {comment.replies && comment.replies.length > 0 && (
        <div style={{ marginTop: 10, paddingLeft: 14, borderLeft: `2px solid ${T.line}`, display: "flex", flexDirection: "column", gap: 8 }}>
          {comment.replies.map((r) => (
            <div key={r.id}>
              <div style={{ fontSize: 11.5, color: T.ink3 }}>
                <strong style={{ color: T.ink2 }}>{r.author?.name || r.author?.email || "Utilizator"}</strong> · {new Date(r.createdAt).toLocaleString("ro-RO")}
              </div>
              <div style={{ fontSize: 13, color: T.ink }}>{r.body}</div>
            </div>
          ))}
        </div>
      )}

      {replying && (
        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
          <input
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            placeholder="Răspunsul tău..."
            style={{ flex: 1, fontSize: 13 }}
            onKeyDown={(e) => { if (e.key === "Enter") handleReplySubmit(); }}
          />
          <Button style={{ fontSize: 12, padding: "5px 10px", opacity: submitting ? 0.6 : 1 }} onClick={handleReplySubmit} disabled={submitting || !replyBody.trim()}>
            {submitting ? "..." : "Trimite"}
          </Button>
        </div>
      )}
    </div>
  );
}

// Panou de revizuire — comentarii contextuale pe bloc + rezolvare, plus rubrică de
// evaluare cu feedback structurat (pct. 12).
export function ReviewPanel({ courseId, lessonId, blocks }: { courseId: string; lessonId: string; blocks: LessonBlock[] }) {
  const [comments, setComments] = useState<LmsCommentDto[]>([]);
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

  async function handleAddComment(blockId: string, body: string, quote?: string) {
    await addComment(lessonId, blockId, body, quote);
    loadComments();
  }

  async function handleStatusChange(id: string, status: LmsCommentStatus) {
    await updateCommentStatus(id, status);
    loadComments();
  }

  async function handleReply(id: string, body: string) {
    await replyToComment(id, body);
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
        <SectionHeader title="Conținutul lecției" />
        <p style={{ fontSize: 12.5, color: T.ink3, marginTop: -8, marginBottom: 14 }}>
          Selectează o secvență de text ca să comentezi asupra ei, sau apasă „Comentează” pe o întrebare de test ori pe un bloc media.
        </p>
        <CommentableLessonView blocks={blocks} comments={comments} onAddComment={handleAddComment} />
      </Card>

      <Card>
        <SectionHeader title="Comentarii" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {comments.map((c, cIdx) => (
            <CommentItem
              key={c.id}
              comment={c}
              blocks={blocks}
              isFirst={cIdx === 0}
              onStatusChange={handleStatusChange}
              onReply={handleReply}
            />
          ))}
          {comments.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Niciun comentariu pe această lecție încă.</p>}
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
