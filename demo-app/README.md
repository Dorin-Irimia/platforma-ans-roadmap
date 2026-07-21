# Demo App — Scenariul de Demonstrație Obligatoriu ANS

Prototip funcțional care acoperă cele 5 scenarii obligatorii din Capitolul 8 al Caietului de Sarcini (vezi [../docs/04-scenariu-demonstrativ.md](../docs/04-scenariu-demonstrativ.md) și [../Roadmap_Demo_Scenarii.html](../Roadmap_Demo_Scenarii.html)).

## Scenarii acoperite

1. **IAM/Securitate** (`backend/src/modules/iam`) — autentificare, 2FA, RBAC, audit trail, secret manager.
2. **DMS/Portal/Registratură/Workflow** (`backend/src/modules/dms`) — form builder, registratură electronică, motor de workflow, semnătură electronică.
3. **Business Intelligence** (`backend/src/modules/bi`) — dashboard-uri, interogare NL2SQL.
4. **Chatbot/Asistent Virtual** (`backend/src/modules/chatbot`) — conversații, upload fișiere, voce, generare documente.
5. **LMS/CNFPA** (`backend/src/modules/lms`) — CMS cursuri, evaluări, asistent de învățare AI.

## Stack tehnic

- Backend: Node.js + TypeScript (Express/NestJS) — API REST, un modul per scenariu.
- Frontend: React (Vite) + TypeScript.
- Bază de date: PostgreSQL (via Prisma ORM).
- Rulare locală: Docker Compose.

## Pornire pe un dispozitiv nou

### Ce trebuie instalat

- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (include Docker Compose) — tot ce rulează (backend, frontend, Postgres, Redis) pornește în containere; nu trebuie instalat Node.js, PostgreSQL sau Redis direct pe calculator.
- **Git**.

### Pași

1. **Clonează repo-ul**
   ```bash
   git clone https://github.com/Dorin-Irimia/platforma-ans-roadmap.git
   cd platforma-ans-roadmap/demo-app
   ```

2. **Creează un proiect Supabase propriu** (gratuit) — aplicația nu are un sistem de autentificare propriu, folosește [Supabase Auth](https://supabase.com/dashboard) pentru login/2FA. Fiecare instalare (fiecare dispozitiv/persoană) are nevoie de propriul proiect Supabase — nu se poate reutiliza cel al altcuiva, cheile sunt legate de proiect.
   - Mergi pe [supabase.com/dashboard](https://supabase.com/dashboard) → **New project** (planul gratuit e suficient).
   - După ce proiectul e gata, mergi la **Settings → API** — de acolo iei valorile de la pasul următor.

3. **Copiază fișierele `.env.example` în `.env`**
   ```bash
   cp backend/.env.example backend/.env
   cp frontend/.env.example frontend/.env
   ```
   Fișierele `.env` conțin chei reale/secrete, sunt excluse din git (`.gitignore`) — nu le comite niciodată. Fișierele `.env.example` rămân în repo ca șablon, fără valori reale.

4. **Completează valorile Supabase în cele două `.env`** (restul valorilor din `.env.example` — `DATABASE_URL`, `REDIS_URL`, `PORT` — sunt deja corecte pentru Docker Compose, nu le schimba):
   - `backend/.env`: `SUPABASE_URL` (Project URL), `SUPABASE_ANON_KEY` (cheia "anon public"), `SUPABASE_SERVICE_ROLE_KEY` (cheia "service_role" — are acces complet la baza de date Supabase, fără RLS; e un secret, nu-l expune niciodată public).
   - `frontend/.env`: `VITE_SUPABASE_URL` și `VITE_SUPABASE_ANON_KEY` — **exact aceleași valori** `SUPABASE_URL`/`SUPABASE_ANON_KEY` ca în `backend/.env` (același proiect Supabase, nu unul diferit). Cheia "anon public" e proiectată să fie expusă în client (protejată de RLS), nu e un secret ca `service_role`.
   - `ROEID_CLIENT_ID`/`ROEID_CLIENT_SECRET` (backend) — opționale, lasă-le goale; fără acordul oficial cu ADR, autorizarea RoEID va fi respinsă oricum (client neînregistrat), dar restul aplicației funcționează normal.

5. **Pornește aplicația**
   ```bash
   docker compose up --build
   # backend:  http://localhost:4000
   # frontend: http://localhost:5173
   ```
   Nu sunt necesare migrări manuale — la fiecare pornire, containerul de backend sincronizează automat schema Postgres (`prisma db push`) înainte de a porni serverul. Documentele generate/atașate se scriu într-un volum Docker persistent (`documents_storage`), deci rămân disponibile și după `docker compose down`/`up` (dispar doar la `docker compose down -v`).

6. **Creează primul cont** — deschide http://localhost:5173, „Creează unul", înregistrează-te. Primul cont înregistrat în sistem devine automat Super Admin (acces la Utilizatori, Jurnal de audit, Securitate, Secrete); conturile ulterioare primesc rolul standard.

7. **(Opțional) Activează funcțiile AI** — Chatbot-ul, NL2SQL-ul din BI și asistentul LMS au nevoie de o cheie [Groq](https://console.groq.com/keys) (gratuită). Se configurează **din aplicație**, nu într-un fișier `.env`: loghează-te ca admin → **Securitate → Secrete** → adaugă cheia cu numele `GROQ_API_KEY`. E stocată criptat în baza de date, prin secret manager-ul IAM.

## Stare curentă

- **IAM/Securitate** (Scenariul 4) — complet funcțional: înregistrare, autentificare, 2FA (TOTP cu QR code), RBAC granular, blocare cont după tentative eșuate, schimbare rol, jurnal de audit cu filtrare, secret manager. Interfață: dashboard, administrare utilizatori, jurnal de audit, securitatea contului.
- **DMS/Portal/Registratură/Workflow** (Scenariul 1) — funcțional: editor de șabloane extins (formular cerere/document intern/extern, secțiuni, ~33 tipuri de câmpuri pe 6 categorii, condiții de vizibilitate, preview live — model URBIO), Portal public de depunere, registratură electronică cu numerotare automată și termen legal calculat, motor de workflow pe stări+tranziții (model URBIO Workflow Builder: nomenclator global de stări, definiții de flux cu vizibilitate/secțiune/etichete/memento-uri, tranziții cu Șabloane/Validări/Acțiuni/Declanșatori, canvas SVG al grafului, istoric complet de evenimente per caz), comentarii cu @mențiuni, generare document PDF real din template cu previzualizare (react-pdf), poziționare interactivă a semnăturii pe pagină (click-to-place, ca în DocuSign/PandaDoc) + ștampilare efectivă la semnare (pdf-lib), atașamente binare (upload/descărcare/ștergere, stocare persistentă pe disc). Nu include: editor colaborativ de documente în timp real (track changes/OT), semnătură criptografică PAdES calificată (e un mock vizual), scheduler/cron real pentru declanșatorii de workflow (evaluați leneș, la citire), și un editor drag-and-drop de noduri pentru graful de flux (canvas-ul e o randare SVG statică) — vezi `backend/src/modules/dms/README.md` pentru research și detalii complete, inclusiv toate scope cut-urile documentate explicit.
- **Business Intelligence** (Scenariul 2) — funcțional: 3 dashboard-uri analitice (Conformitate/Termene, Flux documente, Volum de lucru) cu KPI-uri și grafice bar/line/pie (recharts), calculate din date reale (`DmsRequest`/`User`/`Group`), nu simulate; interogare NL2SQL în limba română (bibliotecă fixă de 9 intenții, clasificare pe cuvinte-cheie, interogare Prisma reală + SQL echivalent afișat pentru transparență); rapoarte salvate reutilizabile cu re-execuție live (nu instantaneu static). Nu include: generare de SQL arbitrar printr-un LLM (risc de injecție fără sandboxing serios — vezi `backend/src/modules/bi/README.md` pentru justificare completă).
- **Chatbot, LMS** (Scenariile 3, 5) — încă neimplementate; vezi checklist-urile din `backend/src/modules/{chatbot,lms}/README.md`.

## Design system

Paleta de culori, tipografia (Bricolage Grotesque pentru titluri, Plus Jakarta Sans pentru text) și componentele vizuale (carduri rotunjite, pill-uri de status, buton cu gradient portocaliu) sunt preluate din repo-ul `Aplicatie-mobile-stocare-informatii-autovehicule` (Dorin-Irimia), pentru consistență vizuală între aplicații.

- Tokens: [frontend/src/theme.ts](./frontend/src/theme.ts)
- Stiluri globale: [frontend/src/index.css](./frontend/src/index.css)
- Componente reutilizabile: [frontend/src/components/ui.tsx](./frontend/src/components/ui.tsx)
