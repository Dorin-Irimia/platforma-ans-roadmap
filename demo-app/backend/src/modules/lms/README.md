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

## Arhitectură AI

Reutilizează `shared/ai.ts` (același client Groq ca la Chatbot) — cerință explicită a caietului la acest scenariu: „configurare cheie API prin Secret Manager, selectare model de limbaj implicit", deci un API extern configurabil e chiar cerut, nu interzis (spre deosebire de Scenariul 3, care exclude explicit ChatGPT/Gemini/DeepSeek).

## Model de conținut

Lecțiile stochează conținutul ca listă ordonată de blocuri (`Json`): `TEXT`/`IMAGE`/`VIDEO`/`QUIZ`. Blocul `QUIZ` înglobează întrebările, răspunsurile corecte și scorul minim necesar pentru deblocarea lecției următoare — nu există modele Prisma separate per tip de bloc (scop asumat: destul de flexibil pentru demo, fără supra-normalizare).

## Scope cuts documentate explicit

- Reordonarea lecțiilor e drag-and-drop HTML5 nativ, nu o librărie dedicată.
- Editorul de blocuri nu are undo/redo sau autosave — salvare explicită per lecție.
- Comentariile (`LmsComment.blockId`) sunt o cheie în JSON-ul lecției, fără FK — pot rămâne orfane dacă blocul e șters/reordonat.
- Fără notificări reale (email/push) la invitarea unui co-autor.

## Frontend

`frontend/src/pages/{LmsCoursesPage,LmsCourseEditorPage,LmsCoursePlayerPage}.tsx` + `frontend/src/components/lms/{LessonBlocksView,BlockEditor,QuizPlayer,ReviewPanel,AssistantPanel}.tsx` + `frontend/src/features/lms/api.ts`.
