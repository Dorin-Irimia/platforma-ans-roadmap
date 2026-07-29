import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { MessageSquarePlus } from "lucide-react";
import { T } from "../../theme";
import { Card, Button } from "../ui";
import { LessonBlock, LmsCommentDto, correctIndexesOf } from "../../features/lms/api";
import { toEmbeddableVideo, extractPlainText, TextAudioControls, BlockFeedback } from "./LessonBlocksView";

interface PendingAnchor {
  blockId: string;
  quote?: string;
  x: number;
  y: number;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function highlightColorFor(matching: LmsCommentDto[]): string | null {
  if (matching.some((c) => c.status === "OPEN")) return "#FCE8D6";
  if (matching.some((c) => c.status === "RESOLVED")) return T.successTint;
  return null;
}

// Derulează la ancora exactă a unui comentariu în conținutul lecției — folosit când dai
// click pe un comentariu din lista de jos, ca să vezi imediat contextul (secvența de text
// selectată, sau întrebarea de test), fără să ghicești "care e blocul".
export function scrollToCommentAnchor(comment: LmsCommentDto, blocks: LessonBlock[]) {
  const flash = (el: HTMLElement) => {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    const prevOutline = el.style.outline;
    const prevOffset = el.style.outlineOffset;
    el.style.outline = `3px solid ${T.brand}`;
    el.style.outlineOffset = "2px";
    setTimeout(() => { el.style.outline = prevOutline; el.style.outlineOffset = prevOffset; }, 1400);
  };
  const markEl = document.getElementById(`lms-comment-mark-${comment.id}`);
  if (markEl) return flash(markEl);
  const block = blocks.find((b) => b.id === comment.blockId);
  if (block?.type === "QUIZ" && comment.quote) {
    const qi = block.questions.findIndex((q) => q.text === comment.quote);
    if (qi !== -1) {
      const qEl = document.getElementById(`lms-quiz-question-${block.id}-${qi}`);
      if (qEl) return flash(qEl);
    }
  }
  const blockEl = document.getElementById(`lms-block-${comment.blockId}`);
  if (blockEl) flash(blockEl);
}

// Ancorare "ca la Word": caută prima apariție a lui `quote` într-un singur nod de text din
// container și îl înfășoară într-un <mark id="lms-comment-mark-…"> (click → derulează la
// comentariul din listă). Funcționează sigur pentru citate conținute într-un singur nod de
// text (cazul obișnuit); un citat care traversează o graniță de formatare (bold/italic la
// mijloc) nu se mai regăsește într-un singur nod și rămâne doar listat sub lecție, fără
// evidențiere in-text — compromis acceptabil față de complexitatea unei căutări cross-nod.
function highlightQuotes(container: HTMLElement, quotes: { commentId: string; quote: string; color: string }[], onClick: (id: string) => void) {
  for (const { commentId, quote, color } of quotes) {
    const needle = quote.trim();
    if (!needle) continue;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const idx = node.textContent?.indexOf(needle) ?? -1;
      if (idx === -1) continue;
      const after = node.splitText(idx);
      after.splitText(needle.length);
      const mark = document.createElement("mark");
      mark.id = `lms-comment-mark-${commentId}`;
      mark.dataset.commentId = commentId;
      mark.style.background = color;
      mark.style.color = T.brandDark;
      mark.style.cursor = "pointer";
      mark.style.borderRadius = "3px";
      mark.title = "Vezi comentariul";
      mark.textContent = needle;
      mark.addEventListener("click", () => onClick(commentId));
      after.parentNode?.replaceChild(mark, after);
      break;
    }
  }
}

function TextBlockWithComments({
  block,
  comments,
  onSelect,
  onHighlightClick,
  feedbackEnabled,
  courseId,
  lessonId,
  projectId,
}: {
  block: Extract<LessonBlock, { type: "TEXT" }>;
  comments: LmsCommentDto[];
  onSelect: (anchor: PendingAnchor) => void;
  onHighlightClick: (commentId: string) => void;
  feedbackEnabled?: boolean;
  courseId?: string;
  lessonId?: string;
  projectId?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const sanitized = useMemo(() => DOMPurify.sanitize(block.text), [block.text]);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = sanitized;
    const quotes = comments
      .filter((c) => c.blockId === block.id && c.quote && c.status !== "REJECTED")
      .map((c) => ({ commentId: c.id, quote: c.quote!, color: c.status === "OPEN" ? "#FCE8D6" : T.successTint }));
    highlightQuotes(ref.current, quotes, onHighlightClick);
  }, [sanitized, comments, block.id]);

  function handleMouseUp() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !ref.current) return;
    const text = sel.toString().trim();
    if (!text) return;
    const range = sel.getRangeAt(0);
    if (!ref.current.contains(range.commonAncestorContainer)) return;
    const rect = range.getBoundingClientRect();
    onSelect({ blockId: block.id, quote: text, x: rect.left, y: rect.bottom + 8 });
  }

  return (
    <div id={`lms-block-${block.id}`}>
      <div ref={ref} className="rich-text-content" style={{ color: T.ink2 }} onMouseUp={handleMouseUp} />
      <TextAudioControls text={extractPlainText(block.text)} label="Ascultă acest fragment" />
      <BlockFeedback feedbackEnabled={feedbackEnabled} courseId={courseId} lessonId={lessonId} blockId={block.id} projectId={projectId} />
    </div>
  );
}

const BLOCK_TYPE_LABEL: Record<LessonBlock["type"], string> = { TEXT: "Text", IMAGE: "Imagine", VIDEO: "Video", QUIZ: "Test" };

export function blockTypeLabel(blocks: LessonBlock[], blockId: string): string {
  const block = blocks.find((b) => b.id === blockId);
  return block ? BLOCK_TYPE_LABEL[block.type] : "bloc șters";
}

// Vizualizare comentabilă "ca la Word" a conținutului real al unei lecții — folosită în
// tab-ul Colaborare, în loc de un simplu selector abstract "Bloc N (TIP)". Selectezi o
// secvență de text (TEXT) sau apeși "Comentează" pe o întrebare (QUIZ) ori pe un bloc
// media (IMAGE/VIDEO), și adaugi un comentariu ancorat exact la acel fragment.
export function CommentableLessonView({
  blocks,
  comments,
  onAddComment,
  feedbackEnabled,
  courseId,
  lessonId,
  projectId,
}: {
  blocks: LessonBlock[];
  comments: LmsCommentDto[];
  onAddComment: (blockId: string, body: string, quote?: string) => Promise<void>;
  feedbackEnabled?: boolean;
  courseId?: string;
  lessonId?: string;
  projectId?: string;
}) {
  const [anchor, setAnchor] = useState<PendingAnchor | null>(null);
  const [composerFor, setComposerFor] = useState<PendingAnchor | null>(null);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const uiRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleDocMouseDown(e: MouseEvent) {
      if (uiRef.current && uiRef.current.contains(e.target as Node)) return;
      setAnchor(null);
    }
    document.addEventListener("mousedown", handleDocMouseDown);
    return () => document.removeEventListener("mousedown", handleDocMouseDown);
  }, []);

  function handleHighlightClick(commentId: string) {
    document.getElementById(`lms-comment-${commentId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function countFor(blockId: string): number {
    return comments.filter((c) => c.blockId === blockId).length;
  }

  async function handleSubmit() {
    if (!composerFor || !body.trim()) return;
    setSubmitting(true);
    try {
      await onAddComment(composerFor.blockId, body.trim(), composerFor.quote);
      window.getSelection()?.removeAllRanges();
      setComposerFor(null);
      setAnchor(null);
      setBody("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {blocks.map((block) => {
          if (block.type === "TEXT") {
            return (
              <TextBlockWithComments
                key={block.id}
                block={block}
                comments={comments}
                onSelect={(a) => { setAnchor(a); setComposerFor(null); }}
                onHighlightClick={handleHighlightClick}
                feedbackEnabled={feedbackEnabled}
                courseId={courseId}
                lessonId={lessonId}
                projectId={projectId}
              />
            );
          }
          if (block.type === "IMAGE" || block.type === "VIDEO") {
            const isVideo = block.type === "VIDEO";
            const embed = isVideo ? toEmbeddableVideo(block.url) : null;
            const n = countFor(block.id);
            return (
              <figure key={block.id} id={`lms-block-${block.id}`} style={{ margin: 0 }}>
                {isVideo ? (
                  embed!.kind === "iframe" ? (
                    <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 12, overflow: "hidden" }}>
                      <iframe src={embed!.src} allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }} />
                    </div>
                  ) : (
                    <video src={embed!.src} controls style={{ maxWidth: "100%", borderRadius: 12 }} />
                  )
                ) : (
                  <img src={block.url} alt={block.caption || ""} style={{ maxWidth: "100%", borderRadius: 12 }} />
                )}
                {block.caption && <figcaption style={{ fontSize: 12, color: T.ink3, marginTop: 6 }}>{block.caption}</figcaption>}
                <button
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setComposerFor({ blockId: block.id, x: rect.left, y: rect.bottom + 8 });
                    setBody("");
                  }}
                  style={{ marginTop: 6, background: "none", border: "none", color: T.brand, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, padding: 0 }}
                >
                  <MessageSquarePlus size={13} /> Comentează acest bloc {n > 0 && `(${n})`}
                </button>
                <BlockFeedback feedbackEnabled={feedbackEnabled} courseId={courseId} lessonId={lessonId} blockId={block.id} projectId={projectId} />
              </figure>
            );
          }
          // QUIZ
          return (
            <div key={block.id} id={`lms-block-${block.id}`} style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, background: T.bgSoft }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.brand, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
                Test — scor minim {block.requiredScoreToUnlockNext}% pentru deblocare
              </div>
              {block.questions.map((q, qi) => {
                const matching = comments.filter((c) => c.blockId === block.id && c.quote === q.text);
                const highlightColor = highlightColorFor(matching);
                return (
                  <div
                    key={q.id}
                    id={`lms-quiz-question-${block.id}-${qi}`}
                    style={{ marginBottom: 10, padding: 8, borderRadius: 8, background: highlightColor || "transparent" }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>{qi + 1}. {q.text}</div>
                      <button
                        onClick={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          setComposerFor({ blockId: block.id, quote: q.text, x: rect.left, y: rect.bottom + 8 });
                          setBody("");
                        }}
                        style={{ background: "none", border: "none", color: T.brand, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, padding: 0, whiteSpace: "nowrap" }}
                      >
                        <MessageSquarePlus size={12} /> Comentează {matching.length > 0 && `(${matching.length})`}
                      </button>
                    </div>
                    {q.options.map((o, oi) => (
                      <label key={oi} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: T.ink2, marginBottom: 3 }}>
                        <input type="checkbox" disabled checked={correctIndexesOf(q).includes(oi)} readOnly /> {o}
                      </label>
                    ))}
                  </div>
                );
              })}
              <BlockFeedback feedbackEnabled={feedbackEnabled} courseId={courseId} lessonId={lessonId} blockId={block.id} projectId={projectId} />
            </div>
          );
        })}
        {blocks.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Lecția nu are încă niciun bloc de conținut.</p>}
      </div>

      <div ref={uiRef}>
        {anchor && !composerFor && (
          <button
            onClick={() => { setComposerFor(anchor); setBody(""); }}
            style={{
              position: "fixed", top: anchor.y, left: Math.min(anchor.x, window.innerWidth - 220), zIndex: 1000,
              display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 20,
              border: "none", background: T.brand, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
            }}
          >
            <MessageSquarePlus size={14} /> Comentează selecția
          </button>
        )}

        {composerFor && (
          <div style={{ position: "fixed", top: composerFor.y, left: Math.min(composerFor.x, window.innerWidth - 320), zIndex: 1000, width: 300 }}>
            <Card style={{ padding: 12, boxShadow: "0 8px 28px rgba(0,0,0,0.22)" }}>
              {composerFor.quote && (
                <div style={{ fontSize: 12, fontStyle: "italic", color: T.ink3, borderLeft: `3px solid ${T.brand}`, paddingLeft: 8, marginBottom: 8 }}>
                  „{truncate(composerFor.quote, 140)}”
                </div>
              )}
              <textarea
                autoFocus
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Comentariul tău..."
                style={{ width: "100%", minHeight: 60, marginBottom: 8, resize: "vertical" }}
              />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Button variant="ghost" style={{ fontSize: 12, padding: "5px 10px" }} onClick={() => { setComposerFor(null); setAnchor(null); }}>Anulează</Button>
                <Button
                  id="lms-comment-submit-btn"
                  style={{ fontSize: 12, padding: "5px 10px", opacity: submitting ? 0.6 : 1 }}
                  onClick={handleSubmit}
                  disabled={submitting || !body.trim()}
                >
                  {submitting ? "Se trimite..." : "Comentează"}
                </Button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
