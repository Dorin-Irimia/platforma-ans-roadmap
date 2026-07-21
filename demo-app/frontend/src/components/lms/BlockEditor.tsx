import { useRef, useState } from "react";
import { Trash2, Volume2, Wand2 } from "lucide-react";
import { T } from "../../theme";
import { Button, FieldLabel } from "../ui";
import { LessonBlock, LmsQuizQuestion, rewriteText } from "../../features/lms/api";
import { speakText, isSpeechSynthesisSupported } from "../../features/chatbot/speech";

const REWRITE_ACTIONS: { key: "REWRITE" | "ADAPT" | "EXPAND" | "SUMMARIZE"; label: string }[] = [
  { key: "REWRITE", label: "Rescrie" },
  { key: "ADAPT", label: "Adaptează" },
  { key: "EXPAND", label: "Extinde" },
  { key: "SUMMARIZE", label: "Rezumă" },
];

function TextBlockEditor({ block, onChange }: { block: Extract<LessonBlock, { type: "TEXT" }>; onChange: (b: LessonBlock) => void }) {
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSelect() {
    const el = textareaRef.current;
    if (!el || el.selectionStart === el.selectionEnd) {
      setSelection(null);
      return;
    }
    setSelection({ start: el.selectionStart, end: el.selectionEnd });
  }

  async function handleRewrite(instruction: "REWRITE" | "ADAPT" | "EXPAND" | "SUMMARIZE") {
    if (!selection) return;
    const selectedText = block.text.slice(selection.start, selection.end);
    setBusy(true);
    try {
      const result = await rewriteText(selectedText, instruction);
      const next = block.text.slice(0, selection.start) + result + block.text.slice(selection.end);
      onChange({ ...block, text: next });
      setSelection(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {selection && (
        <div id="lms-editor-rewrite-buttons" style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
          <Wand2 size={14} color={T.brand} style={{ marginTop: 6 }} />
          {REWRITE_ACTIONS.map((a) => (
            <button
              key={a.key}
              disabled={busy}
              onClick={() => handleRewrite(a.key)}
              style={{ fontSize: 11.5, fontWeight: 700, padding: "5px 10px", borderRadius: 8, border: `1px solid ${T.brand}`, background: T.brandTint, color: T.brandDark, cursor: "pointer" }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={block.text}
        onChange={(e) => onChange({ ...block, text: e.target.value })}
        onMouseUp={handleSelect}
        onKeyUp={handleSelect}
        style={{ width: "100%", minHeight: 140 }}
        placeholder="Scrie conținutul lecției — selectează text pentru a-l rescrie/adapta/extinde/rezuma cu AI."
      />
      {isSpeechSynthesisSupported() && (
        <button
          id="lms-editor-tts-link"
          onClick={() => speakText(block.text)}
          style={{ marginTop: 6, background: "none", border: "none", color: T.ink3, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}
        >
          <Volume2 size={13} /> Ascultă (Text-to-Speech)
        </button>
      )}
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
    onChange({ ...block, questions: [...block.questions, { id: crypto.randomUUID(), text: "", options: ["Opțiune 1", "Opțiune 2"], correctIndex: 0 }] });
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
          {q.options.map((o, oi) => (
            <div key={oi} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
              <input type="radio" checked={q.correctIndex === oi} onChange={() => updateQuestion(qi, { correctIndex: oi })} />
              <input
                value={o}
                onChange={(e) => updateQuestion(qi, { options: q.options.map((op, i) => (i === oi ? e.target.value : op)) })}
                style={{ flex: 1 }}
              />
              <Button variant="ghost" style={{ padding: "4px 8px", fontSize: 11 }} onClick={() => updateQuestion(qi, { options: q.options.filter((_, i) => i !== oi) })}>✕</Button>
            </div>
          ))}
          <Button variant="ghost" style={{ fontSize: 11.5, padding: "4px 10px" }} onClick={() => updateQuestion(qi, { options: [...q.options, `Opțiune ${q.options.length + 1}`] })}>+ Opțiune</Button>
        </div>
      ))}
      <Button variant="ghost" onClick={addQuestion}>+ Întrebare</Button>
    </div>
  );
}

export function BlockEditor({ block, onChange, onRemove }: { block: LessonBlock; onChange: (b: LessonBlock) => void; onRemove: () => void }) {
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, position: "relative" }}>
      <div style={{ position: "absolute", top: 10, right: 10 }}>
        <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: T.ink4 }}>
          <Trash2 size={14} />
        </button>
      </div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>{block.type}</div>

      {block.type === "TEXT" && <TextBlockEditor block={block} onChange={onChange} />}
      {(block.type === "IMAGE" || block.type === "VIDEO") && (
        <div>
          <FieldLabel>URL {block.type === "IMAGE" ? "imagine" : "video"}</FieldLabel>
          <input value={block.url} onChange={(e) => onChange({ ...block, url: e.target.value })} style={{ width: "100%", marginBottom: 10 }} placeholder="https://..." />
          <FieldLabel>Descriere (opțional)</FieldLabel>
          <input value={block.caption || ""} onChange={(e) => onChange({ ...block, caption: e.target.value })} style={{ width: "100%" }} />
        </div>
      )}
      {block.type === "QUIZ" && <QuizBlockEditor block={block} onChange={onChange} />}
    </div>
  );
}
