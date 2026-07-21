import DOMPurify from "dompurify";
import { T } from "../../theme";
import { LessonBlock, correctIndexesOf } from "../../features/lms/api";

// Randare read-only a blocurilor unei lecții — folosită atât în previzualizarea din
// editor (fără interacțiune), cât și ca bază vizuală pentru player (care adaugă
// interactivitate doar peste blocul QUIZ, vezi QuizPlayer.tsx).
export function LessonBlocksView({ blocks }: { blocks: LessonBlock[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {blocks.map((block) => {
        if (block.type === "TEXT") {
          // `block.text` e HTML scris cu editorul TipTap (posibil de un alt autor/co-autor) —
          // sanitizare obligatorie înainte de `dangerouslySetInnerHTML` (risc XSS stocat altfel).
          return (
            <div
              key={block.id}
              className="rich-text-content"
              style={{ color: T.ink2 }}
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.text) }}
            />
          );
        }
        if (block.type === "IMAGE") {
          return (
            <figure key={block.id} style={{ margin: 0 }}>
              <img src={block.url} alt={block.caption || ""} style={{ maxWidth: "100%", borderRadius: 12 }} />
              {block.caption && <figcaption style={{ fontSize: 12, color: T.ink3, marginTop: 6 }}>{block.caption}</figcaption>}
            </figure>
          );
        }
        if (block.type === "VIDEO") {
          return (
            <figure key={block.id} style={{ margin: 0 }}>
              <video src={block.url} controls style={{ maxWidth: "100%", borderRadius: 12 }} />
              {block.caption && <figcaption style={{ fontSize: 12, color: T.ink3, marginTop: 6 }}>{block.caption}</figcaption>}
            </figure>
          );
        }
        // QUIZ — previzualizare statică (fără interacțiune reală, doar structura întrebărilor)
        return (
          <div key={block.id} style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 16, background: T.bgSoft }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.brand, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>
              Test — scor minim {block.requiredScoreToUnlockNext}% pentru deblocare
            </div>
            {block.questions.map((q, qi) => (
              <div key={q.id} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 6 }}>{qi + 1}. {q.text}</div>
                {q.options.map((o, oi) => (
                  <label key={oi} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: T.ink2, marginBottom: 3 }}>
                    <input type="checkbox" disabled checked={correctIndexesOf(q).includes(oi)} readOnly /> {o}
                  </label>
                ))}
              </div>
            ))}
          </div>
        );
      })}
      {blocks.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Lecția nu are încă niciun bloc de conținut.</p>}
    </div>
  );
}
