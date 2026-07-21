# Modul Chatbot — Scenariul 3

- [x] Auth + roluri (admin = STAFF_ROLES existente vs. utilizator standard) — `rbac.ts`
- [x] Upload document + procesare AI (extragere text PDF/DOCX/TXT) — `documents.routes.ts`, `../../shared/textExtract.ts`
- [x] Fundamentare pe documentele deja arhivate (Arhivă/DMS), doar pentru personal — `archiveContext.ts`
- [x] Template-uri cu variabile ({{NUME}}, {{CNP}}...) — `templates.routes.ts`
- [x] Gestionarea variabilelor (creare/editare/ștergere, parte din CRUD șablon)
- [x] Conversații (creare/mesaje/redenumire/ștergere/căutare) — `conversations.routes.ts`
- [x] Upload fișiere în conversație + extragere informații (context AI)
- [x] Mesaje vocale — transcriere client-side prin Web Speech API (`SpeechRecognition`), persistate cu `inputMethod: VOICE`
- [x] Generare document prin conversație (selectare șablon explicită + completare variabile + PDF real) — `pdf.ts`
- [x] Informare despre documente suplimentare necesare (`requiredAttachments` pe șablon)
- [x] Text-to-Speech pe răspunsuri — client-side, `SpeechSynthesis`

## Arhitectură AI

`shared/ai.ts` — client comun (reutilizat și de LMS) către Groq (`api.groq.com`, format compatibil OpenAI, tier gratuit, hostuiește modele open-weight sub brandul Groq — nu ChatGPT/Gemini/DeepSeek, cerință explicită a caietului). Cheia se stochează în Secret Manager-ul IAM existent, cheie `GROQ_API_KEY`. Fără streaming de tokeni (scope cut asumat).

## Scope cuts documentate explicit

- Imaginile atașate (PNG/JPG) nu au OCR/vision — se stochează, dar fără text extras.
- Fără căutare semantică/embeddings pe baza de cunoștințe — toate documentele cu text extras intră ca context (primele 5, trunchiate), nu doar cele relevante semantic.
- Generarea documentului cere valori explicite pentru variabile (formular în UI), nu parsare automată a chat-ului liber — predictibil pentru demo.
- Fundamentarea pe Arhivă (documente deja arhivate) folosește aceeași euristică naivă de "context stuffing" ca baza de cunoștințe (fără embeddings/căutare semantică), dar cu o regulă suplimentară: injectăm context din Arhivă **doar** dacă mesajul utilizatorului conține cuvinte-cheie care se regăsesc în numele fișierului/dosarului sau în textul extras — spre deosebire de baza de cunoștințe (care injectează mereu cele mai recente 5), pentru că Arhiva poate conține volum mare de documente instituționale, nu un corpus mic curat de admin.
- Fundamentarea pe Arhivă e disponibilă **doar pentru conturi de personal** (aceleași `STAFF_ROLES` ca la Arhivă/DMS) — un cetățean obișnuit poate folosi chatbot-ul normal, dar nu primește niciodată conținut din Arhivă în răspuns, ca să nu se scurgă date staff-only către publicul larg prin chat.
- Textul e extras o singură dată, la încărcare/generare (înainte de criptarea la arhivare) — documentele arhivate **înainte** de această modificare rămân fără text extras (fără backfill retroactiv în acest demo); doar documentele noi, încărcate/generate după introducerea acestei funcționalități, sunt disponibile ca sursă pentru chatbot.
- După ștampilarea semnăturii (SIGNED_RESPONSE), textul extras rămâne cel din varianta nesemnată — nu se re-extrage, pentru că ștampila nu modifică substanțial conținutul relevant pentru context.

## Frontend

`frontend/src/pages/ChatbotPage.tsx` (tab-uri Conversații/Documente/Șabloane) + `frontend/src/features/chatbot/{api,speech}.ts`.
