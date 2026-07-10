# Cerințe funcționale și module (secțiunile 4.4–4.5.13 din Caietul de Sarcini)

Sursă: Caiet de sarcini Platf. rev (1).pdf (326 pagini), secțiunile analizate acoperă paginile ~27–148.

---

## 4.4 Cerințe funcționale ale sistemului

**Scop:** digitalizarea serviciilor, activităților și proceselor ANS în relația cu federațiile, cluburile, sportivii, bazele sportive și competițiile. Țintă: grad de sofisticare 4 din 5 (tranzacționare completă online: decizie, notificare, livrare, plată).

**Capabilități generale:** managementul ciclului de viață pentru federații, cluburi, sportivi, baze sportive, competiții, rezultate, formare antrenori, artefacte istorice; fluxuri interne pentru Certificatul de Identitate Sportivă (CIS); management contracte de finanțare federații; auto-actualizare date de către federații/cluburi; Pașaport Sportiv/Antrenor pe portal; generare automată Anuarul Sportului; digitalizare Galeria Marilor Sportivi (inclusiv tur virtual-muzeu); omologare baze sportive; procese CNFPA.

**Tabelul serviciilor publice de digitalizat (11 servicii)** — printre care: Eliberare CIS (Registrul Structurilor Sportive, HG 576/2023), Eliberare Carnet Maestru/Antrenor Emerit (Ordinul MTS 1072/2016), Aprobare organizare competiții internaționale, Răspuns petiții (Registratură), Eliberare Pașaport Sportiv/Antrenor (ANS & INCS, Ordin ANS 302/2023), Programare vizită Galeria Marilor Sportivi (Ordin MTS 734/2015), 4 servicii CNFPA (certificat absolvire, carnete antrenor, certificat clasificare profesională, recunoaștere calificări UE/SEE/state terțe).

**8 servicii descrise succint:** registratură digitală, CIS (federații/cluburi/alte structuri), Registrul sportivilor și antrenorilor (cu Pașaport Sportiv și Pașaport Antrenor), Registrul bazelor sportive, Anuarul sportului, Galeria Marilor Sportivi, servicii CNFPA, arhivare electronică (arhivă istorică de 500 ml).

**Principii de proiectare:** legalitate, arhitectură pe niveluri, arhitectură bazată pe servicii (SOA), date sigure (canale autorizate), securitate informațională, transparență, expansibilitate, scalabilitate, simplitate/ergonomie, integritate/plenitudine/veridicitate date.

**Cerințe non-funcționale/conformitate legală:** Decizia ADR 815/2022 (accesibilitate), Legea 232/2022 (accesibilitate produse/servicii), Legea 354/2022 (interzicere antivirus rusesc), NIS2/OUG 155/2024 (securitate cibernetică extinsă la administrația centrală).

---

## 4.5 Arhitectura funcțională a sistemului — Introducere

**13 module componente:** Portal Public ANS, Registratură–Management documente, Registrul Sportiv–Federații și Cluburi, Registrul Sportivilor și Antrenorilor, Registrul Bazelor Sportive, Anuarul Sportului, Galeria Marilor Sportivi, CNFPA, Arhivare electronică, Administrativ, Chatbot/Asistent Virtual, Rapoarte BI, Aplicații de mobil.

**Roluri/conturi cross-modul:** Sportiv (istoric, transfer, dezafiliere); Personal Federație Sportivă (Admin/Utilizator — drepturi cluburi, calendar, sportivi, ramuri); Personal Club Sportiv (Admin/Utilizator — drepturi sportivi); Personal ANS (Administrator, Utilizator Managerial, Utilizator); Personal CNFPA (Administrator, Utilizator CNFPA); Galeria Marilor Sportivi (Admin/Utilizator — artefacte, bilete online).

---

## 4.5.1 Modul Portal Public ANS

**Scop:** ecosistem digital centralizat, Front-office (portal web, transmitere/primire electronică documente, notificări status) + zone cu acces controlat pentru stakeholderi.

**Cerințe funcționale cheie:**
- Autentificare cu email ca identificator unic; Servicii Electronice Complete vs. Parțiale (ridicare document la ghișeu).
- Formulare web cu pre-populare automată din profil; generare PDF automat identic cu formularul tipizat oficial.
- Spațiu Privat Virtual (SPV) — "My Account": documente reutilizabile, istoric interacțiuni.
- Notificări automate status solicitare prin email; feedback/rating per serviciu.
- Chatbot cu NLP propriu, antrenabil — interzisă explicit integrarea cu ChatGPT/Gemini/DeepSeek.
- Funcționalități muzeu: bilete online cu cod unic, calcul automat preț.

**Cerințe tehnice:** soluție COTS licențiată perpetuu, utilizatori nelimitați; integrare Portal↔back-office prin Web Services (SOAP/REST); SSL/TLS; GDPR; Form Builder drag-and-drop; generare documente cu template-uri; CMS notificări cu placeholder-uri; baze de date suportate: MySQL, MS SQL Server, Oracle, PostgreSQL; browsere: Edge, Firefox, Safari, Chrome.

---

## 4.5.2 Modul Registratură – Management documente

**Scop:** sistem de ticketing instituțional — numerotare automată, evidență status, DMS complet, conectare cu Arhiva și Modulul Administrativ.

**Metadate cheie registratură (Tabel 2):** Nr. înreg., Data înregistrării, Modalitate adresare, Nume/Calitate petent, Subiect, Domeniu, Status L544 (Legea 544/2001), Termen legal răspuns (calcul automat), Responsabil, Adresă internă, Nr. ieșire, Modalitate comunicare răspuns, Reclamație/plângere (flag risc).

**3 module tehnice obligatorii de la același producător (COTS):**
1. **Depozit și captură documente**: depozit centralizat, organigramă instituțională configurabilă, indexare + Full-Text Search, OCR asincron (formate MS Office, XML, PDF, JPEG, TIFF, BMP), semnătură electronică cu flux de etape configurabil (Aprobare/Avizare/Dependențe), editor WYSIWYG colaborativ (Track Changes, Versioning, Operational Transformation/CRDT), scanare cu ICR pentru scris de mână, export JSON/DOCX/PDF/A.
2. **Registratură electronică**: număr înregistrare automat configurabil, cod unic verificare document pentru petent, integrare email (preluare directă atașamente), termene cu calcul automat (zile calendaristice/lucrătoare), suspendare termen cu istoric dedicat, rapoarte Excel/CSV/PDF, integrare API cu sisteme externe, RBAC, conformitate GDPR.
3. **Fluxuri de lucru**: motor workflow standard BPMN 2.0, configurare fără cod sursă, drag & drop, sarcini secvențiale/paralele, escaladare automată, respingere cu comentarii obligatorii, delegări pentru concediu, semnătură electronică per etapă, integrare API la orice etapă a fluxului.

---

## 4.5.3 Modul Registrul Sportiv – Federații și Cluburi

**Scop:** înregistrare/administrare federații naționale, cluburi (mono/polisportive), asociații județene, ligi profesioniste. Bază legală: Legea Sportului 69/2000. Condiție funcționare legală: Certificatul de Identitate Sportivă (CIS), tipărit de Imprimeria Națională, eliberat de ANS.

**Cerințe funcționale cheie:**
- **Federații:** afiliere cluburi/asociații cu istoric, schimbare sediu/denumire cu istoric, CIS (emis/suspendat/retras), calendar competițional versionat, transferuri sportivi (definitiv/temporar), liste sportivi pentru competiții internaționale cu flux de aprobare, date pentru Anuarul Sportului.
- **Cluburi:** creare cont prin portal cu flux de aprobare configurabil, afiliere la federații, vize medicale cu notificări automate la expirare și blocare automată participare la competiții fără viză validă, evidența taxelor cu blocare acces la neplată.
- **Asociații județene**: max o asociație/ramură/județ; Direcțiile Județene pentru Sport pot emite CIS pentru structuri fără personalitate juridică; rezultate transmise automat federației naționale.
- **Ligi profesioniste:** aviz obligatoriu ANS la înființare; transferuri cu verificare eligibilitate.
- Radiere/investigare cluburi închise cu date de la ANAF, judecătorii.

**Integrare obligatorie:** Registratura Electronică + Motorul de Workflow pentru toate procesele; ANS are doar drepturi read-only asupra activităților federațiilor/cluburilor.

---

## 4.5.4 Modul Registrul Sportivilor și Antrenorilor

**Scop:** Registrul Național conform Ordinul ANS 302/2023, administrat de INCS (Institutul Național de Cercetare pentru Sport) ca împuternicit al ANS. La momentul redactării: >100.000 sportivi activi, 4.619 cluburi afiliate.

**Cerințe funcționale cheie:**
- CNP ca identificator unic național pentru sportivi și antrenori.
- Cont public sportiv (creat de sportiv sau tutore legal pentru minori): transfer între cluburi, dezafiliere, istoric competiții/rezultate.
- Import în masă din Excel/CSV; ștergere date conform GDPR.
- Registrul Antrenorilor administrat de federații + ANS: calificări, certificări, serviciu public "Pașaport Antrenor", titlu de antrenor emerit prin flux configurabil.
- Antrenor asociat cu sportivi, cluburi, federații, competiții și baze sportive.

---

## 4.5.5 Modul Registrul Bazelor Sportive

**Scop:** ANS are rol de suport/coordonare (nu de omologare directă — aceasta revine federațiilor sportive). La redactare: 63 baze sportive omologate. Particularitate: o bază neomologată poate funcționa fără restricții (spre deosebire de cluburi).

**Clasificare (9 categorii B1–B9):** de la domeniul public/privat al statului (subordine ANS, CJ/CL, alte departamente) până la baze desființate/reamenajate (B9).

**Cerințe funcționale cheie:**
- Structură detaliată UPS (Unități de Practicare Sportivă): construcții acoperite (săli specializate pe sport, piscine, patinoar, velodrom), terenuri în aer liber (stadioane, piste atletism/ciclism, poligoane, pârtii schi), construcții complementare (cazare, vestiare, administrativ).
- Workflow ciclu de viață complet (inițiere-validare-aprobare-publicare); fără ștergere fizică — doar dezactivare cu istoric.
- Diferențiere actualizări minore vs. majore (schimbare statut juridic/stare funcțională).
- Coordonare cu direcțiile sportive județene și Consiliile Locale/Județene.

---

## 4.5.6 Modul Anuarul Sportului

**Scop:** publicație oficială anuală (statistici, clasamente), sursă pentru Institutul Național de Statistică.

**Cerințe funcționale cheie:**
- Generare automată, exclusiv pe date validate de la federații/cluburi (fără calcul manual); recalculare la modificarea surselor.
- Clasamente: pe federații (probe olimpice/neolimpice), pe județe, individual sportivi, unități sportive (ANS vs. Ministerul Educației), pe medalii, categorii vârstă.
- Validare pre-publicare cu semnalarea automată a datelor lipsă; marcare "Provizoriu"/"Validat"/"Oficial"; versiuni istorice.
- Almanah Online: dashboard public cu hartă interactivă a României, profil public automat sportiv/antrenor, export PDF/Excel.

---

## 4.5.7 Modul Galeria Marilor Sportivi

**Scop:** conservare patrimoniu sportiv — >10.000 artefacte, dintre care ~7.000 necesită atenție deosebită (piese fragile, sub Legea 182/2000 și Legea 311/2003 privind bunurile culturale mobile).

**Cerințe funcționale cheie:**
- Management vizite: bilete online cu cod QR, capacitate maximă configurabilă per interval orar.
- Tur virtual: navigare interactivă, ghid audio, integrare materiale din Arhiva TVR.
- Digitalizare: fotografiere 2D (min. 12 MP, format JPEG/PNG web + TIFF arhivă) și 3D multi-unghi ("spin view").
- Expoziții digitale configurabile; multilingvism minim RO+EN.

---

## 4.5.8 Modul CNFPA

**Scop:** formare/perfecționare/certificare antrenori, curriculă cu federațiile, platforme acreditate de Ministerul Muncii.

**Cerințe funcționale cheie:**
- Fluxuri: certificate absolvire, carnete antrenor, certificate clasificare profesională, atestate recunoaștere profesională (UE/SEE/Elveția/state terțe), Protocoale de Formare tripartite (ANS-Federație-CNFPA).
- Platformă LMS COTS completă: Authoring Tool drag-and-drop, min. 25 șabloane interactive, generare AI a lecțiilor/testelor, asistent de învățare AI cu hartă de cunoștințe, SCORM export, evaluări complexe cu bancă de întrebări, monetizare (PayPal/Stripe), WCAG 2.1.
- Roluri: Admin, Tutor, Student, Super Admin ANS.

---

## 4.5.9 Modul Arhivă

**Scop:** stocare/gestionare documente pe termen lung, conformitate Legea 135/2007, Legea 201/2024, Ordinul MCID 20717/2024, standarde ISO 14721 (OAIS), ISO 15489, ISO/IEC 27001, GDPR.

**Cerințe tehnice:** soluție COTS, criptare, autentificare multifactorială, indexare automată (CNP, tip document), OCR, interoperabilitate cu DMS, stocare cloud cu migrare ulterioară spre Cloudul Guvernamental.

**Servicii de arhivare fizică (proiect de digitizare):**
- Arhivă fizică ANS: 2.274 metri liniari total; se scanează 500 ml = ~9.850 bibliorafturi ≈ 2,5 milioane pagini (90% A4, 10% A3+).
- Autorizații necesare: Arhivele Naționale, ISU, Autoritatea Rutieră Română (transport), acreditare administrator arhivă electronică.
- Flux complet: preluare/transport → grupare → constituire dosare (max 250 file/dosar) → legare (coduri de bare) → inventariere → digitizare (rezoluție min. 300 dpi, format PDF/PDF searchable) → indexare structurată (max 5 indecși/unitate, export XML) → indexare full-text OCR → păstrare (SLA: 4 ore transmitere digitală urgentă, 24 ore/5 zile livrare fizică; microclimat 15-24°C, 50-60% umiditate).

---

## 4.5.10 Modul Administrativ

**Scop:** gestionare utilizatori/roluri, entități (federații/cluburi/sportivi/antrenori), documente, comunicare internă, audit.

**Cerințe funcționale cheie:**
- Gestiune utilizatori: permisiuni granulare per modul, autentificare 2FA (Google Authenticator/Email/SMS).
- Rapoarte BI: nr. sportivi activi, evoluție în timp, dashboard-uri analitice.
- Integrare OCR pentru extragere automată date din documente (CI, cazier judiciar).
- Notificări automate configurabile (ex. expirare viză medicală).
- Audit complet: IP, browser, endpoint, valori anterioare/noi, autentificări eșuate.

---

## 4.5.11 Chatbot/Asistent Virtual

**Scop:** răspunsuri automate bazate pe informații publice din Registrul Sportiv, Registrul Sportivilor/Antrenorilor, Registrul Bazelor Sportive, Anuarul Sportului.

**Cerințe tehnice:**
- COTS, disponibilitate 24/7, NLP + NLG, identificare stare emoțională a utilizatorului.
- Model AI local/mediu controlat — exclude explicit ChatGPT, Gemini sau servicii publice similare.
- Verificare preliminară completitudine documente încărcate; interacțiune vocală posibilă.
- Cerință de metodologie de gestionare a riscurilor AI; conformitate SR ISO/IEC 42001:2024 — avantaj tehnic, nu obligatoriu.

---

## 4.5.12 Rapoarte Business Intelligence

**Scop:** înlocuirea rapoartelor manuale .xls/.doc (lunar/trimestrial/semestrial/anual) transmise de Direcții Județene pentru Sport, Cluburi, Complexuri sportive naționale, INCS, CNFPA, Galeria Marilor Sportivi.

**Cerințe funcționale/tehnice cheie:**
- ETL automatizat, data warehouse/data mart, funcționalități GIS (hartă interactivă, distribuție teritorială).
- Configurator vizual de rapoarte fără SQL; livrare automată prin email (zilnic/săptămânal/lunar).
- Modul analitic avansat DMS: model STAR SCHEMA, scoruri (Efficiency, Delay, Throughput, Approval Quality), grafice: Donut, Line, Bar, Heatmap, Histogram, Funnel, Sankey, Radar, Calendar Heatmap.
- Modul AI/NLP pentru interogare BI: generare automată SQL din limbaj natural, chat NLP local (interzis ChatGPT/Gemini), interogări read-only.

---

## 4.5.13 Aplicații de mobil

**Scop:** expunere pe mobil a părților publice ale portalului, module sportivi/structuri sportive, asistent virtual. Platforme: Android și iOS.

**4.5.13.1 Aplicație mobilă portal:**
- Registrul Sportiv, CIS (depunere/urmărire), calendar competiții, Registrul Sportivilor/Antrenorilor, ghid baze sportive.
- Modul Muzeu: rezervări, bilete cu QR, tur digital/virtual.
- Modul CNFPA: catalog cursuri, player mobil, certificate digitale, carnet antrenor electronic.
- Modul Finanțare/Sponsorizare: flux digital complet aplicare granturi, număr unic înregistrare, status în timp real.
- Modul Transparență financiară; asistent virtual integrat (NLP propriu).
- Publicare/actualizare conform politicilor Google Play și Apple App Store (responsabilitate prestator).

**4.5.13.2 Aplicație mobilă DMS dedicată** (exclusiv utilizatori interni):
- Autentificare biometrică (amprentă/Face ID), workflow aprobare documente, scanare cu camera, notificări push.
- Securitate: HTTPS/TLS, criptare locală, timeout sesiune, ștergere automată date la deconectare.
- Publicare ca aplicație privată.

---

## Observații transversale importante pentru planificarea proiectului

1. **Tipar arhitectural comun**: entitate centrală cu identificator unic (CNP/email) → workflow configurabil (inițiere-validare-aprobare) → istoric/audit complet → RBAC → integrare obligatorie cu Registratura Electronică/Motorul de Workflow.
2. **Certificatul de Identitate Sportivă (CIS)** este elementul central recurent (federații, cluburi, ligi) — tipărit de Imprimeria Națională.
3. **Interdicție explicită repetată** (Portal, Chatbot, BI): integrare AI cu ChatGPT/Gemini/DeepSeek — cerință fermă de model AI propriu/local, antrenabil.
4. **Actori externi/instituționali menționați explicit**: Imprimeria Națională, ANAF, judecătorii, INCS, Direcțiile Județene pentru Sport, Consiliile Locale/Județene, Arhivele Naționale, ISU, Autoritatea Rutieră Română, Ministerul Muncii (acreditare CNFPA), Institutul Național de Statistică, Arhiva TVR, Cloudul Guvernamental, Google Play/Apple App Store.
5. **Volume de date concrete utile pentru estimarea efortului**: >100.000 sportivi, 4.619 cluburi, 63 baze sportive omologate, >10.000 artefacte muzeu (~7.000 speciale), 2,5 milioane pagini de arhivat (500 din 2.274 ml totali).
