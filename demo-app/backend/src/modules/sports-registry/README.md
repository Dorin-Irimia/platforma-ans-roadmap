# Modul Registrul Sportiv — 4.5.3 (Federații/Cluburi) + 4.5.4 (Sportivi/Antrenori) + 4.5.5 (Baze Sportive)

- [x] Federații/asociații județene/ligi (`SportsFederation`, câmp `orgType` — nu modele separate) + cluburi afiliate (`SportsClub`) — `federations.routes.ts`, `clubs.routes.ts`
- [x] Istoric schimbări (sediu/denumire) — model generic `OrgHistoryEntry`, reutilizat pentru FEDERATION/CLUB/FACILITY
- [x] Calendar competițional versionat — `CompetitionCalendarVersion`, fiecare publicare = versiune nouă imuabilă
- [x] CIS (Certificat de Identitate Sportivă) — `SportsIdentityCertificate`, emis/suspendat/retras, cu `issuingAuthority` (ANS/DJST)
- [x] Evidența taxelor cu blocare acces la neplată — `SportsClub.duesUpToDate`
- [x] Sportivi (`Athlete`, CNP unic) + istoric competiții/rezultate + antrenori (`Coach`) cu certificări + titlu de antrenor emerit
- [x] Viză medicală cu blocare automată a eligibilității (verificare leneșă la citire, fără scheduler) — `GET /athletes/:id/eligibility`
- [x] Import în masă CSV (nu Excel, scope cut asumat) — `POST /athletes/import`
- [x] Ștergere GDPR prin anonimizare (nu ștergere fizică) — `POST /athletes/:id/gdpr-erase`, `POST /coaches/:id/gdpr-erase`
- [x] Baze sportive (`SportsFacility`, categorii B1-B9) — fără ștergere fizică, doar tranziții de status, cu flag `isMajorChange` pe istoricul de modificări

## Integrare reală cu motorul de Workflow (nu un motor de aprobare paralel)

Emiterea CIS, aprobarea unui transfer de sportiv, omologarea unei baze sportive și acordarea titlului de antrenor emerit sunt **cereri reale în Registratură** (`createInternalRequest()` — `formId: null`, dar altfel identice cu orice cerere din Portal), care trec printr-un `WorkflowCase` real. Motorul existent (`dms/caseEngine.ts`) a fost extins cu 4 tipuri noi de `ActionType`: `ISSUE_CIS`, `ACTIVATE_FACILITY`, `GRANT_COACH_TITLE`, `APPROVE_TRANSFER` — fiecare citește datele relevante din `DmsRequest.data` (același tipar ca `GENERATE_DOCUMENT`) și scrie efectiv pe entitatea de domeniu la aplicarea tranziției finale. Verificat end-to-end: creare federație → cerere CIS → flux Workflow → certificat emis real; sportiv → cerere transfer → flux Workflow → `Athlete.clubId` schimbat real.

## Scope cuts documentate explicit

- Fără portal de auto-servire cu cont propriu pentru federații/cluburi — ANS administrează direct toate entitățile (STAFF_ROLES existente); un RBAC scoped-per-entitate ar necesita o extindere semnificativă a IAM.
- „Max o asociație/ramură/județ" — validat la nivel de aplicație (normalizare lowercase+trim), nu printr-un unique index parțial (Prisma nu suportă asta nativ).
- Notificările automate (expirare viză medicală etc.) sunt verificări leneșe + audit log, nu email/push real — exact ca restul acțiunilor simulate deja documentate în `dms/README.md`.
