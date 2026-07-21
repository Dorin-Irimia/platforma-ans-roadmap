# Modul LMS — Scenariul 5 (CNFPA)

- [x] Asistent de învățare voce-text RO + bază de cunoștințe (context = conținutul lecției) — `assistant.routes.ts` (`POST /lessons/:id/ask`)
- [x] RBAC (Autor/Evaluator existente în IAM) + blocare/deblocare cont — zero cod nou, reutilizează `AdminUsersPage`/`setUserRole`/`setUserActive`
- [x] Configurare motor AI (cheie API prin Secret Manager existent + `AiSettings` pentru modelul implicit) — `iam/routes.ts` (`/ai-settings`)
- [x] Audit & securitate (filtrare jurnale existente + `RATE_LIMIT_TRIGGERED` nou pe login) — `express-rate-limit` în `iam/routes.ts`
- [x] CMS: creare proiect, generare AI structură material, editor drag-and-drop — `ai.routes.ts`, `LmsCourseEditorPage.tsx`
- [x] Asistență AI text (rescrie/extinde/rezumă/adaptează) + Text-to-Speech (client-side) — `ai.routes.ts` (`/ai/rewrite`), `BlockEditor.tsx`
- [x] Colaborare (co-autor, comentarii, rubrică evaluare) — `collaboration.routes.ts`, `ReviewPanel.tsx`
- [x] Responsive Desktop/Tabletă/Mobil + Previzualizare — comutator lățime în `LmsCourseEditorPage.tsx`
- [x] Reluare curs de unde a rămas (sync cross-device) — `LmsEnrollment` (unic per curs+utilizator), `enrollment.routes.ts`
- [x] Evaluări + „Barieră Logică" — scor calculat mereu server-side, verificare pe *ultima* tentativă — `quiz.routes.ts`, `lessons.routes.ts` (`/lessons/access`)
- [x] Intenții personalizabile (ecran real de creare/editare) + „flux conversațional" (pași fallback) + panou de test — `assistant.routes.ts`, `AssistantPanel.tsx`
- [x] Editor de text bogat (bold/italic/underline/titluri/liste/tabele) pentru blocurile TEXT — TipTap, `BlockEditor.tsx` (`TextBlockEditor`)
- [x] Raport agregat de răspunsuri la teste, per curs — `quiz.routes.ts` (`GET /courses/:id/quiz-report`), `LmsCourseEditorPage.tsx` (tab „Rapoarte")
- [x] Quiz cu răspunsuri multiple corecte (checkbox, nu doar o singură opțiune) — `LmsQuizQuestion.correctIndexes`, scorare pe potrivire exactă de set

## Arhitectură AI

Reutilizează `shared/ai.ts` (același client Groq ca la Chatbot) — cerință explicită a caietului la acest scenariu: „configurare cheie API prin Secret Manager, selectare model de limbaj implicit", deci un API extern configurabil e chiar cerut, nu interzis (spre deosebire de Scenariul 3, care exclude explicit ChatGPT/Gemini/DeepSeek).

## Model de conținut

Lecțiile stochează conținutul ca listă ordonată de blocuri (`Json`): `TEXT`/`IMAGE`/`VIDEO`/`QUIZ`. Blocul `QUIZ` înglobează întrebările, răspunsurile corecte și scorul minim necesar pentru deblocarea lecției următoare — nu există modele Prisma separate per tip de bloc (scop asumat: destul de flexibil pentru demo, fără supra-normalizare).

## Scope cuts documentate explicit

- Reordonarea lecțiilor și a blocurilor de conținut (text/imagine/video/quiz) din interiorul unei lecții folosește `@dnd-kit` (accesibil — tastatură + touch, nu doar mouse) — `LmsCourseEditorPage.tsx`, `BlockEditor.tsx`. Anterior era doar drag-and-drop HTML5 nativ, doar la nivel de lecție.
- Editorul de blocuri nu are undo/redo la nivel de lecție (doar undo/redo intern al editorului TipTap, per bloc de text) sau autosave — salvare explicită per lecție.
- Comentariile (`LmsComment.blockId`) sunt o cheie în JSON-ul lecției, fără FK — pot rămâne orfane dacă blocul e șters/reordonat.
- Fără notificări reale (email/push) la invitarea unui co-autor.
- Blocul TEXT stochează HTML (scris cu editorul TipTap), nu text simplu — `LessonBlock.text` rămâne `string` (fără schimbare de schemă, tot `Json`), doar semantica se schimbă. Randarea read-only (`LessonBlocksView.tsx`) sanitizează cu DOMPurify înainte de `dangerouslySetInnerHTML` — necesar din motive de securitate (conținut scris de un autor/co-autor, văzut de cursanți).
- Rescrierea AI a unei selecții de text (`Rescrie`/`Adaptează`/`Extinde`/`Rezumă`) extrage text simplu din intervalul selectat (`editor.state.doc.textBetween`) și îl reintroduce ca text simplu — formatarea din intervalul înlocuit nu se păstrează. Comportament așteptat, nu un bug: TipTap/ProseMirror nu au un echivalent de „offset de caracter într-un string" pentru text formatat.
- Quiz cu răspunsuri multiple corecte: scorarea unei întrebări cere ca setul de opțiuni bifate de cursant să coincidă EXACT cu setul de răspunsuri corecte — fără punctaj parțial pentru un subset corect. Întrebările vechi, salvate doar cu `correctIndex` (un singur index, dinainte de această funcționalitate), sunt citite ca `[correctIndex]` — fără migrare de date necesară (JSON, nu coloană de schemă).
- Raportul de răspunsuri agregă doar *ultima* încercare a fiecărui cursant per test (aceeași regulă ca la Bariera Logică) — încercările anterioare, deși păstrate în `LmsQuizAttempt`, nu intră în agregare.

## Frontend

`frontend/src/pages/{LmsCoursesPage,LmsCourseEditorPage,LmsCoursePlayerPage}.tsx` + `frontend/src/components/lms/{LessonBlocksView,BlockEditor,QuizPlayer,ReviewPanel,AssistantPanel}.tsx` + `frontend/src/features/lms/api.ts`.
