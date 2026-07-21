# Scenariul sesiunii demonstrative obligatorii (Capitolul 8, pag. 299–306)

**Aceasta este cea mai importantă descoperire pentru planificarea muncii imediate.** Caietul de sarcini impune, ca element de CALIFICARE a ofertei (nu opțional), o demonstrație funcțională înregistrată video, depusă odată cu oferta tehnică în SEAP. Dacă un ofertant nu poate demonstra punct cu punct oricare dintre cerințele de mai jos, **oferta este respinsă ca neconformă**.

## Reguli obligatorii pentru înregistrarea video

- Se filmează/captează întregul ecran — câmpuri și butoane vizibile și lizibile.
- Mișcările mouse-ului suficient de lente pentru a putea fi urmărite.
- Descriere audio obligatorie, sincronizată cu imaginea, a fiecărei acțiuni.
- Redabil pe PC standard cu Windows 10 + Windows Media Player.
- Se încarcă în SEAP odată cu oferta (nu link-uri externe/streaming).
- Nu se acceptă prezentări generale — trebuie demonstrate scenariile punct cu punct.
- Autoritatea Contractantă poate solicita reluarea sesiunii online, în etapa de evaluare.
- Nu necesită configurare pe procesele specifice ANS — doar funcționalitățile de bază standard ale platformelor ofertate.

---

## Scenariul 1 — Management Documente / Portal / Registratură / Workflow

Validează: configurare dinamică formulare, integrare Portal–Back-Office, registratură electronică, motor de workflow, colaborare pe documente, generare răspunsuri oficiale, semnătură electronică.

Cerințe tehnice de demonstrat (în ordine):
1. Accesarea interfeței de administrare + crearea unui formular nou printr-un Form Builder (Smart Form Builder).
2. Definirea logicii condiționale într-un formular (ex: câmp selector Persoană Fizică/Juridică → activează câmpuri suplimentare precum CUI).
3. Maparea câmpurilor formularului public pe entitatea internă „Cerere" din Back-Office (minim 3 câmpuri critice: Nume, E-mail, CUI).
4. Publicarea instantanee a formularului pe Portalul Web, cu sincronizare Back-Office ↔ Portal în timp real.
5. Accesarea Portalului și localizarea formularelor publicate, cu diferențiere comportament utilizatori autentificați/neautentificați.
6. Parcurgerea fluxului asistat de completare (logică condițională, eliminare câmpuri redundante, validare câmpuri obligatorii cu mesaje de eroare).
7. Integrarea nativă Portal → Back-Office: creare automată entitate „Cerere", mapare date, generare notificări/task-uri interne.
8. **Registratură Electronică**: listă documente noi, generare automată nr. înregistrare/dată/oră/tip/sursă.
9. Completare metadate suplimentare (categorie, domeniu, termen legal) + asociere documente atașate fără descărcare locală.
10. Inițiere flux de lucru direct din registratură (acțiunea „Inițiază Workflow").
11. **Motor de workflow**: selectare automată flux predefinit după tipul documentului, alocare automată task-uri pe compartiment, calcul automat termene (excluzând zile nelucrătoare), vizualizare grafică a diagramei de workflow.
12. Acces securizat la conținut fără descărcare locală (viewer/editor web PDF/Word) + editare colaborativă simultană (track changes, comentarii) de către 2+ utilizatori.
13. Comunicare contextuală: comentarii și mențiuni (@user) pe documente.
14. Generarea răspunsului oficial dintr-un template standard, cu auto-completare câmpuri dinamice.
15. Flux decizional de aprobare: trimitere automată spre aprobare, aprobare/respingere cu observații de către manager.
16. **Semnătură electronică**: semnare document aprobat, înregistrare automată în registratura de ieșire, publicare răspuns în contul utilizatorului din Portal + notificare email.

## Scenariul 2 — Business Intelligence

Validează: dashboard-uri analitice, interogare în limbaj natural (NL2SQL), reutilizarea rezultatelor.

Cerințe tehnice de demonstrat:
1. Prezentarea a minim 3–4 dashboard-uri analitice, acoperind: conformitate/încălcări termene (trend, breakdown departament), flux/volum documente (status, tip, perioadă), workload (volum per utilizator/echipă, backlog). Grafice bar/line/pie + KPI numerici (date pot fi simulate).
2. **NL2SQL**: utilizatorul pune întrebări în limba română (ex: „Care departament are cele mai multe întârzieri?"), sistemul generează/sugerează automat o interogare și afișează rezultatul tabelar/grafic (acceptă și variante semi-automate, cu explicarea mecanismului).
3. Salvarea rezultatelor/graficelor din interogări ad-hoc într-o zonă de „rapoarte/widget-uri salvate" sau în dashboard-uri existente.

## Scenariul 3 — Chatbot / Asistent Virtual AI

Validează: autentificare + roluri, management documente, template-uri, gestionare conversații (fișiere, voce), generare documente prin conversație, text-to-speech.

Cerințe tehnice de demonstrat:
1. Înregistrare cont nou (nume, prenume, email, parolă) + autentificare ulterioară + creare sesiune.
2. Sistem de roluri: cont administrator vs. utilizator standard, cu acces diferențiat (admin: gestionare clienți, documente, configurare AI; user: doar conversații + profil propriu).
3. Managementul documentelor de către admin: încărcare document (PDF/DOC/DOCX), procesare automată, disponibilizare pentru AI.
4. Crearea template-urilor de documente cu variabile (ex: {{NUME}}, {{ADRESA}}, {{CNP}}).
5. Gestionarea variabilelor: creare, editare, ștergere.
6. Gestionarea conversațiilor: creare conversație nouă, trimitere mesaje, salvare în BD, redenumire, ștergere, căutare istoric.
7. Încărcarea fișierelor în conversație (PDF, PNG/JPG, text) + extragere informații de către chatbot.
8. Mesaje vocale: înregistrare, trimitere, conversie automată voce→text pentru procesare AI.
9. Generare documente prin conversație: identificare template, preview document, solicitare date pentru variabile, generare document final.
10. Informarea utilizatorului despre documente suplimentare necesare (ex: copie CI) + posibilitatea de încărcare directă în conversație.
11. Text-to-Speech: conversia răspunsului AI în audio, redare către utilizator.

## Scenariul 4 — Securitate / IAM

Validează: serviciu de identitate unificat, fluxuri de autentificare configurabile, RBAC granular, audit trail, secret management.

Cerințe tehnice de demonstrat:
1. Serviciu de identitate unificat: creare/modificare/suspendare/ștergere conturi + gestionare apartenență la grupuri.
2. Configurabilitate fluxuri de autentificare: user/parolă, 2FA (SMS/OTP), integrare eIDAS/ROeID, parametrizare politici (durată sesiune, complexitate parolă, blocare după tentative eșuate).
3. RBAC granular la nivel de resurse și acțiuni, cu roluri predefinite/personalizate (Super Admin, Admin Instituție, Moderator, Evaluator, Autor, Co-autor, Utilizator standard).
4. Jurnal de audit (audit trail) detaliat și imuabil: autentificări (reușite/eșuate), modificări politici, creări/modificări/ștergeri resurse, schimbări roluri; filtrare și căutare avansată.
5. Gestionare centralizată și securizată a secretelor (chei API, certificate, credențiale) prin Secret Manager, pentru infrastructură/Kubernetes și fluxuri aplicative.

## Scenariul 5 — LMS (platforma CNFPA)

Validează: asistent de învățare AI, CMS conținut, RBAC, configurare motor AI, monitorizare/securitate, colaborare, compatibilitate mobilă, experiența cursantului.

Cerințe tehnice de demonstrat:
1. Asistent de învățare cu interfață hibridă voce-text în română: întrebare în limbaj natural + răspuns; creare bază de cunoștințe + interogare la nivel de lecție.
2. Configurare setări de bază chatbot (limbă, preferințe interacțiune).
3. Încărcare/adaptare model de limbaj preantrenat + terminologie specifică domeniului.
4. Creare/personalizare intenții (intents) pe scenarii comune (ex: „resetare parolă").
5. Configurare răspunsuri și fluxuri conversaționale.
6. Testare/optimizare interacțiuni chatbot.
7. RBAC: acces panou administrare, creare utilizator cu rol specific (Autor/Evaluator), blocare/deblocare instant cont.
8. Configurare motor AI: acces setări AI, configurare cheie API prin Secret Manager, selectare model de limbaj implicit.
9. Monitorizare & securitate: tab Audit & Securitate, filtrare jurnale, simulare/vizualizare evenimente de securitate (autentificări eșuate, rate limiting).
10. CMS: Organizator/tablou de bord, creare proiect nou, generare automată AI a structurii unui material, editor drag-and-drop.
11. Asistență AI integrată: rescrie/adaptează/extinde/rezumă text selectat; generare fișier audio (Text-to-Speech) dintr-un text.
12. Colaborare: invitare Co-autor, panou de revizuire, comentarii contextuale, rezolvare comentarii, rubrică de evaluare (feedback structurat).
13. Compatibilitate mobilă: comutare vizualizare Desktop/Tabletă/Mobil (responsive), mod Previzualizare.
14. Experiența cursantului: autentificare, accesare curs publicat, reluare de unde a rămas (sincronizare progres cross-device).
15. Evaluări & bariere logice: parcurgere test cu feedback imediat corect/greșit; „Barieră Logică" ce blochează avansarea fără scorul minim la testul anterior.

---

## Corespondența scenariilor cu modulele platformei (secțiunea 4.5)

| Scenariu demo | Modul(e) platformă corespondente |
|---|---|
| 1. DMS/Portal/Registratură/Workflow | Portal Public ANS (4.5.1) + Registratură–Management documente (4.5.2) |
| 2. Business Intelligence | Rapoarte Business Intelligence (4.5.12) |
| 3. Chatbot/Asistent Virtual | Chatbot/Asistent Virtual (4.5.11) |
| 4. Securitate/IAM | Managementul utilizatorilor și accesul la sistem (4.10.1) — transversal tuturor modulelor |
| 5. LMS | Modul CNFPA (4.5.8) |

## De ce contează pentru planul de lucru

Aceste 5 scenarii sunt cerințele **minime, necondiționate** — trebuie demonstrate cu o soluție funcțională (COTS configurat sau prototip propriu), indiferent de restul proiectului de 24 de luni. Ele reprezintă cel mai mic set de funcționalități care trebuie construite/configurate ACUM, înaintea oricărei alte activități de dezvoltare, pentru a susține o ofertă conformă sau o demonstrație de capabilitate.
