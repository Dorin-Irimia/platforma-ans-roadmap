# Modul BI — Scenariul 2

- [x] 3 dashboard-uri analitice (Conformitate/Termene, Flux documente, Volum de lucru) — KPI-uri + grafice bar/line/pie, calculate din date reale (`DmsRequest`/`User`/`Group`), nu simulate — `metrics.ts`, `bi.routes.ts`, `frontend/src/pages/BiDashboardPage.tsx`
- [x] NL2SQL: interogare în limbaj natural (română) → intenție potrivită dintr-o bibliotecă fixă → interogare Prisma reală + SQL echivalent afișat pentru transparență → rezultat tabelar/grafic — `nl2sql.ts`
- [x] Salvarea rezultatelor interogărilor într-o zonă de „Rapoarte salvate" reutilizabilă — nu un instantaneu static, ci re-execuție live la fiecare afișare (`BiSavedReport`, `GET /reports/:id/data`)

## Arhitectură

- **`metrics.ts`** — interogări agregate Prisma (`groupBy`/`count`/`aggregate`) reutilizate atât de dashboard-urile predefinite cât și de motorul NL2SQL, o singură sursă de adevăr per metrică.
- **`nl2sql.ts`** — bibliotecă de 9 intenții (întârzieri pe categorie/domeniu, distribuție status/categorie/domeniu, volum în timp, volum de lucru pe utilizator/grup, backlog, timp mediu de soluționare), fiecare cu propriile cuvinte-cheie (normalizate fără diacritice) pentru clasificare. Fiecare intenție rulează o interogare Prisma reală și generează un string SQL echivalent, afișat utilizatorului pentru transparența mecanismului.
- **`bi.routes.ts`** — rutele HTTP: 3 dashboard-uri, `POST /nl2sql`, CRUD pentru rapoarte salvate (`BiSavedReport`).

## Scope cut documentat explicit (onestitate, nu ascuns)

NL2SQL **nu** e un LLM care generează și execută SQL arbitrar. Alegerea e deliberată: a lăsa un model de limbaj să producă SQL neconstrâns pe baza de date de producție ar fi un risc real de injecție/exfiltrare, fără o infrastructură serioasă de sandboxing pe care acest demo nu o are. În schimb, întrebarea e clasificată contra unei liste fixe de intenții (scor pe cuvinte-cheie), iar interogarea efectivă rulează prin Prisma (parametrizat, deci sigur) — stringul SQL arătat utilizatorului e o reprezentare fidelă a interogării reale executate, nu SQL interpretat direct din text liber. Aceasta e exact varianta permisă explicit de cerințe: „acceptă și variante semi-automate, cu explicarea mecanismului". Dacă întrebarea nu se potrivește cu nicio intenție cunoscută, sistemul răspunde onest că nu a înțeles-o și oferă exemple.

„Timpul mediu de soluționare" e o aproximare: nu există un câmp dedicat `resolvedAt` pe `DmsRequest`, deci se calculează din diferența `updatedAt - registeredAt` pentru cererile `FINALIZAT` — documentat explicit ca aproximare, nu o valoare exactă.

## Frontend

`frontend/src/pages/BiDashboardPage.tsx` — 4 tab-uri (Conformitate/Termene, Flux documente, Volum de lucru, Interogări & Rapoarte), grafice cu `recharts` (Bar/Line/Pie), stil URBIO.
