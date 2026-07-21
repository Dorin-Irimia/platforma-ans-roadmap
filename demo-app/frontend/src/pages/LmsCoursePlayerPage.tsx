import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Lock, Mic, Volume2, Download, Send, Award } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Card, Button } from "../components/ui";
import { T } from "../theme";
import {
  fetchCourse,
  fetchLessons,
  fetchLessonAccess,
  fetchEnrollment,
  updateProgress,
  askLesson,
  fetchMyCertificates,
  downloadCertificate,
  downloadLessonAudio,
  LmsCourseSummary,
  LmsLessonDto,
  LessonAccessDto,
  LmsCertificateDto,
} from "../features/lms/api";
import { LessonBlocksView } from "../components/lms/LessonBlocksView";
import { QuizPlayer } from "../components/lms/QuizPlayer";
import { isSpeechRecognitionSupported, startSpeechRecognition, isSpeechSynthesisSupported, speakText } from "../features/chatbot/speech";

export default function LmsCoursePlayerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [course, setCourse] = useState<LmsCourseSummary | null>(null);
  const [lessons, setLessons] = useState<LmsLessonDto[]>([]);
  const [access, setAccess] = useState<LessonAccessDto[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [certificate, setCertificate] = useState<LmsCertificateDto | null>(null);
  const [downloadingAudio, setDownloadingAudio] = useState(false);

  async function handleDownloadAudio(text: string) {
    setDownloadingAudio(true);
    try {
      await downloadLessonAudio(text);
    } finally {
      setDownloadingAudio(false);
    }
  }

  function loadAccess() {
    if (id) fetchLessonAccess(id).then(setAccess).catch(() => setAccess([]));
  }

  function loadCertificate() {
    if (!id) return;
    fetchMyCertificates()
      .then((certs) => setCertificate(certs.find((c) => c.courseId === id) || null))
      .catch(() => setCertificate(null));
  }

  useEffect(() => {
    if (!id) return;
    fetchCourse(id).then(setCourse).catch(() => setCourse(null));
    fetchLessons(id).then(setLessons).catch(() => setLessons([]));
    loadAccess();
    fetchEnrollment(id).then((e) => setActiveId(e.currentLessonId || null));
    loadCertificate();
  }, [id]);

  useEffect(() => {
    if (!activeId && lessons.length > 0) setActiveId(lessons[0].id);
  }, [lessons]);

  function isLocked(lessonId: string): boolean {
    return access.find((a) => a.lessonId === lessonId)?.locked ?? false;
  }

  async function goToLesson(lessonId: string) {
    if (isLocked(lessonId) || !id) return;
    setActiveId(lessonId);
    setAnswer(null);
    const idx = lessons.findIndex((l) => l.id === lessonId);
    const progressPercent = lessons.length ? Math.round(((idx + 1) / lessons.length) * 100) : 0;
    await updateProgress(id, { currentLessonId: lessonId, progressPercent });
    if (progressPercent >= 100) loadCertificate();
  }

  const activeLesson = lessons.find((l) => l.id === activeId) || null;
  const activeIdx = activeLesson ? lessons.findIndex((l) => l.id === activeLesson.id) : -1;
  const nonQuizBlocks = activeLesson ? activeLesson.content.filter((b) => b.type !== "QUIZ") : [];
  const quizBlock = activeLesson ? (activeLesson.content.find((b) => b.type === "QUIZ") as any) : null;

  async function handleAsk() {
    if (!activeLesson || !question.trim()) return;
    setAsking(true);
    try {
      const res = await askLesson(activeLesson.id, question);
      setAnswer(res.response);
    } finally {
      setAsking(false);
    }
  }

  function handleMic() {
    if (!isSpeechRecognitionSupported()) return;
    setRecording(true);
    startSpeechRecognition((transcript) => setQuestion(transcript), () => setRecording(false));
  }

  if (!course) return <AppShell title="Curs" subtitle="Se încarcă..."><div /></AppShell>;

  return (
    <AppShell title={course.title} subtitle={course.description || "Parcurgere curs"}>
      {certificate && (
        <Card style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", background: T.successTint }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Award size={20} color={T.success} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: T.success }}>Curs finalizat — certificat emis</div>
              <div style={{ fontSize: 12, color: T.ink3 }}>Nr. {certificate.certificateNumber} · {new Date(certificate.issuedAt).toLocaleDateString("ro-RO")}</div>
            </div>
          </div>
          <Button onClick={() => downloadCertificate(certificate)}>Descarcă certificatul</Button>
        </Card>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 20 }}>
        <Card style={{ padding: 10, alignSelf: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {lessons.map((l) => {
              const locked = isLocked(l.id);
              return (
                <div
                  key={l.id}
                  onClick={() => goToLesson(l.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 10px",
                    borderRadius: 8,
                    cursor: locked ? "not-allowed" : "pointer",
                    background: activeId === l.id ? T.brandTint : "transparent",
                    opacity: locked ? 0.5 : 1,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: activeId === l.id ? 700 : 500 }}>{l.title}</span>
                  {locked && <Lock size={13} color={T.ink4} />}
                </div>
              );
            })}
          </div>
        </Card>

        {!activeLesson ? (
          <Card><p style={{ color: T.ink3 }}>Acest curs nu are încă lecții.</p></Card>
        ) : (
          <div id="lms-player-lesson-content">
            <Card style={{ marginBottom: 20 }}>
              <h2 style={{ marginTop: 0 }}>{activeLesson.title}</h2>
              <LessonBlocksView blocks={nonQuizBlocks} />
              {quizBlock && (
                <div style={{ marginTop: 18 }}>
                  <QuizPlayer lessonId={activeLesson.id} quiz={quizBlock} onSubmitted={loadAccess} />
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                <Button variant="ghost" disabled={activeIdx <= 0} onClick={() => goToLesson(lessons[activeIdx - 1].id)} style={{ opacity: activeIdx <= 0 ? 0.5 : 1 }}>
                  ← Lecția anterioară
                </Button>
                <Button
                  variant="ghost"
                  disabled={activeIdx >= lessons.length - 1 || isLocked(lessons[activeIdx + 1]?.id)}
                  onClick={() => goToLesson(lessons[activeIdx + 1].id)}
                  style={{ opacity: activeIdx >= lessons.length - 1 || isLocked(lessons[activeIdx + 1]?.id) ? 0.5 : 1 }}
                >
                  Lecția următoare →
                </Button>
              </div>
            </Card>

            <Card id="lms-player-ask-assistant">
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: T.ink3, marginBottom: 12 }}>
                Întreabă asistentul despre această lecție
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {isSpeechRecognitionSupported() && (
                  <button onClick={handleMic} style={{ background: recording ? T.dangerTint : T.line2, border: "none", borderRadius: 8, padding: 8, cursor: "pointer", color: recording ? T.danger : T.ink2 }}>
                    <Mic size={15} />
                  </button>
                )}
                <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Scrie o întrebare..." style={{ flex: 1 }} onKeyDown={(e) => e.key === "Enter" && handleAsk()} />
                <Button onClick={handleAsk} style={{ opacity: asking ? 0.6 : 1, display: "flex", alignItems: "center", gap: 6 }}>
                  <Send size={13} /> Întreabă
                </Button>
              </div>
              {answer && (
                <div style={{ padding: 12, background: T.line2, borderRadius: 10, display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: 13.5 }}>{answer}</span>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    {isSpeechSynthesisSupported() && (
                      <button onClick={() => speakText(answer)} title="Ascultă răspunsul" style={{ background: "none", border: "none", cursor: "pointer", color: T.ink3 }}>
                        <Volume2 size={14} />
                      </button>
                    )}
                    <button
                      id="lms-player-tts-download-btn"
                      onClick={() => handleDownloadAudio(answer)}
                      disabled={downloadingAudio}
                      title="Descarcă fișier audio"
                      style={{ background: "none", border: "none", cursor: downloadingAudio ? "default" : "pointer", color: T.ink3, opacity: downloadingAudio ? 0.5 : 1 }}
                    >
                      <Download size={14} />
                    </button>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
      <div style={{ marginTop: 10 }}>
        <Button variant="ghost" onClick={() => navigate("/lms")}>← Înapoi la cursuri</Button>
      </div>
    </AppShell>
  );
}
