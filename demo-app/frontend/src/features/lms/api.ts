import api from "../iam/api";

export type LmsCourseStatus = "DRAFT" | "PUBLISHED";
export type LmsCourseRole = "AUTHOR" | "COAUTHOR";

export interface LmsCourseCollaboratorDto {
  id: string;
  courseId: string;
  userId: string;
  courseRole: LmsCourseRole;
  user: { id: string; name?: string; email: string };
}

export interface LmsRubricCriterion {
  label: string;
  maxScore: number;
}

export interface LmsRubricDto {
  id: string;
  courseId: string;
  criteria: LmsRubricCriterion[];
}

export interface LmsCourseSummary {
  id: string;
  title: string;
  description?: string;
  status: LmsCourseStatus;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  lessons: { id: string; title: string; order: number }[];
  collaborators: LmsCourseCollaboratorDto[];
  rubric?: LmsRubricDto | null;
  // Setări de curs (tab "Setări" din editor) — vezi comentariile din schema.prisma
  // (model LmsCourse) pentru ce controlează fiecare comutator.
  allowLearnerComments: boolean;
  requireQuizToAdvance: boolean;
  issueCertificate: boolean;
  showQuizCorrectAnswers: boolean;
  feedbackEnabled: boolean;
  // Proiectul(ele) de care e deja atașat cursul — vezi AddCourseForm din
  // LmsProjectDetailPage.tsx (selector "din ce proiect" la atașarea unui curs existent).
  projectLinks?: { project: { id: string; title: string } }[];
}

export async function fetchCourses(): Promise<LmsCourseSummary[]> {
  const { data } = await api.get("/api/lms/courses");
  return data;
}

export async function createCourse(input: { title: string; description?: string }): Promise<LmsCourseSummary> {
  const { data } = await api.post("/api/lms/courses", input);
  return data;
}

export async function fetchCourse(id: string): Promise<LmsCourseSummary> {
  const { data } = await api.get(`/api/lms/courses/${id}`);
  return data;
}

export async function updateCourse(
  id: string,
  input: Partial<{
    title: string;
    description: string;
    status: LmsCourseStatus;
    allowLearnerComments: boolean;
    requireQuizToAdvance: boolean;
    issueCertificate: boolean;
  }>
): Promise<LmsCourseSummary> {
  const { data } = await api.patch(`/api/lms/courses/${id}`, input);
  return data;
}

export async function deleteCourse(id: string) {
  await api.delete(`/api/lms/courses/${id}`);
}

// --- Lecții / blocuri de conținut ---

export type LessonBlock =
  | { id: string; type: "TEXT"; text: string }
  | { id: string; type: "IMAGE"; url: string; caption?: string }
  | { id: string; type: "VIDEO"; url: string; caption?: string }
  | { id: string; type: "QUIZ"; questions: LmsQuizQuestion[]; requiredScoreToUnlockNext: number };

export interface LmsQuizQuestion {
  id: string;
  text: string;
  options: string[];
  // Răspunsuri multiple corecte — set de indexuri. Întrebările vechi salvate doar cu
  // `correctIndex` (un singur index) se citesc ca `[correctIndex]` — vezi `correctIndexesOf()`.
  correctIndexes: number[];
}

export function correctIndexesOf(q: LmsQuizQuestion & { correctIndex?: number }): number[] {
  if (q.correctIndexes) return q.correctIndexes;
  if (typeof q.correctIndex === "number") return [q.correctIndex];
  return [];
}

export interface LmsLessonDto {
  id: string;
  courseId: string;
  title: string;
  order: number;
  content: LessonBlock[];
  createdAt: string;
  updatedAt: string;
}

export async function fetchLessons(courseId: string): Promise<LmsLessonDto[]> {
  const { data } = await api.get(`/api/lms/courses/${courseId}/lessons`);
  return data;
}

export async function createLesson(courseId: string, title: string): Promise<LmsLessonDto> {
  const { data } = await api.post(`/api/lms/courses/${courseId}/lessons`, { title });
  return data;
}

export async function updateLesson(id: string, input: Partial<{ title: string; content: LessonBlock[] }>): Promise<LmsLessonDto> {
  const { data } = await api.patch(`/api/lms/lessons/${id}`, input);
  return data;
}

export async function deleteLesson(id: string) {
  await api.delete(`/api/lms/lessons/${id}`);
}

export async function reorderLessons(courseId: string, items: { id: string; order: number }[]) {
  await api.put(`/api/lms/courses/${courseId}/lessons/reorder`, { items });
}

export interface LessonAccessDto {
  lessonId: string;
  locked: boolean;
}

export async function fetchLessonAccess(courseId: string, projectId?: string): Promise<LessonAccessDto[]> {
  const { data } = await api.get(`/api/lms/courses/${courseId}/lessons/access`, { params: { projectId } });
  return data;
}

// --- AI ---

export async function generateStructure(courseId: string, subject: string, file?: File | null): Promise<LmsLessonDto[]> {
  const form = new FormData();
  form.append("courseId", courseId);
  form.append("subject", subject);
  if (file) form.append("file", file);
  const { data } = await api.post("/api/lms/ai/generate-structure", form);
  return data;
}

export async function rewriteText(text: string, instruction: "REWRITE" | "ADAPT" | "EXPAND" | "SUMMARIZE", context?: string): Promise<string> {
  const { data } = await api.post("/api/lms/ai/rewrite", { text, instruction, context });
  return data.result as string;
}

export interface LmsMediaUploadResult {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
}

export async function uploadLmsMedia(file: File): Promise<LmsMediaUploadResult> {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/api/lms/media", form);
  return data;
}

// Fișierul e servit public (fără auth — vezi media.routes.ts), deci trebuie adresat cu
// URL absolut către backend, la fel ca artifactPhotoUrl din features/museum/api.ts —
// un <img>/<video src> nu poate trimite header-ul Authorization pe care se bazează `api`.
export function lmsMediaUrl(id: string): string {
  const base = (import.meta as any).env?.VITE_API_URL || "http://localhost:4000";
  return `${base}/api/lms/media/${id}/file`;
}

// --- Colaborare ---

export async function addCollaborator(courseId: string, userId: string, courseRole: LmsCourseRole = "COAUTHOR"): Promise<LmsCourseCollaboratorDto> {
  const { data } = await api.post(`/api/lms/courses/${courseId}/collaborators`, { userId, courseRole });
  return data;
}

export async function removeCollaborator(courseId: string, userId: string) {
  await api.delete(`/api/lms/courses/${courseId}/collaborators/${userId}`);
}

export type LmsCommentStatus = "OPEN" | "RESOLVED" | "REJECTED";

export interface LmsCommentDto {
  id: string;
  lessonId: string;
  blockId: string;
  authorId: string;
  author?: { id: string; name?: string; email: string };
  body: string;
  // Fragmentul exact selectat (text sau enunțul unei întrebări) la care se referă
  // comentariul — comentariu "ca la Word", ancorat la o secvență precisă, nu la tot blocul.
  quote?: string;
  status: LmsCommentStatus;
  parentId?: string;
  // Doar pe comentariile de nivel superior — răspunsurile (parentId setat) nu au propriul
  // `replies`, ca să nu se ramifice la infinit (un singur nivel de fir de discuție).
  replies?: LmsCommentDto[];
  createdAt: string;
}

export async function fetchComments(lessonId: string, projectId?: string): Promise<LmsCommentDto[]> {
  const { data } = await api.get(`/api/lms/lessons/${lessonId}/comments`, { params: { projectId } });
  return data;
}

export async function addComment(lessonId: string, blockId: string, body: string, quote?: string, projectId?: string): Promise<LmsCommentDto> {
  const { data } = await api.post(`/api/lms/lessons/${lessonId}/comments`, { blockId, body, quote, projectId });
  return data;
}

export async function replyToComment(commentId: string, body: string): Promise<LmsCommentDto> {
  const { data } = await api.post(`/api/lms/comments/${commentId}/replies`, { body });
  return data;
}

export async function updateCommentStatus(id: string, status: LmsCommentStatus): Promise<LmsCommentDto> {
  const { data } = await api.patch(`/api/lms/comments/${id}/status`, { status });
  return data;
}

// Ștergere comentariu (+ răspunsurile lui) — rezervată Super Admin (vezi ruta backend).
export async function deleteComment(id: string): Promise<void> {
  await api.delete(`/api/lms/comments/${id}`);
}

// --- Feedback prin stele (+ comentariu opțional) ---
// Distinct de LmsComment (comentarii ancorate, ca la Word, folosite de colaboratori la
// revizuirea unui draft) — acesta e feedback de satisfacție, dat de cursanți SAU
// colaboratori, activabil per curs (LmsCourseSummary.feedbackEnabled).

export type LmsFeedbackScope = "COURSE" | "BLOCK";

export interface LmsMyFeedback {
  rating: number | null;
  comment: string | null;
  updatedAt: string | null;
}

export interface LmsFeedbackCommentRow {
  id: string;
  authorName: string;
  rating: number;
  comment: string | null;
  createdAt: string;
}

export interface LmsFeedbackAggregate {
  count: number;
  avg: number;
  distribution: number[]; // [nr. de 1★, 2★, 3★, 4★, 5★]
  comments: LmsFeedbackCommentRow[];
}

export interface LmsFeedbackBlockReport extends LmsFeedbackAggregate {
  blockId: string;
  label: string;
}

export interface LmsFeedbackLessonReport {
  lessonId: string;
  lessonTitle: string;
  blocks: LmsFeedbackBlockReport[];
}

export interface LmsFeedbackSummary {
  course: LmsFeedbackAggregate;
  lessons: LmsFeedbackLessonReport[];
}

export async function submitFeedback(
  courseId: string,
  payload: { scope: LmsFeedbackScope; lessonId?: string; blockId?: string; rating: number; comment?: string; projectId?: string }
): Promise<void> {
  await api.post(`/api/lms/courses/${courseId}/feedback`, payload);
}

export async function fetchMyFeedback(courseId: string, scope: LmsFeedbackScope, lessonId?: string, blockId?: string, projectId?: string): Promise<LmsMyFeedback> {
  const { data } = await api.get(`/api/lms/courses/${courseId}/feedback/mine`, { params: { scope, lessonId, blockId, projectId } });
  return data;
}

export async function fetchFeedbackSummary(courseId: string, projectId?: string): Promise<LmsFeedbackSummary> {
  const { data } = await api.get(`/api/lms/courses/${courseId}/feedback/summary`, { params: { projectId } });
  return data;
}

export async function fetchRubric(courseId: string): Promise<LmsRubricDto | null> {
  const { data } = await api.get(`/api/lms/courses/${courseId}/rubric`);
  return data;
}

export async function saveRubric(courseId: string, criteria: LmsRubricCriterion[]): Promise<LmsRubricDto> {
  const { data } = await api.put(`/api/lms/courses/${courseId}/rubric`, { criteria });
  return data;
}

export interface LmsRubricScoreDto {
  id: string;
  lessonId: string;
  evaluatorId: string;
  scores: { label: string; score: number }[];
  createdAt: string;
}

export async function submitRubricScore(lessonId: string, scores: { label: string; score: number }[]): Promise<LmsRubricScoreDto> {
  const { data } = await api.post(`/api/lms/lessons/${lessonId}/rubric-score`, { scores });
  return data;
}

export async function fetchRubricScores(lessonId: string): Promise<LmsRubricScoreDto[]> {
  const { data } = await api.get(`/api/lms/lessons/${lessonId}/rubric-scores`);
  return data;
}

// --- Enrollment ---

export interface LmsEnrollmentDto {
  id: string;
  courseId: string;
  userId: string;
  currentLessonId?: string | null;
  progressPercent: number;
  updatedAt: string;
}

export async function fetchEnrollment(courseId: string, projectId?: string): Promise<LmsEnrollmentDto> {
  const { data } = await api.get(`/api/lms/courses/${courseId}/enrollment`, { params: { projectId } });
  return data;
}

export async function updateProgress(courseId: string, input: { currentLessonId?: string; progressPercent?: number }, projectId?: string): Promise<LmsEnrollmentDto> {
  const { data } = await api.patch(`/api/lms/courses/${courseId}/enrollment/progress`, { ...input, projectId });
  return data;
}

// Panoul principal — "Continuă parcurgerea" (widget-ul ContinueLearningWidget) — toate
// înscrierile utilizatorului curent, peste toate cursurile, cele mai recent active primele.
export interface LmsMyEnrollmentDto {
  id: string;
  courseId: string;
  course: { id: string; title: string };
  currentLessonId?: string | null;
  currentLessonTitle?: string | null;
  progressPercent: number;
  updatedAt: string;
  // Proiectul prin care e accesibil cursul, dacă e cazul — permite butonului "Continuă"
  // să te ducă înapoi la proiectul corect, nu la catalogul general.
  projectId?: string | null;
}

export async function fetchMyEnrollments(): Promise<LmsMyEnrollmentDto[]> {
  const { data } = await api.get("/api/lms/my-enrollments");
  return data;
}

// Certificat de absolvire (cerință CNFPA) — emis automat de backend la 100% progres.
export interface LmsCertificateDto {
  id: string;
  courseId: string;
  // "" = curs de sine stătător / fără proiect — un curs reutilizat în mai multe proiecte
  // primește un certificat SEPARAT per proiect (vezi schema.prisma).
  projectId: string;
  certificateNumber: string;
  issuedAt: string;
  course: { id: string; title: string };
}

export async function fetchMyCertificates(): Promise<LmsCertificateDto[]> {
  const { data } = await api.get("/api/lms/certificates");
  return data;
}

// Ruta cere autentificare — descărcăm ca blob (nu <a href> simplu) ca să trimitem
// Authorization, la fel ca restul fișierelor autentificate din platformă.
export async function downloadCertificate(certificate: LmsCertificateDto) {
  const { data } = await api.get(`/api/lms/certificates/${certificate.id}/file`, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${certificate.certificateNumber}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

// Fișier audio real (pct. 11), generat server-side (espeak-ng) — spre deosebire de
// redarea live cu Web Speech API din `speakText`, aici primim un .wav propriu-zis de descărcat.
export async function downloadLessonAudio(text: string, rate?: number) {
  const { data } = await api.post("/api/lms/tts", { text, rate }, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lectie-audio.wav";
  a.click();
  URL.revokeObjectURL(url);
}

// --- Quiz ---

export async function submitQuizAttempt(lessonId: string, answers: Record<string, number[]>, projectId?: string): Promise<{ score: number; passed: boolean; correctCount: number; totalCount: number }> {
  const { data } = await api.post(`/api/lms/lessons/${lessonId}/quiz-attempt`, { answers, projectId });
  return data;
}

export interface LmsQuizQuestionReport {
  questionId: string;
  text: string;
  options: string[];
  correctIndexes: number[];
  optionCounts: number[];
  answeredCount: number;
  correctRate: number;
}

export interface LmsQuizLessonReport {
  lessonId: string;
  lessonTitle: string;
  requiredScoreToUnlockNext: number;
  attemptedCount: number;
  passedCount: number;
  passRate: number;
  avgScore: number;
  questions: LmsQuizQuestionReport[];
}

export async function fetchQuizReport(courseId: string, projectId?: string): Promise<LmsQuizLessonReport[]> {
  const { data } = await api.get(`/api/lms/courses/${courseId}/quiz-report`, { params: { projectId } });
  return data;
}

// --- Asistent / intenții ---

export interface LmsIntentDto {
  id: string;
  courseId: string;
  name: string;
  triggerPhrases: string[];
  responseMode: "CANNED" | "AI";
  cannedResponse?: string | null;
}

export async function fetchIntents(courseId: string): Promise<LmsIntentDto[]> {
  const { data } = await api.get(`/api/lms/courses/${courseId}/intents`);
  return data;
}

export async function createIntent(courseId: string, input: Omit<LmsIntentDto, "id" | "courseId">): Promise<LmsIntentDto> {
  const { data } = await api.post(`/api/lms/courses/${courseId}/intents`, input);
  return data;
}

export async function updateIntent(id: string, input: Partial<Omit<LmsIntentDto, "id" | "courseId">>): Promise<LmsIntentDto> {
  const { data } = await api.patch(`/api/lms/intents/${id}`, input);
  return data;
}

export async function deleteIntent(id: string) {
  await api.delete(`/api/lms/intents/${id}`);
}

export interface LmsAssistantSettingsDto {
  language: string;
  tone: string;
  domainTerms: string[];
  fallbackSteps: { order: number; prompt: string }[];
  stalledAfterDays: number;
}

export async function fetchAssistantSettings(): Promise<LmsAssistantSettingsDto> {
  const { data } = await api.get("/api/lms/assistant-settings");
  return data;
}

export async function updateAssistantSettings(input: Partial<LmsAssistantSettingsDto>): Promise<LmsAssistantSettingsDto> {
  const { data } = await api.patch("/api/lms/assistant-settings", input);
  return data;
}

// --- Motor AI (pct. 8) — setări globale existente deja pe backend (/api/iam/ai-settings),
// fără consumator în frontend până acum; reutilizate ca atare, doar UI nou aici. ---

export interface AiSettingsDto {
  defaultModel: string;
}

export async function fetchAiSettings(): Promise<AiSettingsDto> {
  const { data } = await api.get("/api/iam/ai-settings");
  return data;
}

export async function updateAiSettings(defaultModel: string): Promise<AiSettingsDto> {
  const { data } = await api.patch("/api/iam/ai-settings", { defaultModel });
  return data;
}

// --- Materiale pentru adaptarea asistentului (pct. 3) — textul extras fundamentează
// real răspunsurile asistentului LMS, nu antrenează un model separat. ---

export interface LmsAssistantResourceDto {
  id: string;
  filename: string;
  mimeType: string;
  extractedText?: string | null;
  createdAt: string;
}

export async function fetchAssistantResources(): Promise<LmsAssistantResourceDto[]> {
  const { data } = await api.get("/api/lms/assistant-resources");
  return data;
}

export async function uploadAssistantResources(files: File[]): Promise<LmsAssistantResourceDto[]> {
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const { data } = await api.post("/api/lms/assistant-resources", form);
  return data;
}

export async function deleteAssistantResource(id: string) {
  await api.delete(`/api/lms/assistant-resources/${id}`);
}

export async function testAssistant(courseId: string, message: string): Promise<{ matchedIntent: string | null; response: string }> {
  const { data } = await api.post("/api/lms/assistant/test", { courseId, message });
  return data;
}

export async function askLesson(lessonId: string, question: string): Promise<{ response: string }> {
  const { data } = await api.post(`/api/lms/lessons/${lessonId}/ask`, { question });
  return data;
}

// Regulă automată: o înscriere fără progres nou de prea multe zile e semnalată "stagnantă".
export interface LmsEnrollmentRosterDto {
  id: string;
  progressPercent: number;
  updatedAt: string;
  stalled: boolean;
  user: { id: string; name?: string; email: string };
}

export async function fetchCourseEnrollments(courseId: string): Promise<LmsEnrollmentRosterDto[]> {
  const { data } = await api.get(`/api/lms/courses/${courseId}/enrollments`);
  return data;
}

// --- Proiecte (organizator/tablou de bord — pct. 10, caiet 4.5.8) ---
// Un Proiect grupează mai multe cursuri sub un singur punct de înscriere; un cursant
// se înscrie la proiect, nu curs cu curs (vezi projects.rbac.ts pe backend).

export type LmsProjectAccessMode = "OPEN" | "APPROVAL" | "INVITE_ONLY";
export type LmsProjectProgression = "SEQUENTIAL" | "FREE";
export type LmsProjectEnrollmentStatus = "PENDING" | "ACTIVE" | "REJECTED";

export interface LmsProjectCourseDto {
  id: string;
  projectId: string;
  courseId: string;
  order: number;
  locked: boolean;
  course: { id: string; title: string; description?: string; status: LmsCourseStatus };
}

export interface LmsProjectDto {
  id: string;
  title: string;
  description?: string;
  accessMode: LmsProjectAccessMode;
  progression: LmsProjectProgression;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  courses: LmsProjectCourseDto[];
  myEnrollmentStatus: LmsProjectEnrollmentStatus | null;
}

export async function fetchProjects(): Promise<LmsProjectDto[]> {
  const { data } = await api.get("/api/lms/projects");
  return data;
}

export async function createProject(input: { title: string; description?: string; accessMode: LmsProjectAccessMode; progression: LmsProjectProgression }): Promise<LmsProjectDto> {
  const { data } = await api.post("/api/lms/projects", input);
  return data;
}

export async function fetchProject(id: string): Promise<LmsProjectDto> {
  const { data } = await api.get(`/api/lms/projects/${id}`);
  return data;
}

export async function updateProject(id: string, input: Partial<{ title: string; description: string; accessMode: LmsProjectAccessMode; progression: LmsProjectProgression }>): Promise<LmsProjectDto> {
  const { data } = await api.patch(`/api/lms/projects/${id}`, input);
  return data;
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/api/lms/projects/${id}`);
}

export async function attachExistingCourse(projectId: string, courseId: string): Promise<LmsProjectDto> {
  const { data } = await api.post(`/api/lms/projects/${projectId}/courses`, { courseId });
  return data;
}

export async function attachNewCourse(projectId: string, title: string, description?: string): Promise<LmsProjectDto> {
  const { data } = await api.post(`/api/lms/projects/${projectId}/courses`, { title, description });
  return data;
}

export async function removeProjectCourse(projectId: string, courseId: string): Promise<void> {
  await api.delete(`/api/lms/projects/${projectId}/courses/${courseId}`);
}

export async function reorderProjectCourses(projectId: string, courseIds: string[]): Promise<LmsProjectDto> {
  const { data } = await api.patch(`/api/lms/projects/${projectId}/courses/reorder`, { courseIds });
  return data;
}

export async function enrollInProject(projectId: string): Promise<{ status: LmsProjectEnrollmentStatus }> {
  const { data } = await api.post(`/api/lms/projects/${projectId}/enroll`);
  return data;
}

export interface LmsProjectEnrollmentRosterDto {
  id: string;
  userId: string;
  status: LmsProjectEnrollmentStatus;
  requestedAt: string;
  decidedAt?: string;
  user: { id: string; name?: string; email: string };
}

export async function fetchProjectEnrollments(projectId: string): Promise<LmsProjectEnrollmentRosterDto[]> {
  const { data } = await api.get(`/api/lms/projects/${projectId}/enrollments`);
  return data;
}

export async function decideProjectEnrollment(projectId: string, userId: string, status: "ACTIVE" | "REJECTED"): Promise<void> {
  await api.patch(`/api/lms/projects/${projectId}/enrollments/${userId}`, { status });
}

export async function revokeProjectAccess(projectId: string, userId: string): Promise<void> {
  await api.delete(`/api/lms/projects/${projectId}/enrollments/${userId}`);
}
