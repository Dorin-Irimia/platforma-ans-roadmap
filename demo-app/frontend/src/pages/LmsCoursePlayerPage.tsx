import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Mic, Volume2, Square, Download, Send, Award, Check } from "lucide-react";
import { AppShell } from "../components/AppShell";
import { Card, Button } from "../components/ui";
import { T } from "../theme";
import { useIsMobile } from "../lib/useMediaQuery";
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
  fetchComments,
  addComment,
  deleteComment,
  LmsCourseSummary,
  LmsLessonDto,
  LessonAccessDto,
  LmsCertificateDto,
  LmsCommentDto,
  LessonBlock,
} from "../features/lms/api";
import { LessonBlocksView, extractPlainText, TextAudioControls } from "../components/lms/LessonBlocksView";
import { CommentableLessonView } from "../components/lms/CommentableLessonView";
import { QuizPlayer } from "../components/lms/QuizPlayer";
import { FeedbackWidget } from "../components/lms/FeedbackWidget";
import { isSpeechRecognitionSupported, startSpeechRecognition, isSpeechSynthesisSupported, speakText, stopSpeech } from "../features/chatbot/speech";
import { useToast } from "../components/ToastProvider";

export default function LmsCoursePlayerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  // Când cursul e accesat dintr-un proiect (LmsProjectDetailPage trece ?projectId=...),
  // "înapoi"/"finalizează" trebuie să te ducă la ACEL proiect, nu la catalogul general —
  // altfel pierzi contextul (ex. următorul curs secvențial deblocat) de fiecare dată.
  const projectId = searchParams.get("projectId");
  const backTarget = projectId ? `/lms/projects/${projectId}` : "/lms";
  // Toate interacțiunile (progres, comentarii, tentative de test, evaluări prin stele)
  // sunt ancorate în proiectul prin care a fost accesat cursul — un curs reutilizat în mai
  // multe proiecte are aceste date complet separate per proiect (vezi schema.prisma).
  const projectIdParam = projectId || undefined;
  const isMobile = useIsMobile();
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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [comments, setComments] = useState<LmsCommentDto[]>([]);

  function handleToggleSpeech(text: string) {
    if (isSpeaking) {
      stopSpeech();
      setIsSpeaking(false);
      return;
    }
    setIsSpeaking(true);
    speakText(text, () => setIsSpeaking(false));
  }

  async function handleDownloadAudio(text: string) {
    setDownloadingAudio(true);
    try {
      await downloadLessonAudio(text);
    } finally {
      setDownloadingAudio(false);
    }
  }

  function loadAccess() {
    if (id) fetchLessonAccess(id, projectIdParam).then(setAccess).catch(() => setAccess([]));
  }

  // Reîmprospătarea reală (loadAccess, un GET) e asincronă — dacă utilizatorul dă click pe
  // "Lecția următoare" chiar în clipa în care apare rezultatul testului, cursa asta putea
  // face ca butonul să pară activ dar navigarea să eșueze silențios (isLocked citea încă
  // starea veche, blocată). La un test promovat, deblocăm local, imediat, lecția următoare,
  // înainte să mai așteptăm răspunsul serverului — loadAccess() rămâne, doar ca reconciliere.
  function handleQuizSubmitted(passed: boolean) {
    if (passed && activeLesson) {
      const idx = lessons.findIndex((l) => l.id === activeLesson.id);
      const nextLesson = lessons[idx + 1];
      if (nextLesson) {
        setAccess((prev) => {
          const exists = prev.some((a) => a.lessonId === nextLesson.id);
          return exists
            ? prev.map((a) => (a.lessonId === nextLesson.id ? { ...a, locked: false } : a))
            : [...prev, { lessonId: nextLesson.id, locked: false }];
        });
      }
    }
    loadAccess();
  }

  function loadCertificate() {
    if (!id) return;
    fetchMyCertificates()
      .then((certs) => setCertificate(certs.find((c) => c.courseId === id && c.projectId === (projectIdParam || "")) || null))
      .catch(() => setCertificate(null));
  }

  // Comentariile cursantului (dacă cursul permite) — serverul filtrează deja: un cursant
  // își vede DOAR propriile comentarii + răspunsurile primite la ele, niciodată
  // comentariile altor cursanți.
  function loadComments(lessonId: string) {
    fetchComments(lessonId, projectIdParam).then(setComments).catch(() => setComments([]));
  }

  async function handleAddComment(blockId: string, body: string, quote?: string) {
    if (!activeId) return;
    await addComment(activeId, blockId, body, quote, projectIdParam);
    loadComments(activeId);
  }

  // Cursantul își poate șterge propriile comentarii, dar doar cât timp firul e încă
  // neatins (Deschis, fără răspuns primit) sau deja finalizat (Rezolvat/Respins) — un
  // comentariu Deschis la care a răspuns deja un formator rămâne needitabil (server-ul
  // impune aceeași regulă, ca să nu se poată șterge răspunsul primit).
  async function handleDeleteOwnComment(commentId: string) {
    if (!window.confirm("Ștergi definitiv acest comentariu? Acțiunea nu poate fi anulată.")) return;
    try {
      await deleteComment(commentId);
      if (activeId) loadComments(activeId);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Comentariul nu a putut fi șters");
    }
  }

  useEffect(() => {
    if (!id) return;
    fetchCourse(id).then(setCourse).catch(() => setCourse(null));
    fetchLessons(id).then(setLessons).catch(() => setLessons([]));
    loadAccess();
    // La o primă înrolare (fără `currentLessonId` încă salvat), NU suprascriem cu `null`
    // — lăsăm efectul de mai jos să aleagă prima lecție, indiferent de ordinea în care
    // răspund cele două cereri (altfel, dacă acest răspuns sosește ultimul, ar rescrie
    // silențios selecția implicită și ar arăta fals "acest curs nu are încă lecții").
    fetchEnrollment(id, projectIdParam).then((e) => { if (e.currentLessonId) setActiveId(e.currentLessonId); });
    loadCertificate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, projectIdParam]);

  useEffect(() => {
    if (!activeId && lessons.length > 0) setActiveId(lessons[0].id);
  }, [lessons]);

  useEffect(() => {
    if (activeId && course?.allowLearnerComments) loadComments(activeId);
    else setComments([]);
  }, [activeId, course?.allowLearnerComments]);

  function isLocked(lessonId: string): boolean {
    return access.find((a) => a.lessonId === lessonId)?.locked ?? false;
  }

  async function goToLesson(lessonId: string) {
    if (isLocked(lessonId) || !id) return;
    setActiveId(lessonId);
    setAnswer(null);
    const idx = lessons.findIndex((l) => l.id === lessonId);
    const progressPercent = lessons.length ? Math.round(((idx + 1) / lessons.length) * 100) : 0;
    await updateProgress(id, { currentLessonId: lessonId, progressPercent }, projectIdParam);
    if (progressPercent >= 100) loadCertificate();
  }

  // Marchează explicit cursul ca finalizat (100%, chiar dacă utilizatorul a ajuns direct
  // pe ultima lecție fără să treacă prin goToLesson — ex. un curs cu o singură lecție) și
  // se întoarce la proiectul din care a fost accesat cursul (sau la catalog, dacă a fost
  // accesat direct, fără proiect).
  async function handleFinishCourse() {
    if (!id || !activeLesson) return;
    await updateProgress(id, { currentLessonId: activeLesson.id, progressPercent: 100 }, projectIdParam);
    navigate(backTarget);
  }

  const activeLesson = lessons.find((l) => l.id === activeId) || null;
  const activeIdx = activeLesson ? lessons.findIndex((l) => l.id === activeLesson.id) : -1;
  const nonQuizBlocks = activeLesson ? activeLesson.content.filter((b) => b.type !== "QUIZ") : [];
  const quizBlock = activeLesson ? (activeLesson.content.find((b) => b.type === "QUIZ") as any) : null;
  // Textul complet al lecției (toate blocurile TEXT concatenate) — pentru Ascultă/Descarcă
  // pe lecția întreagă, pe lângă controalele per-fragment din LessonBlocksView/CommentableLessonView.
  const lessonPlainText = nonQuizBlocks
    .filter((b): b is Extract<LessonBlock, { type: "TEXT" }> => b.type === "TEXT")
    .map((b) => extractPlainText(b.text))
    .filter(Boolean)
    .join("\n\n");

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
      <div style={isMobile ? { display: "flex", flexDirection: "column", gap: 14 } : { display: "grid", gridTemplateColumns: "260px 1fr", gap: 20 }}>
        {isMobile ? (
          // Pe mobil o listă verticală ar împinge conținutul lecției mult sub fold —
          // navigare compactă tip "chips" derulabilă orizontal, ca la un curs mobil modern.
          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2, WebkitOverflowScrolling: "touch" }}>
            {(() => {
              const firstLockedIdx = lessons.findIndex((l) => isLocked(l.id));
              return lessons.map((l, idx) => {
              const locked = isLocked(l.id);
              const active = activeId === l.id;
              return (
                <button
                  key={l.id}
                  id={idx === firstLockedIdx ? "lms-player-locked-lesson" : undefined}
                  onClick={() => goToLesson(l.id)}
                  disabled={locked}
                  style={{
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    borderRadius: 999,
                    border: `1px solid ${active ? T.brand : T.line}`,
                    background: active ? T.brandTint : T.card,
                    color: active ? T.brandDark : T.ink2,
                    fontSize: 12.5,
                    fontWeight: active ? 700 : 500,
                    whiteSpace: "nowrap",
                    cursor: locked ? "not-allowed" : "pointer",
                    opacity: locked ? 0.55 : 1,
                  }}
                >
                  {locked ? <Lock size={11} /> : active ? <Check size={11} /> : null}
                  {l.title}
                </button>
              );
              });
            })()}
          </div>
        ) : (
          <Card style={{ padding: 10, alignSelf: "start" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {(() => {
                const firstLockedIdx = lessons.findIndex((l) => isLocked(l.id));
                return lessons.map((l, idx) => {
                  const locked = isLocked(l.id);
                  return (
                    <div
                      key={l.id}
                      id={idx === firstLockedIdx ? "lms-player-locked-lesson" : undefined}
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
                });
              })()}
            </div>
          </Card>
        )}

        {!activeLesson ? (
          <Card><p style={{ color: T.ink3 }}>Acest curs nu are încă lecții.</p></Card>
        ) : (
          <div id="lms-player-lesson-content">
            <Card style={{ marginBottom: 20 }}>
              <h2 style={{ marginTop: 0, marginBottom: 4 }}>{activeLesson.title}</h2>
              {lessonPlainText && (
                <div style={{ marginBottom: 16 }}>
                  <TextAudioControls text={lessonPlainText} label="Ascultă lecția întreagă" />
                </div>
              )}
              {course.allowLearnerComments && !isLocked(activeLesson.id) ? (
                <CommentableLessonView
                  blocks={nonQuizBlocks}
                  comments={comments}
                  onAddComment={handleAddComment}
                  feedbackEnabled={course.feedbackEnabled}
                  courseId={course.id}
                  lessonId={activeLesson.id}
                  projectId={projectIdParam}
                />
              ) : (
                <LessonBlocksView blocks={nonQuizBlocks} feedbackEnabled={course.feedbackEnabled} courseId={course.id} lessonId={activeLesson.id} projectId={projectIdParam} />
              )}
              {quizBlock && (
                <div style={{ marginTop: 18 }}>
                  <QuizPlayer key={activeLesson.id} lessonId={activeLesson.id} quiz={quizBlock} onSubmitted={handleQuizSubmitted} showCorrectAnswers={course.showQuizCorrectAnswers} projectId={projectIdParam} />
                </div>
              )}

              {course.allowLearnerComments && comments.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: T.ink3, marginBottom: 10 }}>
                    Comentariile mele
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {comments.map((c) => {
                      const claimedByAdmin = c.status === "OPEN" && !!c.replies?.length;
                      return (
                      <div key={c.id} style={{ padding: 10, background: T.line2, borderRadius: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ fontSize: 11.5, color: T.ink3, marginBottom: 4 }}>
                          {new Date(c.createdAt).toLocaleString("ro-RO")} ·{" "}
                          <span style={{ fontWeight: 700, color: c.status === "OPEN" ? T.warn : c.status === "RESOLVED" ? T.success : T.danger }}>
                            {c.status === "OPEN" ? "Deschis" : c.status === "RESOLVED" ? "Rezolvat" : "Respins"}
                          </span>
                        </div>
                        {!claimedByAdmin && (
                          <button
                            onClick={() => handleDeleteOwnComment(c.id)}
                            style={{ border: "none", background: "none", color: T.danger, fontSize: 11, fontWeight: 600, cursor: "pointer", padding: 0, flexShrink: 0 }}
                          >
                            Șterge
                          </button>
                        )}
                        </div>
                        {c.quote && (
                          <div style={{ fontSize: 12, fontStyle: "italic", color: T.ink3, borderLeft: `3px solid ${T.brand}`, paddingLeft: 8, marginBottom: 6 }}>
                            „{c.quote}”
                          </div>
                        )}
                        <div style={{ fontSize: 13, color: T.ink }}>{c.body}</div>
                        {c.replies && c.replies.length > 0 && (
                          <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: `2px solid ${T.line}`, display: "flex", flexDirection: "column", gap: 6 }}>
                            {c.replies.map((r) => (
                              <div key={r.id}>
                                <div style={{ fontSize: 11, color: T.ink3 }}>
                                  <strong style={{ color: T.ink2 }}>{r.author?.name || r.author?.email || "Formator"}</strong> · {new Date(r.createdAt).toLocaleString("ro-RO")}
                                </div>
                                <div style={{ fontSize: 12.5, color: T.ink }}>{r.body}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
                <Button variant="ghost" disabled={activeIdx <= 0} onClick={() => goToLesson(lessons[activeIdx - 1].id)} style={{ opacity: activeIdx <= 0 ? 0.5 : 1 }}>
                  ← Lecția anterioară
                </Button>
                {activeIdx < lessons.length - 1 ? (
                  <Button
                    variant="ghost"
                    disabled={isLocked(lessons[activeIdx + 1]?.id)}
                    onClick={() => goToLesson(lessons[activeIdx + 1].id)}
                    style={{ opacity: isLocked(lessons[activeIdx + 1]?.id) ? 0.5 : 1 }}
                  >
                    Lecția următoare →
                  </Button>
                ) : (
                  <Button id="lms-player-finish-course-btn" onClick={handleFinishCourse} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Check size={14} /> Finalizează cursul
                  </Button>
                )}
              </div>
            </Card>

            {course.feedbackEnabled && (
              <Card style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: T.ink3, marginBottom: 4 }}>
                  Evaluează cursul
                </div>
                <FeedbackWidget courseId={course.id} scope="COURSE" projectId={projectIdParam} label="Cum ți se pare acest curs în ansamblu?" />
              </Card>
            )}

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
                      <button
                        onClick={() => handleToggleSpeech(answer)}
                        title={isSpeaking ? "Oprește" : "Ascultă răspunsul"}
                        style={{ background: "none", border: "none", cursor: "pointer", color: isSpeaking ? T.brand : T.ink3 }}
                      >
                        {isSpeaking ? <Square size={13} fill={T.brand} /> : <Volume2 size={14} />}
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
        <Button variant="ghost" onClick={() => navigate(backTarget)}>← {projectId ? "Înapoi la proiect" : "Înapoi la cursuri"}</Button>
      </div>
    </AppShell>
  );
}
