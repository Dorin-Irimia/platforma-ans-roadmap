# Modul DMS — Scenariul 1 (Portal / Registratură / Workflow)

Cel mai amplu scenariu. Stare curentă:

- [x] Form Builder (creare formular + logică condițională pe câmpuri) — `forms.routes.ts`
- [x] Mapare formular → entitate „Cerere" (`DmsRequest`) la depunere
- [x] Publicare/retragere formular pe Portal (`POST /forms/:id/publish`, `/unpublish`)
- [x] Registratură electronică (nr. înregistrare automat „NR/AN", metadate, termen legal calculat) — `registry.routes.ts`
- [x] Motor de workflow pe stări+tranziții, model URBIO Workflow Builder (nomenclator global de stări, definiții de flux cu vizibilitate/secțiune/etichete/termen, tranziții cu Șabloane/Validări/Acțiuni/Declanșatori, motor de execuție caz) — `workflow.routes.ts`, `caseEngine.ts`, `deadline.ts` — vezi detaliere mai jos
- [x] Comentarii contextuale cu @mențiuni — `comments.routes.ts`
- [x] Generare document PDF real din template (nu doar text) — `pdf.ts`
- [x] Previzualizare document (react-pdf, randare canvas pagină cu pagină) — `frontend/src/components/PdfPreview.tsx`
- [x] Poziționare interactivă a semnăturii pe pagină (click-to-place, coordonate relative) + ștampilare efectivă pe PDF la semnare — `signature.ts`
- [x] Atașamente binare (upload/descărcare/ștergere, stocare pe disc într-un volum Docker persistent) — `documents.routes.ts`, `shared/storage.ts`
- [x] Editor de șabloane extins (URBIO-style): tip șablon (Formular cerere/Document intern/extern), Titlu+Subtitlu, secțiuni „Formular" + „Alte cerințe", bibliotecă de ~33 tipuri de câmpuri pe 6 categorii (Sistem/General/Timp/Locație/Opțiuni/Aspect), setări complete per câmp (obligatoriu/dezactivat/doar citire, text sugestiv/ajutor, limite, valoare implicită, autocompletare AI) + preview live + condiții de vizibilitate — `frontend/src/pages/FormBuilderPage.tsx`, `frontend/src/features/dms/fieldCatalog.ts`
- [ ] Editor colaborativ documente în timp real (track changes/OT/CRDT) — nu e implementat; rămâne un document static previzualizabil, nu un editor live multi-utilizator
- [ ] Semnătură criptografică PAdES/calificată (certificat digital real) — ștampila aplicată e un mock vizual, suficient pentru scopul demonstrativ, nu o semnătură electronică calificată conform eIDAS
- [x] Câmpurile de sistem sunt acum parțial conectate la motorul de automatizare: tranzițiile de workflow pot avea Validări (5 tipuri: șablon obligatoriu generat, condiție pe câmp, unicitate valoare câmp, bifă manuală, semnătură electronică existentă) și Acțiuni (16 tipuri: alocare utilizator/grup, generare document din șablon de răspuns, termen, etichetă, blocare/arhivare cerere, plus email/notificare/calendar/publicare-Portal simulate, plus 4 acțiuni de integrare reală cu Registrul Sportiv — vezi mai jos) atașate.
- [x] Modul Arhivă (4.5.9) — `archive.routes.ts`: organizare/indexare/căutare pe documente deja digitale, extinde `Document` cu `archiveFolderId`. Dosare cu `stage` (grupare→legare→inventariere→digitizare→indexare→păstrare) și limită de 250 documente/dosar. Fără OCR/ICR real pe scanări fizice — organizează ce e deja digital, nu pipeline-ul fizic de digitizare descris în caiet (2,5 milioane pagini, ISO 14721).
- [x] Documentele au acum și un câmp `extractedText` (populat la creare/generare, înainte de orice criptare la arhivare), folosit exclusiv de modulul Chatbot pentru fundamentare pe Arhivă — vezi `chatbot/README.md`.

## Motorul de workflow pe stări+tranziții (model URBIO Workflow Builder)

Înlocuiește fostul model liniar (listă fixă de pași cu aprobare/respingere pe rol). Structura nouă, oglindită 1:1 din descrierea platformei URBIO furnizată de client:

- **`WorkflowState`** — nomenclator *global*, cu nume unic pe toată platforma (ca în URBIO: odată creată starea „Aprobat”, orice alt flux o poate reutiliza). Fiecare stare are o categorie kanban (De făcut/În progres/Finalizat/Arhivat) și o culoare.
- **`WorkflowDef`** — definiția unui flux: iconiță, nume, descriere, vizibilitate (privat/public), secțiune, etichete, termen implicit + memento-uri (push/email), activ/inactiv.
- **`WorkflowTransition`** — o muchie a grafului de stări (de la o stare, sau START dacă e tranziție de inițiere, la altă stare), cu 3 comutatoare (necesită comentariu/aprobare/notifică petentul) și 4 tipuri de comportament automatizat atașat:
  - **Șabloane** (`WorkflowTransitionTemplate`) — documente (din Editorul de șabloane) legate de tranziție, obligatorii sau nu.
  - **Validări** (`WorkflowValidation`) — blochează tranziția dacă nu sunt îndeplinite.
  - **Acțiuni** (`WorkflowAction`) — rulează automat, în ordine, după ce tranziția e aplicată.
  - **Declanșatori** (`WorkflowTrigger`) — condiții evaluate *leneș* (nu pe un tick real de fundal — vezi scope cut mai jos) care pot avansa automat un caz.
- **`WorkflowCase`/`WorkflowCaseEvent`** — instanța unui flux atașată unei cereri concrete, cu istoricul complet al tranzițiilor aplicate (cine, când, comentariu).

Motorul de execuție (`caseEngine.ts`): `applyTransition()` rulează validările → acțiunile → creează/actualizează cazul → înregistrează evenimentul de istoric → sincronizează `DmsRequest.status` (euristic: numele stării conține „respin” → RESPINS, categorie Finalizat/Arhivat → FINALIZAT, altfel → IN_LUCRU).

**Scope cuts documentate explicit** (pentru onestitate, nu ascunse):
- Canvas-ul de flux din `WorkflowAdminPage` e un desen SVG static, informativ — nu e un editor drag-and-drop de noduri.
- Declanșatorii (Triggers) nu au infrastructură de scheduler/cron — sunt evaluați leneș, la fiecare deschidere a detaliului cererii (`GET /requests/:id` apelează `evaluateAutoTriggers`), nu pe un tick real de fundal. O tranziție cu declanșator + `requiresApproval` sau o validare `MANUAL_CHECKLIST` nu se aplică niciodată automat, tocmai ca să nu ocolească silențios revizuirea umană.
- Acțiunile SEND_EMAIL, SEND_NOTIFICATION, REQUEST_SIGNATURE, PUBLISH_TO_PORTAL, CREATE_CALENDAR_EVENT nu au infrastructură reală (fără mailer/push/calendar/site public în acest demo) — se înregistrează doar în jurnalul de audit, ca simulare (exact ca semnătura electronică „mock” deja documentată mai sus). Restul acțiunilor (alocare utilizator/grup, termen, etichetă, generare document, blocare, arhivare) au efect real, persistat pe `DmsRequest`.
- Acțiunile ISSUE_CIS/ACTIVATE_FACILITY/GRANT_COACH_TITLE/APPROVE_TRANSFER (integrare Registrul Sportiv, vezi `sports-registry/README.md`) au efect real, persistat pe entitățile de domeniu sportiv, nu doar pe `DmsRequest` — aceeași conductă ca GENERATE_DOCUMENT, nu un motor de aprobare paralel.
- Validarea `VALIDATE_TEMPLATE` verifică generarea efectivă doar pentru șabloane de tip „Document extern” (există deja fluxul de generare/semnare PDF); pentru „Formular cerere”/„Document intern” e considerată satisfăcută implicit, pentru că nu există încă un flux de generare propriu legat direct de tranziție.

## Research — inspirație din soluții existente

**UX de poziționare a semnăturii** (DocuSign, PandaDoc): câmpul de semnătură se plasează prin click/drag direct pe pagina previzualizată, apoi se stochează ca poziție *relativă* la pagină (nu în pixeli absoluți), tocmai ca plasarea să rămână corectă indiferent de zoom/rezoluție la care e randat documentul ulterior. Exact acest tipar e implementat în `SignaturePlacement` (xRatio/yRatio/widthRatio/heightRatio) și în `PdfPreview.tsx`.

**Soluții românești de registratură electronică/DMS** (context de piață pentru instituții publice): Regista.ro, eRegistratura.ro/Documenta, registraturaelectronica.ro, CertDigital DMS — toate construite pe același tipar de bază: intrare document → numerotare automată → flux de aprobare configurabil → arhivare, cu accent pe conformitate (Legea 214/2024 privind semnătura electronică, OUG 23/2023 pentru transformarea digitală, finanțare posibilă prin PNRR/POCIDIF). Confirmă alegerea arhitecturală deja făcută în acest modul (entitate cerere + workflow configurabil + document ca entitate cu metadate proprii).

**Randare PDF în React**: `react-pdf` (wrapper peste `pdf.js`) randează fiecare pagină pe un `<canvas>`, ceea ce permite suprapunerea unui overlay absolut-poziționat pentru ștampila de semnătură — spre deosebire de un `<iframe>` cu viewer-ul nativ al browserului, care nu poate fi instrumentat pentru click-uri la coordonate precise pe pagină.

**Generare și editare PDF fără Chromium**: `PDFKit` (generare document nou din template, desenează direct pe „canvas" de PDF) și `pdf-lib` (încarcă un PDF existent și desenează peste el la coordonate exacte — folosit pentru ștampilarea semnăturii) au fost alese explicit în locul unei soluții bazate pe Puppeteer/Chromium headless, care ar fi adăugat ~300 MB la imaginea Docker și ar fi complicat rularea pe Alpine.

## Frontend

`frontend/src/pages/{FormBuilderPage,PortalPage,RegistraturaPage,RequestDetailPage,WorkflowAdminPage}.tsx`, plus componentele reutilizabile `PdfPreview.tsx` (previzualizare + poziționare semnătură) și zona de atașamente (drag & drop, `react-dropzone`) integrată direct în `RequestDetailPage`.

Vezi Scenariul 1 complet în `docs/04-scenariu-demonstrativ.md`.
