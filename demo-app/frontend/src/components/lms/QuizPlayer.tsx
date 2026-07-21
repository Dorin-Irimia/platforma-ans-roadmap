import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { T } from "../../theme";
import { Button } from "../ui";
import { submitQuizAttempt, correctIndexesOf, LessonBlock } from "../../features/lms/api";

type QuizBlock = Extract<LessonBlock, { type: "QUIZ" }>;

// Parcurgere test cu feedback vizual imediat corect/greșit (pct. 15) — scorul e
// întotdeauna calculat server-side (vezi POST /lessons/:id/quiz-attempt), acest
// component doar trimite răspunsurile alese și afișează rezultatul primit. O întrebare
// poate avea mai multe opțiuni corecte (checkbox) — punctajul cere setul EXACT, fără
// punctaj parțial pentru un subset corect.
export function QuizPlayer({ lessonId, quiz, onSubmitted }: { lessonId: string; quiz: QuizBlock; onSubmitted: (passed: boolean) => void }) {
  const [answers, setAnswers] = useState<Record<string, number[]>>({});
  const [result, setResult] = useState<{ score: number; passed: boolean; correctCount: number; totalCount: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleOption(questionId: string, oi: number) {
    const current = answers[questionId] || [];
    const next = current.includes(oi) ? current.filter((i) => i !== oi) : [...current, oi];
    setAnswers({ ...answers, [questionId]: next });
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await submitQuizAttempt(lessonId, answers);
      setResult(res);
      onSubmitted(res.passed);
    } finally {
      setSubmitting(false);
    }
  }

  const allAnswered = quiz.questions.every((q) => (answers[q.id] || []).length > 0);

  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 18, background: T.bgSoft }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.brand, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 14 }}>
        Test — scor minim {quiz.requiredScoreToUnlockNext}% pentru a continua
      </div>
      {quiz.questions.map((q, qi) => (
        <div key={q.id} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{qi + 1}. {q.text}</div>
          {q.options.map((o, oi) => {
            const isSelected = (answers[q.id] || []).includes(oi);
            const showFeedback = !!result;
            const isCorrect = correctIndexesOf(q).includes(oi);
            let color = T.ink2;
            if (showFeedback && isSelected) color = isCorrect ? T.success : T.danger;
            else if (showFeedback && isCorrect) color = T.success;
            return (
              <label
                key={oi}
                id={qi === 0 && oi === 0 ? "lms-quiz-option" : undefined}
                style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13.5, marginBottom: 4, color }}
              >
                <input
                  type="checkbox"
                  disabled={!!result}
                  checked={isSelected}
                  onChange={() => toggleOption(q.id, oi)}
                />
                {o}
                {showFeedback && (isSelected || isCorrect) && (isCorrect ? <CheckCircle2 size={14} /> : <XCircle size={14} />)}
              </label>
            );
          })}
        </div>
      ))}

      {!result ? (
        <Button id="lms-quiz-submit-btn" onClick={handleSubmit} style={{ opacity: allAnswered && !submitting ? 1 : 0.6 }}>
          {submitting ? "Se trimite..." : "Trimite răspunsurile"}
        </Button>
      ) : (
        <div id="lms-quiz-result-banner" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: result.passed ? T.success : T.danger }}>
            Scor: {result.score}% ({result.correctCount}/{result.totalCount} corecte)
          </span>
          <span style={{ fontSize: 13, color: T.ink3 }}>{result.passed ? "Ai deblocat lecția următoare." : "Nu ai atins scorul minim — poți încerca din nou."}</span>
        </div>
      )}
    </div>
  );
}
