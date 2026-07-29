import { useState } from "react";
import DOMPurify from "dompurify";
import { Volume2, Square, Download } from "lucide-react";
import { T } from "../../theme";
import { LessonBlock, correctIndexesOf, downloadLessonAudio } from "../../features/lms/api";
import { speakText, stopSpeech, isSpeechSynthesisSupported } from "../../features/chatbot/speech";
import { useToast } from "../ToastProvider";
import { getVoiceRate } from "../AccessibilityMenu";
import { FeedbackWidget } from "./FeedbackWidget";

// HTML-ul unui bloc TEXT (scris cu TipTap) redus la text simplu — necesar pentru
// Text-to-Speech (Web Speech API și fișierul .wav generat server-side), care nu pot
// "citi" marcaj HTML. Sanitizăm înainte de a seta innerHTML pe un div nefolosit ca DOM
// real (nu ajunge niciodată pe pagină), doar ca să extragem textContent din el.
export function extractPlainText(html: string): string {
  if (typeof document === "undefined") return "";
  const div = document.createElement("div");
  div.innerHTML = DOMPurify.sanitize(html);
  return div.textContent || "";
}

// Ascultă (Web Speech API, live, gratuit) + Descarcă audio (.wav generat server-side,
// espeak-ng) — pentru orice fragment de text: un singur bloc TEXT sau lecția întreagă
// concatenată (vezi apelurile din LmsCoursePlayerPage.tsx). Cerință: cursantul trebuie
// să poată asculta/descărca atât lecția completă, cât și fiecare fragment în parte.
export function TextAudioControls({ text, label = "Ascultă" }: { text: string; label?: string }) {
  const toast = useToast();
  const [speaking, setSpeaking] = useState(false);
  const [downloading, setDownloading] = useState(false);

  function handleToggleSpeech() {
    if (speaking) {
      stopSpeech();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speakText(text, () => setSpeaking(false), getVoiceRate());
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadLessonAudio(text, getVoiceRate());
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Generarea fișierului audio a eșuat");
    } finally {
      setDownloading(false);
    }
  }

  if (!text.trim()) return null;

  return (
    <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
      {isSpeechSynthesisSupported() && (
        <button
          onClick={handleToggleSpeech}
          style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: speaking ? T.brand : T.ink3, fontSize: 12, fontWeight: 600, padding: 0 }}
        >
          {speaking ? <Square size={12} fill={T.brand} /> : <Volume2 size={13} />}
          {speaking ? "Oprește" : label}
        </button>
      )}
      <button
        onClick={handleDownload}
        disabled={downloading}
        style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: downloading ? "default" : "pointer", color: T.ink3, fontSize: 12, fontWeight: 600, padding: 0, opacity: downloading ? 0.6 : 1 }}
      >
        <Download size={13} />
        {downloading ? "Se generează..." : "Descarcă audio"}
      </button>
    </div>
  );
}

// URL-urile video reale, în practică, aproape niciodată nu sunt fișiere media directe
// (.mp4 etc.) — sunt linkuri către YouTube/Vimeo. Un <video src="..."> nu poate reda o
// pagină YouTube (nu e un fișier media, ci un document HTML) — rezultatul e un player gol,
// blocat la 0:00, exact ce a raportat un cursant. Detectăm aceste linkuri și le randăm
// într-un <iframe> către URL-ul de embed corespunzător; orice alt URL rămâne <video> normal.
export function toEmbeddableVideo(url: string): { kind: "iframe" | "video"; src: string } {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  if (yt) return { kind: "iframe", src: `https://www.youtube.com/embed/${yt[1]}` };
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) return { kind: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  return { kind: "video", src: url };
}

// Evaluare per element ("fiecare element adăugat în lecție") — randată sub bloc, doar când
// cursul are evaluarea activată (LmsCourse.feedbackEnabled) ȘI blocul aparține unei lecții
// deja salvate (courseId/lessonId lipsesc în previzualizarea din editor, pe un draft încă
// nesalvat — acolo evaluarea nu are sens).
export function BlockFeedback({ feedbackEnabled, courseId, lessonId, blockId, projectId }: { feedbackEnabled?: boolean; courseId?: string; lessonId?: string; blockId: string; projectId?: string }) {
  if (!feedbackEnabled || !courseId || !lessonId) return null;
  return <FeedbackWidget courseId={courseId} scope="BLOCK" lessonId={lessonId} blockId={blockId} projectId={projectId} label="Evaluează acest element" />;
}

// Randare read-only a blocurilor unei lecții — folosită atât în previzualizarea din
// editor (fără interacțiune), cât și ca bază vizuală pentru player (care adaugă
// interactivitate doar peste blocul QUIZ, vezi QuizPlayer.tsx).
export function LessonBlocksView({ blocks, feedbackEnabled, courseId, lessonId, projectId }: { blocks: LessonBlock[]; feedbackEnabled?: boolean; courseId?: string; lessonId?: string; projectId?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {blocks.map((block) => {
        if (block.type === "TEXT") {
          // `block.text` e HTML scris cu editorul TipTap (posibil de un alt autor/co-autor) —
          // sanitizare obligatorie înainte de `dangerouslySetInnerHTML` (risc XSS stocat altfel).
          return (
            <div key={block.id}>
              <div
                className="rich-text-content"
                style={{ color: T.ink2 }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(block.text) }}
              />
              <TextAudioControls text={extractPlainText(block.text)} label="Ascultă acest fragment" />
              <BlockFeedback feedbackEnabled={feedbackEnabled} courseId={courseId} lessonId={lessonId} blockId={block.id} projectId={projectId} />
            </div>
          );
        }
        if (block.type === "IMAGE") {
          return (
            <figure key={block.id} style={{ margin: 0 }}>
              <img src={block.url} alt={block.caption || ""} style={{ maxWidth: "100%", borderRadius: 12 }} />
              {block.caption && <figcaption style={{ fontSize: 12, color: T.ink3, marginTop: 6 }}>{block.caption}</figcaption>}
              <BlockFeedback feedbackEnabled={feedbackEnabled} courseId={courseId} lessonId={lessonId} blockId={block.id} projectId={projectId} />
            </figure>
          );
        }
        if (block.type === "VIDEO") {
          const embed = toEmbeddableVideo(block.url);
          return (
            <figure key={block.id} style={{ margin: 0 }}>
              {embed.kind === "iframe" ? (
                <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 12, overflow: "hidden" }}>
                  <iframe
                    src={embed.src}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                  />
                </div>
              ) : (
                <video src={embed.src} controls style={{ maxWidth: "100%", borderRadius: 12 }} />
              )}
              {block.caption && <figcaption style={{ fontSize: 12, color: T.ink3, marginTop: 6 }}>{block.caption}</figcaption>}
              <BlockFeedback feedbackEnabled={feedbackEnabled} courseId={courseId} lessonId={lessonId} blockId={block.id} projectId={projectId} />
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
            <BlockFeedback feedbackEnabled={feedbackEnabled} courseId={courseId} lessonId={lessonId} blockId={block.id} projectId={projectId} />
          </div>
        );
      })}
      {blocks.length === 0 && <p style={{ color: T.ink3, fontSize: 13 }}>Lecția nu are încă niciun bloc de conținut.</p>}
    </div>
  );
}
