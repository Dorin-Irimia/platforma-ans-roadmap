import { ReactNode, useState, ChangeEvent } from "react";
import { useEditor, EditorContent, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import {
  Trash2,
  Volume2,
  Square,
  Wand2,
  Check,
  RotateCcw,
  RefreshCw,
  Loader2,
  Bold as BoldIcon,
  Italic as ItalicIcon,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Table2,
  Rows3,
  Columns3,
  Trash,
  Undo2,
  Redo2,
  Upload,
} from "lucide-react";
import { diffWords } from "diff";
import { T } from "../../theme";
import { Button, FieldLabel } from "../ui";
import { LessonBlock, LmsQuizQuestion, correctIndexesOf, rewriteText, uploadLmsMedia, lmsMediaUrl } from "../../features/lms/api";
import { generateId } from "../../lib/id";
import { toEmbeddableVideo } from "./LessonBlocksView";
import { speakText, stopSpeech, isSpeechSynthesisSupported } from "../../features/chatbot/speech";

const REWRITE_ACTIONS: { key: "REWRITE" | "ADAPT" | "EXPAND" | "SUMMARIZE"; label: string }[] = [
  { key: "REWRITE", label: "Rescrie" },
  { key: "ADAPT", label: "Adaptează" },
  { key: "EXPAND", label: "Extinde" },
  { key: "SUMMARIZE", label: "Rezumă" },
];

interface PendingSuggestion {
  instruction: "REWRITE" | "ADAPT" | "EXPAND" | "SUMMARIZE";
  start: number;
  end: number;
  original: string;
  result: string;
  // Context — restul lecției din jurul selecției, ca utilizatorul să vadă UNDE se aplică
  // modificarea (trunchiat pentru afișare); trimis integral la AI ca să nu interpreteze
  // greșit o selecție scurtă/ambiguă drept "nu mi s-a dat niciun text".
  before: string;
  after: string;
}

const CONTEXT_PREVIEW_CHARS = 100;

function truncateStart(s: string, max: number): string {
  return s.length > max ? `…${s.slice(s.length - max)}` : s;
}

function truncateEnd(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Textul AI (rewriteText) vine ca text simplu, cu paragrafe separate prin linii goale —
// nu ca HTML. `insertContentAt` cu un string simplu bagă acele "\n\n" ca text literal
// într-un singur nod <p>, nu ca paragrafe reale (spre deosebire de Enter apăsat manual,
// care creează noduri <p> separate în TipTap) — la reîncărcare, whitespace-ul normal HTML
// se colapsează și spațierea dispare. Dar înfășurarea în <p> forțează ProseMirror să
// despartă paragraful existent în care se inserează (before/inserted/after), ceea ce
// adaugă un rând gol înainte și după chiar și când textul are un singur paragraf — exact
// ce nu-și dorește utilizatorul. De aceea folosim <p> DOAR când textul chiar are mai multe
// paragrafe (spațiere interioară reală); un singur paragraf se inserează inline, ca text
// simplu, fără să forțeze nicio despărțire de paragraf la început/sfârșit.
function textToHtml(text: string): string {
  const paragraphs = text
    .trim()
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length <= 1) {
    return escapeHtml(paragraphs[0] || "").replace(/\n/g, "<br>");
  }
  return paragraphs.map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`).join("");
}

function ToolbarButton({ active, disabled, onClick, title, children }: { active?: boolean; disabled?: boolean; onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 28,
        height: 28,
        border: "none",
        borderRadius: 6,
        background: active ? T.brand : "transparent",
        color: active ? "#fff" : disabled ? T.ink4 : T.ink2,
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function EditorToolbar({ editor }: { editor: Editor }) {
  const inTable = editor.isActive("table");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap", padding: "4px 4px 8px", borderBottom: `1px solid ${T.line}`, marginBottom: 8 }}>
      <ToolbarButton title="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}><BoldIcon size={14} /></ToolbarButton>
      <ToolbarButton title="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}><ItalicIcon size={14} /></ToolbarButton>
      <ToolbarButton title="Subliniat" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon size={14} /></ToolbarButton>
      <div style={{ width: 1, height: 18, background: T.line, margin: "0 4px" }} />
      <ToolbarButton title="Titlu 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 size={14} /></ToolbarButton>
      <ToolbarButton title="Titlu 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 size={14} /></ToolbarButton>
      <ToolbarButton title="Titlu 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 size={14} /></ToolbarButton>
      <div style={{ width: 1, height: 18, background: T.line, margin: "0 4px" }} />
      <ToolbarButton title="Listă cu buline" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}><List size={14} /></ToolbarButton>
      <ToolbarButton title="Listă numerotată" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered size={14} /></ToolbarButton>
      <div style={{ width: 1, height: 18, background: T.line, margin: "0 4px" }} />
      <ToolbarButton title="Inserează tabel" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><Table2 size={14} /></ToolbarButton>
      {inTable && (
        <>
          <ToolbarButton title="Adaugă rând" onClick={() => editor.chain().focus().addRowAfter().run()}><Rows3 size={14} /></ToolbarButton>
          <ToolbarButton title="Adaugă coloană" onClick={() => editor.chain().focus().addColumnAfter().run()}><Columns3 size={14} /></ToolbarButton>
          <ToolbarButton title="Șterge rândul" onClick={() => editor.chain().focus().deleteRow().run()}><Rows3 size={14} style={{ opacity: 0.5 }} /></ToolbarButton>
          <ToolbarButton title="Șterge coloana" onClick={() => editor.chain().focus().deleteColumn().run()}><Columns3 size={14} style={{ opacity: 0.5 }} /></ToolbarButton>
          <ToolbarButton title="Șterge tabelul" onClick={() => editor.chain().focus().deleteTable().run()}><Trash size={14} /></ToolbarButton>
        </>
      )}
      <div style={{ width: 1, height: 18, background: T.line, margin: "0 4px" }} />
      <ToolbarButton title="Anulează" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}><Undo2 size={14} /></ToolbarButton>
      <ToolbarButton title="Refă" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}><Redo2 size={14} /></ToolbarButton>
    </div>
  );
}

function TextBlockEditor({ block, onChange }: { block: Extract<LessonBlock, { type: "TEXT" }>; onChange: (b: LessonBlock) => void }) {
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [busy, setBusy] = useState(false);
  // Sugestia AI nu se aplică direct pe `block.text` — rămâne "în așteptare" până
  // utilizatorul apasă Acceptă/Anulează/Încearcă din nou, cu un diff cuvânt-cu-cuvânt
  // afișat între textul original și cel propus (portocaliu = adăugat, tăiat = șters).
  const [pending, setPending] = useState<PendingSuggestion | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const editor = useEditor({
    extensions: [StarterKit, Underline, Table.configure({ resizable: true }), TableRow, TableHeader, TableCell],
    content: block.text,
    onUpdate: ({ editor }) => onChange({ ...block, text: editor.getHTML() }),
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection;
      setSelection(from === to ? null : { start: from, end: to });
    },
  });

  function handleToggleSpeech() {
    if (isSpeaking) {
      stopSpeech();
      setIsSpeaking(false);
      return;
    }
    setIsSpeaking(true);
    speakText(editor?.getText() || "", () => setIsSpeaking(false));
  }

  async function runRewrite(instruction: PendingSuggestion["instruction"], start: number, end: number, original: string, before: string, after: string) {
    setBusy(true);
    try {
      // Contextul complet e trimis la AI ca să nu interpreteze greșit o selecție scurtă/
      // ambiguă (ex. un singur cuvânt) drept "nu mi s-a dat niciun text de rescris".
      const result = await rewriteText(original, instruction, editor?.getText());
      setPending({ instruction, start, end, original, result, before, after });
    } finally {
      setBusy(false);
    }
  }

  function handleRewrite(instruction: PendingSuggestion["instruction"]) {
    if (!selection || !editor) return;
    const selectedText = editor.state.doc.textBetween(selection.start, selection.end, " ");
    const before = truncateStart(editor.state.doc.textBetween(0, selection.start, " "), CONTEXT_PREVIEW_CHARS);
    const after = truncateEnd(editor.state.doc.textBetween(selection.end, editor.state.doc.content.size, " "), CONTEXT_PREVIEW_CHARS);
    runRewrite(instruction, selection.start, selection.end, selectedText, before, after);
  }

  function handleAccept() {
    if (!pending || !editor) return;
    editor.chain().focus().insertContentAt({ from: pending.start, to: pending.end }, textToHtml(pending.result)).run();
    setPending(null);
    setSelection(null);
  }

  function handleReject() {
    setPending(null);
    setSelection(null);
  }

  function handleRetry() {
    if (!pending) return;
    runRewrite(pending.instruction, pending.start, pending.end, pending.original, pending.before, pending.after);
  }

  const diffParts = pending ? diffWords(pending.original, pending.result) : null;

  if (!editor) return null;

  return (
    <div>
      {selection && !pending && (
        <div id="lms-editor-rewrite-buttons" style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          {busy ? (
            <>
              <Loader2 size={14} color={T.brand} className="spin" />
              <span style={{ fontSize: 12, fontWeight: 700, color: T.brandDark }}>Se generează sugestia AI...</span>
            </>
          ) : (
            <>
              <Wand2 size={14} color={T.brand} style={{ marginTop: 6 }} />
              {REWRITE_ACTIONS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => handleRewrite(a.key)}
                  style={{ fontSize: 11.5, fontWeight: 700, padding: "5px 10px", borderRadius: 8, border: `1px solid ${T.brand}`, background: T.brandTint, color: T.brandDark, cursor: "pointer" }}
                >
                  {a.label}
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {pending ? (
        <div style={{ border: `1.5px solid ${T.brand}`, borderRadius: 10, padding: 12, marginBottom: 10, background: T.brandTint }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.brandDark, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Wand2 size={13} /> Sugestie AI — {REWRITE_ACTIONS.find((a) => a.key === pending.instruction)?.label}
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-wrap", background: T.card, borderRadius: 8, padding: 12, marginBottom: 10, border: `1px solid ${T.line}` }}>
            {/* Context — restul lecției din jurul selecției, ca să se vadă UNDE se aplică
                modificarea, nu doar fragmentul izolat. */}
            {pending.before && <span style={{ color: T.ink4 }}>{pending.before}</span>}
            {diffParts!.map((part, i) =>
              part.removed ? (
                <span key={i} style={{ color: T.ink4, textDecoration: "line-through" }}>{part.value}</span>
              ) : part.added ? (
                <span key={i} style={{ background: "#FCD9CB", color: T.brandDark, fontWeight: 700, borderRadius: 3, padding: "1px 2px" }}>{part.value}</span>
              ) : (
                <span key={i}>{part.value}</span>
              )
            )}
            {pending.after && <span style={{ color: T.ink4 }}>{pending.after}</span>}
          </div>
          {busy && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: T.brandDark, fontWeight: 700, marginBottom: 8 }}>
              <Loader2 size={13} className="spin" /> Se generează o variantă nouă...
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 5, opacity: busy ? 0.6 : 1 }} onClick={handleAccept} disabled={busy}>
              <Check size={13} /> Acceptă
            </Button>
            <Button variant="ghost" style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }} onClick={handleReject} disabled={busy}>
              <RotateCcw size={13} /> Anulează
            </Button>
            <Button variant="ghost" style={{ padding: "6px 12px", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }} onClick={handleRetry} disabled={busy}>
              <RefreshCw size={13} /> Încearcă din nou
            </Button>
          </div>
        </div>
      ) : (
        <div className="tiptap-editor-shell rich-text-content">
          <EditorToolbar editor={editor} />
          <EditorContent editor={editor} />
        </div>
      )}

      {isSpeechSynthesisSupported() && !pending && (
        <button
          id="lms-editor-tts-link"
          onClick={handleToggleSpeech}
          style={{ marginTop: 6, background: "none", border: "none", color: isSpeaking ? T.brand : T.ink3, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: isSpeaking ? 700 : 400 }}
        >
          {isSpeaking ? <Square size={12} fill={T.brand} /> : <Volume2 size={13} />}
          {isSpeaking ? "Oprește" : "Ascultă (Text-to-Speech)"}
        </button>
      )}
    </div>
  );
}

// Încărcare directă de pe calculator (imagine/video) — trimite fișierul la
// /api/lms/media (media.routes.ts), primește un id și construiește URL-ul public de
// afișare (lmsMediaUrl). Câmpul URL manual rămâne disponibil în paralel, pentru
// cine vrea să lege o resursă externă în loc să încarce un fișier nou.
function MediaBlockEditor({ block, onChange }: { block: Extract<LessonBlock, { type: "IMAGE" | "VIDEO" }>; onChange: (b: LessonBlock) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isImage = block.type === "IMAGE";

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const result = await uploadLmsMedia(file);
      onChange({ ...block, url: lmsMediaUrl(result.id) });
    } catch (err: any) {
      setError(err?.response?.data?.error || "Încărcarea a eșuat");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <FieldLabel>{isImage ? "Imagine" : "Video"}</FieldLabel>
      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 12px",
          borderRadius: 8,
          border: `1px solid ${T.line}`,
          background: T.line2,
          fontSize: 12.5,
          fontWeight: 600,
          cursor: uploading ? "default" : "pointer",
          color: T.ink2,
          marginBottom: 8,
        }}
      >
        {uploading ? <Loader2 size={13} className="spin" /> : <Upload size={13} />}
        {uploading ? "Se încarcă..." : `Încarcă ${isImage ? "o imagine" : "un clip video"} de pe calculator`}
        <input type="file" accept={isImage ? "image/*" : "video/*"} onChange={handleFile} disabled={uploading} style={{ display: "none" }} />
      </label>
      {error && <p style={{ color: T.danger, fontSize: 12, marginTop: 0, marginBottom: 8 }}>{error}</p>}
      <FieldLabel>sau URL {isImage ? "imagine" : "video"}</FieldLabel>
      <input value={block.url} onChange={(e) => onChange({ ...block, url: e.target.value })} style={{ width: "100%", marginBottom: 10 }} placeholder="https://..." />
      {block.url && (isImage ? (
        <img src={block.url} alt="" style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 8, marginBottom: 10, display: "block" }} />
      ) : (() => {
        const embed = toEmbeddableVideo(block.url);
        return embed.kind === "iframe" ? (
          <iframe
            src={embed.src}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ width: "100%", maxWidth: 320, height: 180, border: "none", borderRadius: 8, marginBottom: 10, display: "block" }}
          />
        ) : (
          <video src={embed.src} controls style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 8, marginBottom: 10, display: "block" }} />
        );
      })())}
      <FieldLabel>Descriere (opțional)</FieldLabel>
      <input value={block.caption || ""} onChange={(e) => onChange({ ...block, caption: e.target.value })} style={{ width: "100%" }} />
    </div>
  );
}

function QuizBlockEditor({ block, onChange }: { block: Extract<LessonBlock, { type: "QUIZ" }>; onChange: (b: LessonBlock) => void }) {
  function updateQuestion(idx: number, patch: Partial<LmsQuizQuestion>) {
    const questions = [...block.questions];
    questions[idx] = { ...questions[idx], ...patch };
    onChange({ ...block, questions });
  }

  function addQuestion() {
    onChange({ ...block, questions: [...block.questions, { id: generateId(), text: "", options: ["Opțiune 1", "Opțiune 2"], correctIndexes: [0] }] });
  }

  function toggleCorrect(qi: number, oi: number) {
    const current = correctIndexesOf(block.questions[qi]);
    const next = current.includes(oi) ? current.filter((i) => i !== oi) : [...current, oi].sort((a, b) => a - b);
    updateQuestion(qi, { correctIndexes: next });
  }

  function removeOption(qi: number, oi: number) {
    const q = block.questions[qi];
    const options = q.options.filter((_, i) => i !== oi);
    const correctIndexes = correctIndexesOf(q).filter((i) => i !== oi).map((i) => (i > oi ? i - 1 : i));
    updateQuestion(qi, { options, correctIndexes });
  }

  return (
    <div>
      <FieldLabel>Scor minim pentru deblocarea lecției următoare (%)</FieldLabel>
      <input
        type="number"
        min={0}
        max={100}
        value={block.requiredScoreToUnlockNext}
        onChange={(e) => onChange({ ...block, requiredScoreToUnlockNext: Number(e.target.value) })}
        style={{ width: 100, marginBottom: 14 }}
      />
      {block.questions.map((q, qi) => (
        <div key={q.id} style={{ padding: 12, background: T.line2, borderRadius: 10, marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={q.text} onChange={(e) => updateQuestion(qi, { text: e.target.value })} placeholder="Textul întrebării" style={{ flex: 1 }} />
            <Button variant="danger" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => onChange({ ...block, questions: block.questions.filter((_, i) => i !== qi) })}>✕</Button>
          </div>
          <div style={{ fontSize: 11, color: T.ink3, marginBottom: 6 }}>Bifează una sau mai multe opțiuni corecte</div>
          {q.options.map((o, oi) => (
            <div key={oi} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
              <input type="checkbox" checked={correctIndexesOf(q).includes(oi)} onChange={() => toggleCorrect(qi, oi)} />
              <input
                value={o}
                onChange={(e) => updateQuestion(qi, { options: q.options.map((op, i) => (i === oi ? e.target.value : op)) })}
                style={{ flex: 1 }}
              />
              <Button variant="ghost" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => removeOption(qi, oi)}>✕</Button>
            </div>
          ))}
          <Button variant="ghost" style={{ fontSize: 11.5, padding: "4px 10px" }} onClick={() => updateQuestion(qi, { options: [...q.options, `Opțiune ${q.options.length + 1}`] })}>+ Opțiune</Button>
        </div>
      ))}
      <Button variant="ghost" onClick={addQuestion}>+ Întrebare</Button>
    </div>
  );
}

export function BlockEditor({ block, onChange, onRemove, dragHandle }: { block: LessonBlock; onChange: (b: LessonBlock) => void; onRemove: () => void; dragHandle?: ReactNode }) {
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, position: "relative" }}>
      <div style={{ position: "absolute", top: 10, right: 10 }}>
        <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: T.ink4 }}>
          <Trash2 size={14} />
        </button>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        {dragHandle}
        <div style={{ fontSize: 10.5, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: 0.5 }}>{block.type}</div>
      </div>

      {block.type === "TEXT" && <TextBlockEditor block={block} onChange={onChange} />}
      {(block.type === "IMAGE" || block.type === "VIDEO") && <MediaBlockEditor block={block} onChange={onChange} />}
      {block.type === "QUIZ" && <QuizBlockEditor block={block} onChange={onChange} />}
    </div>
  );
}
