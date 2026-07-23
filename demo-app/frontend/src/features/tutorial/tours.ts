// Registrul tururilor ghidate — un tur per scenariu obligatoriu din
// `docs/04-scenariu-demonstrativ.md`, cu pași ce țintesc id-uri DOM stabile adăugate
// explicit pe elementele relevante. Dacă un pas nu găsește elementul țintă (rol care
// nu-l vede, sau ecran nedeschis încă — ex. un câmp neconfigurat încă), `TutorialOverlay`
// NU sare automat pasul — arată textul explicativ fără spotlight și așteaptă (nimic nu
// trebuie omis din secvență, cerință explicită). Vezi `TutorialContext.tsx`.
export interface TourStep {
  targetId: string; // "" pentru pași fără element real de arătat (gap sau pas pre-autentificare)
  title: string;
  description: string;
  // Rută statică cunoscută — motorul navighează automat, imediat, fără să aștepte un click
  // (ex. trecerea de la un tab la o altă pagină din același scenariu).
  autoRoute?: string;
  // "$capturedPath" = revino la ultima rută dinamică vizitată în acest tur (vezi mai jos).
  // Rută (posibil dinamică, ex. "/registratura/:id") pe care motorul NU navighează singur —
  // arată elementul de pe pagina curentă pe care userul trebuie să apese el însuși (ex. un
  // rând din tabel), și avansează automat abia când `location.pathname` chiar ajunge acolo.
  // Prima dată când o rută dinamică se potrivește, calea exactă e reținută ("capturată") ca
  // să poată fi refolosită mai târziu în tur via `autoRoute: "$capturedPath"`.
  awaitRoute?: string;
  gap?: boolean; // true = funcționalitate neimplementată încă — semnalat onest, fără spotlight
}

export interface Tour {
  id: string;
  label: string;
  route: string;
  roles?: string[]; // dacă lipsește, vizibil oricărui cont autentificat
  steps: TourStep[];
}

const STAFF_ROLES = ["SUPER_ADMIN", "ADMIN_INSTITUTIE", "MODERATOR", "EVALUATOR", "AUTOR", "CO_AUTOR"];
const ADMIN_ROLES = ["SUPER_ADMIN", "ADMIN_INSTITUTIE"];
// Aceleași roluri ca CREATOR_ROLES din LmsCoursesPage.tsx — cine poate crea efectiv un curs.
const LMS_CREATOR_ROLES = ["SUPER_ADMIN", "ADMIN_INSTITUTIE", "AUTOR", "CNFPA"];

// Id DOM stabil pentru linkul din sidebar corespunzător unei rute — folosit atât la
// randarea sidebar-ului (`AppShell.tsx`) cât și la pasul sintetic de navigare de mai jos,
// ca să existe o singură sursă de adevăr pentru derivare (nu duplicăm string-ul în 2 locuri).
export function navIdForRoute(route: string): string {
  return `nav-link-${route === "/" ? "dashboard" : route.slice(1).replace(/\//g, "-")}`;
}

// Fiecare tur începe cu acest pas sintetic (nu e stocat în `TOURS`, ca să nu repetăm
// boilerplate-ul în fiecare tur): arată exact pe ce link din meniul din stânga trebuie
// apăsat pentru a ajunge la modulul respectiv. Vezi `TutorialContext.tsx` pentru logica
// de avans automat când userul chiar apasă linkul din sidebar.
export function buildNavStep(tour: Tour): TourStep {
  return {
    targetId: navIdForRoute(tour.route),
    title: "Deschide modulul",
    description: `Apasă pe „${tour.label}” în meniul din stânga pentru a continua.`,
    awaitRoute: tour.route,
  };
}

export const TOURS: Tour[] = [
  {
    id: "scenariul-1",
    label: "Scenariul 1 — Documente / Portal / Registratură / Workflow",
    route: "/form-builder",
    roles: ADMIN_ROLES,
    steps: [
      {
        targetId: "form-builder-new-btn",
        title: "Pct. 1 — Form Builder",
        description: "Accesează interfața de administrare și creează un formular nou printr-un Form Builder (Smart Form Builder).",
      },
      {
        targetId: "form-builder-add-condition-btn",
        title: "Pct. 2 — Logică condițională",
        description: "Selectează un câmp existent și deschide „Condiții de vizibilitate”: definește o regulă (ex. un câmp selector Persoană Fizică/Juridică → activează un câmp suplimentar precum CUI).",
      },
      {
        targetId: "form-builder-mapping-card",
        title: "Pct. 3 — Mapare pe entitatea „Cerere”",
        description: "Ecranul explicit de mapare: „Nume” și „E-mail” sunt mereu colectate automat (din cont/formularul petentului); pentru CUI (sau Telefon/Adresă), mapează un câmp custom pe rolul canonic din select-ul fiecărui câmp — cardul arată clar ce e mapat și ce nu.",
      },
      {
        targetId: "form-builder-publish-btn",
        title: "Pct. 4 — Publicare pe Portal",
        description: "Apasă „Publică” pe un formular — devine instant vizibil pe Portalul Web (Portalul reîncarcă lista la fiecare accesare, deci sincronizarea Back-Office ↔ Portal e imediată).",
      },
      {
        targetId: "portal-tab-forms",
        autoRoute: "/portal",
        title: "Pct. 5 — Portalul public",
        description: "Formularele publicate apar aici, în tab-ul „Formulare disponibile”. Comportamentul diferă după autentificare: un cont autentificat vede „Depui ca {nume}” și cererea apare în „Cererile mele”; un vizitator neautentificat completează nume/email manual și nu poate urmări online cererea.",
      },
      {
        targetId: "portal-submit-btn",
        title: "Pct. 6 — Completare asistată",
        description: "Deschide un formular („Completează”) — câmpurile condiționale apar/dispar automat, câmpurile obligatorii sunt marcate cu *, iar o eroare clară apare dacă lipsesc date la trimitere. Apasă „Depune cererea”.",
      },
      {
        targetId: "portal-success-msg",
        title: "Pct. 7 — Integrare automată Portal → Back-Office",
        description: "Confirmarea numărului de înregistrare dovedește integrarea nativă: la depunere se creează automat entitatea „Cerere” în Back-Office, cu toate datele mapate — fără nicio acțiune manuală suplimentară.",
      },
      {
        targetId: "registratura-table",
        autoRoute: "/registratura",
        title: "Pct. 8 — Registratură Electronică",
        description: "Cererea nou-depusă apare aici, cu număr de înregistrare, dată/oră, tip și sursă generate automat de platformă.",
      },
      {
        targetId: "registratura-first-row",
        awaitRoute: "/registratura/:id",
        title: "Pct. 9 — Metadate și atașamente",
        description: "Dă click pe un rând pentru a deschide o cerere. Acolo vei găsi metadatele suplimentare (categorie, domeniu, termen legal, deja completate din formular) și cardul „Atașamente”, unde documentele se vizualizează/adaugă direct în browser, fără descărcare locală.",
      },
      {
        targetId: "request-detail-workflow-card",
        title: "Pct. 10 — Inițiază Workflow",
        description: "Secțiunea „Flux de lucru” din pagina cererii permite inițierea directă a unui flux — butonul disponibil poartă numele tranziției configurate (ex. „Aplică: Trimite spre evaluare”).",
      },
      {
        targetId: "workflow-diagram",
        autoRoute: "/workflow-admin",
        title: "Pct. 11 — Motorul de workflow",
        description: "Deschide un flux existent din listă pentru a vedea diagrama grafică a stărilor și tranzițiilor. Selectarea automată a fluxului după tipul documentului, alocarea pe compartiment și calculul termenelor sunt configurate ca acțiuni pe fiecare tranziție (tab „Acțiuni”).",
      },
      {
        targetId: "",
        gap: true,
        title: "Pct. 12 — Editare colaborativă simultană",
        description: "Neimplementat încă — există doar un viewer PDF read-only (fără editare, fără track changes, fără sesiuni simultane 2+ utilizatori). Menționează verbal acest lucru sau omite pasul la înregistrare.",
      },
      {
        targetId: "request-detail-comments",
        autoRoute: "$capturedPath",
        title: "Pct. 13 — Comentarii și mențiuni",
        description: "Scrie un comentariu folosind @nume pentru a menționa un coleg — mențiunile sunt reținute și asociate cererii.",
      },
      {
        targetId: "request-detail-response-generate-btn",
        title: "Pct. 14 — Generare răspuns oficial",
        description: "Alege un șablon standard și apasă „Generează” — câmpurile dinamice (nume, date ale cererii) se completează automat în documentul rezultat.",
      },
      {
        targetId: "request-detail-workflow-card",
        title: "Pct. 15 — Flux decizional de aprobare",
        description: "Aprobarea/respingerea cu observații se realizează tot prin tranziții de workflow (secțiunea „Flux de lucru”), restricționate server-side la rolurile Moderator/Admin Instituție/Super Admin — numele exact al tranziției e cel configurat de admin (ex. „Aprobă”/„Respinge”).",
      },
      {
        targetId: "request-detail-sign-btn",
        title: "Pct. 16a — Semnătură electronică",
        description: "Apasă „Semnează electronic” — documentul aprobat primește automat un număr din registratura de ieșire.",
      },
      {
        targetId: "request-detail-send-btn",
        title: "Pct. 16b — Publicare + notificare",
        description: "Apasă „Trimite petentului” — răspunsul devine vizibil în contul petentului din Portal („Cererile mele”). Notificarea email e simulată (înregistrată în jurnalul de audit), nu există trimitere SMTP reală în acest mediu demo.",
      },
    ],
  },
  {
    id: "scenariul-2",
    label: "Scenariul 2 — Business Intelligence",
    route: "/bi",
    roles: STAFF_ROLES,
    steps: [
      {
        targetId: "bi-tab-compliance",
        title: "Pct. 1 — Dashboard-uri analitice",
        description: "4 dashboard-uri (peste minimul de 3-4 cerut): „Conformitate/Termene” (trend + breakdown pe categorie), „Flux documente” (status/tip/perioadă), „Volum de lucru” (per utilizator/echipă) și „Scoruri avansate” — grafice bar/line/pie + KPI numerici.",
      },
      {
        targetId: "bi-tab-queries",
        title: "Pct. 2a — Interogări în limbaj natural",
        description: "Deschide tab-ul „Interogări & Rapoarte”.",
      },
      {
        targetId: "bi-query-btn",
        title: "Pct. 2b — NL2SQL",
        description: "Scrie o întrebare în română (ex. „Care categorie are cele mai multe întârzieri?”) — sistemul generează interogarea și afișează rezultatul tabelar/grafic, cu SQL-ul generat afișat transparent (secțiunea „SQL generat”).",
      },
      {
        targetId: "bi-save-report-btn",
        title: "Pct. 3 — Salvare rapoarte",
        description: "După o interogare reușită, salveaz-o în „Rapoarte salvate” — reaccesibilă oricând, cu date live (nu un instantaneu static).",
      },
    ],
  },
  {
    id: "scenariul-3",
    label: "Scenariul 3 — Chatbot / Asistent Virtual AI",
    route: "/chatbot",
    steps: [
      {
        targetId: "",
        title: "Pct. 1 — Cont nou și autentificare",
        description: "Se demonstrează separat, ÎNAINTE de acest tur: deconectează-te, deschide „Creează cont” (nume, email, parolă), apoi autentifică-te — se creează o sesiune reală. Revino aici după login pentru a continua turul.",
      },
      {
        targetId: "chatbot-tab-documents",
        title: "Pct. 2 — Sistem de roluri",
        description: "Doar conturile administrator/personal văd tab-urile Documente/Șabloane/Variabile/Automatizări — un cont standard vede exclusiv Conversații și propriul profil. (Dacă acest tab nu apare pentru contul curent, chiar asta demonstrează diferențierea.)",
      },
      {
        targetId: "chatbot-documents-dropzone",
        title: "Pct. 3 — Management documente (admin)",
        description: "Încarcă un document (PDF/DOC/DOCX) — se procesează automat (extragere text) și devine disponibil ca sursă de informații pentru AI.",
      },
      {
        targetId: "chatbot-template-new-btn",
        title: "Pct. 4 — Șabloane cu variabile",
        description: "Creează un șablon de document folosind variabile de forma {{NUME}}, {{ADRESA}}, {{CNP}} în conținut.",
      },
      {
        targetId: "chatbot-variable-create-btn",
        title: "Pct. 5 — Gestionare variabile",
        description: "Creează, editează sau șterge variabile din registrul reutilizabil — un șablon le referă doar prin cheie.",
      },
      {
        targetId: "chatbot-new-conversation-btn",
        title: "Pct. 6 — Gestionare conversații",
        description: "Creează o conversație nouă, trimite mesaje (salvate automat), redenumește sau șterge o conversație existentă, ori caută în istoric.",
      },
      {
        targetId: "chatbot-attach-btn",
        title: "Pct. 7 — Fișiere în conversație",
        description: "Atașează un fișier (PDF, PNG/JPG sau text) direct în conversație — chatbotul extrage informațiile din el pentru a răspunde.",
      },
      {
        targetId: "chatbot-mic-btn",
        title: "Pct. 8 — Mesaje vocale",
        description: "Înregistrează un mesaj vocal — transcrierea voce→text se face automat în browser înainte de trimitere spre procesare AI.",
      },
      {
        targetId: "chatbot-generate-document-btn",
        title: "Pct. 9 — Generare document prin conversație",
        description: "Alege un șablon, completează variabilele cerute, previzualizează textul final, apoi confirmă generarea documentului.",
      },
      {
        targetId: "chatbot-required-attachments-note",
        title: "Pct. 10 — Documente suplimentare necesare",
        description: "Dacă șablonul ales necesită documente suplimentare (ex. copie CI), utilizatorul e informat aici și le poate atașa direct în conversație.",
      },
      {
        targetId: "chatbot-tts-btn",
        title: "Pct. 11 — Text-to-Speech",
        description: "Apasă iconița de redare de lângă un răspuns al asistentului — conversia text→audio se redă imediat către utilizator.",
      },
    ],
  },
  {
    id: "scenariul-4",
    label: "Scenariul 4 — Securitate / IAM",
    route: "/admin",
    roles: ["SUPER_ADMIN"],
    steps: [
      {
        targetId: "admin-invite-btn",
        title: "Pct. 1 — Serviciu de identitate unificat",
        description: "Creează un cont nou („+ Invită angajat”). Pe aceeași pagină: schimbă rolul (select-ul din tabel), blochează/deblochează sau șterge un cont, și gestionează apartenența la grupuri (cardul „Grupuri” mai jos).",
      },
      {
        targetId: "admin-policy-card",
        title: "Pct. 2a — Politici de autentificare",
        description: "Parametrizează durata sesiunii, complexitatea parolei și blocarea după tentative eșuate.",
      },
      {
        targetId: "security-enable-2fa-btn",
        autoRoute: "/security",
        title: "Pct. 2b — 2FA",
        description: "Activează autentificarea în doi factori. Există 2 canale: aplicație TOTP (Google/Microsoft Authenticator) și, mai jos pe aceeași pagină, Email OTP ca al doilea canal — notă: caietul cere explicit „SMS/OTP”, iar aici al doilea canal e prin email, nu SMS.",
      },
      {
        targetId: "login-eidas-btn",
        autoRoute: "/login",
        title: "Pct. 2c — Integrare eIDAS/RoEID",
        description: "Butonul pornește un flux OIDC real către sso.beta.roeid.ro (RoEID e schema românească notificată la Comisia Europeană ca mijloc eIDAS). Autorizarea va eșua fără un client_id oficial emis de ADR — o dependență externă platformei, nu o lipsă de implementare.",
      },
      {
        targetId: "admin-role-select",
        autoRoute: "/admin",
        title: "Pct. 3 — RBAC granular",
        description: "Rolurile predefinite (Super Admin, Admin Instituție, Moderator, Evaluator, Autor, Co-autor, Utilizator standard) se schimbă instant din acest select, per cont.",
      },
      {
        targetId: "audit-filter-btn",
        autoRoute: "/audit",
        title: "Pct. 4 — Jurnal de audit",
        description: "Filtrează jurnalul imuabil de audit (autentificări, modificări politici, creări/modificări/ștergeri, schimbări de rol) după acțiune, resursă, status sau interval de dată.",
      },
      {
        targetId: "secrets-save-btn",
        autoRoute: "/secrets",
        title: "Pct. 5 — Secret Manager",
        description: "Salvează o cheie/secret (ex. o cheie API) — stocat criptat (AES-256-GCM), gestionat centralizat pentru infrastructură și fluxuri aplicative.",
      },
    ],
  },
  {
    id: "scenariul-5",
    label: "Scenariul 5 — LMS (platforma CNFPA)",
    route: "/lms",
    roles: ["SUPER_ADMIN"],
    // Notă: doar Scenariul 1 cere explicit ordine strictă în document; aici pașii sunt
    // regrupați pe navigare (organizator → editor curs → admin/audit/secrete → editor →
    // vizualizare cursant), nu în ordinea numerică — titlul fiecărui pas indică punctul
    // exact din caiet, ca să rămână ușor de urmărit alături de document în timpul înregistrării.
    steps: [
      {
        targetId: "lms-new-course-btn",
        title: "Pct. 10a — CMS: organizator + curs nou",
        description: "Tabloul de bord LMS listează toate cursurile (organizatorul). Creează un curs nou.",
      },
      {
        targetId: "lms-first-course-card",
        awaitRoute: "/lms/courses/:id",
        title: "Pct. 10b — Deschide editorul",
        description: "Dă click pe un curs pentru a intra în editor.",
      },
      {
        targetId: "lms-generate-structure-btn",
        title: "Pct. 10c — Generare structură AI",
        description: "Descrie subiectul (sau încarcă un fișier) — AI generează automat structura de lecții a materialului.",
      },
      {
        targetId: "lms-editor-lesson-row",
        title: "Pct. 10d — Editor drag-and-drop",
        description: "Reordonează lecțiile trăgându-le în listă (mâner de tip GripVertical).",
      },
      {
        targetId: "lms-editor-tab-asistent",
        title: "Pct. 2 — Setări de bază chatbot",
        description: "Deschide tab-ul „Asistent” — configurează limba și tonul (preferințe de interacțiune).",
      },
      {
        targetId: "lms-assistant-save-settings-btn",
        title: "Pct. 2 (continuare) — Salvare setări",
        description: "Salvează setările de bază ale asistentului.",
      },
      {
        targetId: "lms-assistant-resources-dropzone",
        title: "Pct. 3 — Terminologie + adaptare model",
        description: "Glosarul de terminologie (mai sus) + materiale pentru adaptare aici: încarcă un document — textul extras fundamentează real răspunsurile asistentului (nu antrenează un model separat, nu există infrastructură ML pentru asta, dar chiar influențează conversațiile, verificabil).",
      },
      {
        targetId: "lms-assistant-new-intent-btn",
        title: "Pct. 4 — Intenții personalizate",
        description: "Creează o intenție nouă pe un scenariu comun (ex. „resetare parolă”), cu fraze declanșator și mod de răspuns (fix sau generat de AI).",
      },
      {
        targetId: "lms-assistant-fallback-input",
        title: "Pct. 5 — Răspunsuri și fluxuri conversaționale",
        description: "Pașii de flux conversațional / fallback, configurabili aici (câte un pas pe linie).",
      },
      {
        targetId: "lms-assistant-test-btn",
        title: "Pct. 6 — Testare / optimizare",
        description: "Scrie un mesaj de test — vezi ce intenție s-a potrivit și răspunsul generat, direct în panou.",
      },
      {
        targetId: "admin-invite-btn",
        autoRoute: "/admin",
        title: "Pct. 7 — RBAC",
        description: "Creează un utilizator cu rol Autor sau Evaluator. Pe aceeași pagină, select-ul de rol din tabel schimbă rolul instant, iar butonul „Blochează”/„Deblochează” suspendă/reactivează contul imediat.",
      },
      {
        targetId: "lms-ai-model-select",
        autoRoute: "$capturedPath",
        title: "Pct. 8 — Configurare motor AI",
        description: "Cardul „Motor AI” (tab Asistent) — selectează modelul de limbaj implicit dintr-o listă predefinită sau introdu unul custom; cheia API rămâne configurabilă prin Secret Manager (link direct din card).",
      },
      {
        targetId: "audit-filter-btn",
        autoRoute: "/audit",
        title: "Pct. 9a — Monitorizare & securitate (audit)",
        description: "Filtrează jurnalul de audit — inclusiv evenimente de securitate reale (autentificări eșuate, rate limiting) alături de restul acțiunilor.",
      },
      {
        targetId: "security-enable-2fa-btn",
        autoRoute: "/security",
        title: "Pct. 9b — Securitate cont",
        description: "Pagina „Securitate” (2FA) e separată de Jurnalul de audit — nu există un singur tab combinat „Audit & Securitate” specific LMS-ului; sunt două pagini distincte, ambele reale.",
      },
      {
        targetId: "lms-editor-rewrite-buttons",
        autoRoute: "$capturedPath",
        title: "Pct. 11a — Asistență AI integrată",
        description: "Selectează text într-un bloc TEXT dintr-o lecție — apar butoanele Rescrie/Adaptează/Extinde/Rezumă.",
      },
      {
        targetId: "lms-editor-tts-link",
        title: "Pct. 11b — Generare fișier audio (TTS)",
        description: "„Ascultă (Text-to-Speech)” redă conținutul blocului. Fișierul audio descărcabil real e disponibil în vizualizarea de cursant (pasul din Pct. 14/1 mai jos).",
      },
      {
        targetId: "lms-invite-coauthor-btn",
        title: "Pct. 12a — Invitare Co-autor",
        description: "Invită un cont existent ca și colaborator (Co-autor) pe acest curs.",
      },
      {
        targetId: "lms-editor-tab-colaborare",
        title: "Pct. 12b — Panou de revizuire",
        description: "Tab-ul „Colaborare” — comentarii contextuale pe blocul de conținut, cu opțiunea „Marchează ca rezolvat”.",
      },
      {
        targetId: "lms-rubric-add-criterion-btn",
        title: "Pct. 12c — Rubrică de evaluare",
        description: "Adaugă un criteriu de evaluare — feedback-ul structurat (scoruri per criteriu) se salvează per lecție.",
      },
      {
        targetId: "lms-editor-tab-lectii",
        autoRoute: "$capturedPath",
        title: "Pct. 13a — Revino la lecții",
        description: "Revino la tab-ul „Lecții” pentru a intra în modul Previzualizare.",
      },
      {
        targetId: "lms-editor-preview-btn",
        title: "Pct. 13b — Compatibilitate mobilă",
        description: "Intră în modul „Previzualizare”, apoi comută între Desktop/Tabletă/Mobil cu cele 3 iconițe.",
      },
      {
        targetId: "lms-player-lesson-content",
        autoRoute: "$capturedPath/learn",
        title: "Pct. 14 — Experiența cursantului",
        description: "Vizualizarea de cursant a aceluiași curs — progresul se reia automat de unde ai rămas (sincronizat cross-device, pe cont).",
      },
      {
        targetId: "lms-player-ask-assistant",
        title: "Pct. 1 — Asistent hibrid voce-text la nivel de lecție",
        description: "Întreabă (scris sau cu microfonul) despre lecția curentă — răspunsul folosește baza de cunoștințe a cursului.",
      },
      {
        targetId: "lms-quiz-submit-btn",
        title: "Pct. 15 — Evaluări și Barieră Logică",
        description: "Trimite răspunsurile la testul lecției — feedback imediat corect/greșit. Sub scorul minim configurat, lecția următoare rămâne blocată (verificat și server-side, nu doar vizual).",
      },
    ],
  },
  {
    id: "lms-organizator",
    label: "LMS — Organizator, proiect nou, generare AI, drag-and-drop",
    route: "/lms",
    roles: LMS_CREATOR_ROLES,
    // Tur focalizat strict pe cerința: accesarea Organizatorului + creare proiect nou +
    // generare AI a structurii (din subiect scris SAU fișier încărcat) + editare
    // drag-and-drop a materialului — spre deosebire de scenariul-5 (care acoperă tot
    // modulul LMS, ~30 pași). Util când trebuie demonstrat/înregistrat DOAR acest fragment.
    steps: [
      {
        targetId: "lms-new-course-btn",
        title: "Organizatorul (tabloul de bord)",
        description: "Tabloul de bord LMS listează toate proiectele (cursurile) existente — acesta e Organizatorul. Apasă „+ Curs nou” pentru a începe un proiect nou.",
      },
      {
        targetId: "lms-create-course-title-input",
        title: "Creare proiect nou — titlu",
        description: "Dă un titlu proiectului nou.",
      },
      {
        targetId: "lms-create-course-submit-btn",
        title: "Creare proiect nou — confirmare",
        description: "Apasă „Creează” — proiectul se creează și intri direct în editorul de curs.",
      },
      {
        targetId: "lms-generate-structure-btn",
        awaitRoute: "/lms/courses/:id",
        title: "Asistent AI — deschide generarea structurii",
        description: "În editor, apasă „Generează structură AI”.",
      },
      {
        targetId: "lms-generate-structure-subject-input",
        title: "Asistent AI — subiect scris SAU fișier încărcat",
        description: "Scrie un subiect/descriere a materialului în câmpul de text — SAU, alternativ, încarcă direct un fișier (câmpul de mai jos) cu conținutul sursă. Poți folosi oricare dintre cele două, sau ambele.",
      },
      {
        targetId: "lms-generate-structure-submit-btn",
        title: "Asistent AI — generare automată",
        description: "Apasă „Generează” — AI-ul produce automat 3-6 lecții structurate, pe baza subiectului scris și/sau a fișierului încărcat.",
      },
      {
        targetId: "lms-editor-lesson-row",
        title: "Editare drag-and-drop — lecții",
        description: "Trage o lecție de mânerul ei pentru a-i schimba ordinea în listă. Funcționează și de la tastatură (Tab la mâner, Space ridică, săgeți mută, Space lasă jos) — accesibil, nu doar cu mouse-ul.",
      },
      {
        targetId: "lms-block-drag-handle",
        title: "Editare drag-and-drop — blocuri de conținut",
        description: "În interiorul unei lecții, fiecare bloc de conținut (text/imagine/video/test) are propriul mâner de tras — reordonează blocurile la fel, prin drag-and-drop.",
      },
    ],
  },
  {
    id: "lms-colaborare",
    label: "LMS — Colaborare și Feedback (Co-autor, comentarii, rubrică)",
    route: "/lms",
    roles: LMS_CREATOR_ROLES,
    // Tur focalizat strict pe cerința "Colaborare și Feedback" — spre deosebire de
    // scenariul-5 (pct. 12a-12c), care doar deschide tab-ul și adaugă un criteriu, fără
    // pași dedicați pentru trimiterea propriu-zisă a comentariului, rezolvarea lui sau
    // salvarea efectivă a unui scor pe rubrică.
    steps: [
      {
        targetId: "lms-first-course-card",
        awaitRoute: "/lms/courses/:id",
        title: "Deschide un proiect existent",
        description: "Din Organizator, intră într-un curs la care vrei să inviți un colaborator.",
      },
      {
        targetId: "lms-invite-coauthor-btn",
        title: "Invitare Co-autor",
        description: "Apasă „Invită Co-autor” — alege un cont existent din listă. Contul invitat primește acces de colaborare (rol Co-autor) pe acest curs.",
      },
      {
        targetId: "lms-editor-tab-colaborare",
        title: "Deschide panoul de revizuire",
        description: "Tab-ul „Colaborare” — necesită o lecție selectată în tab-ul „Lecții” (panoul de revizuire e scopat pe lecția activă).",
      },
      {
        targetId: "lms-comment-send-btn",
        title: "Comentariu contextual pe un element specific",
        description: "Alege blocul de conținut (text/imagine/video/test) din select-ul de mai sus, scrie comentariul, apoi apasă „Trimite” — comentariul rămâne asociat exact acelui bloc, nu doar lecției în general.",
      },
      {
        targetId: "lms-comment-resolve-btn",
        title: "Rezolvarea unui comentariu",
        description: "Lângă un comentariu nerezolvat, apasă „Marchează ca rezolvat” — dispare butonul și apare eticheta verde „Rezolvat”.",
      },
      {
        targetId: "lms-rubric-add-criterion-btn",
        title: "Rubrică de evaluare — criterii",
        description: "Adaugă un criteriu de evaluare (rubrica e comună pentru tot cursul, nu doar pentru lecția curentă).",
      },
      {
        targetId: "lms-rubric-save-score-btn",
        title: "Feedback structurat — salvare scor",
        description: "Completează un punctaj pentru fiecare criteriu, apoi apasă „Salvează scorul” — scorul se înregistrează per lecție, per evaluator, vizibil apoi în istoricul „Scoruri anterioare”.",
      },
    ],
  },
  {
    id: "lms-cursant-acces",
    label: "LMS — Acces și parcurgere conținut (cursant)",
    route: "/lms",
    // Fără `roles` — vizibil oricărui cont autentificat, la fel ca Scenariul 3 (Chatbot):
    // accesul de cursant nu necesită un rol special (spre deosebire de turul "Organizator",
    // rezervat rolurilor care pot crea cursuri).
    steps: [
      {
        targetId: "",
        gap: true,
        title: "Autentificare securizată",
        description: "Se demonstrează separat, ÎNAINTE de acest tur: deconectează-te, apoi autentifică-te din nou (cu 2FA activat, dacă e cazul — vezi pagina Securitate). Revino aici după login pentru a continua turul.",
      },
      {
        targetId: "lms-first-course-card",
        awaitRoute: "/lms/courses/:id/learn",
        title: "Accesarea unui curs publicat din tabloul de bord",
        description: "Lista de cursuri arată aici doar cursurile publicate (pentru un cont de cursant, nu ciornele) — dă click pe un curs pentru a intra direct în vizualizarea de cursant, nu în editor.",
      },
      {
        targetId: "lms-player-lesson-content",
        title: "Reluare exact de unde ai rămas",
        description: "Progresul (lecția curentă) e salvat pe cont, nu în browser — la redeschiderea cursului, inclusiv de pe alt dispozitiv, te întorci automat la aceeași lecție la care ai rămas, fără niciun pas manual.",
      },
    ],
  },
  {
    id: "lms-evaluari-bariera",
    label: "LMS — Evaluări și Bariera Logică (cursant)",
    route: "/lms",
    steps: [
      {
        targetId: "lms-first-course-card",
        awaitRoute: "/lms/courses/:id/learn",
        title: "Deschide un curs cu secțiune de testare",
        description: "Intră într-un curs care are o lecție cu bloc de tip Test.",
      },
      {
        targetId: "lms-quiz-option",
        title: "Răspuns la întrebări",
        description: "Alege câte un răspuns pentru fiecare întrebare a testului.",
      },
      {
        targetId: "lms-quiz-submit-btn",
        title: "Trimite răspunsurile",
        description: "Apasă „Trimite răspunsurile” — scorul se calculează întotdeauna pe server, niciodată doar în browser.",
      },
      {
        targetId: "lms-quiz-result-banner",
        title: "Feedback vizual imediat",
        description: "Fiecare opțiune se colorează instant — verde pentru răspunsul corect, roșu pentru cel greșit ales — plus scorul final și mesajul de deblocare/blocare.",
      },
      {
        targetId: "lms-player-locked-lesson",
        title: "Bariera Logică",
        description: "Sub scorul minim configurat pe test, lecția următoare rămâne vizibil blocată (iconiță de lacăt, opacitate redusă) — și blocată real, verificat și pe server, nu doar ascunsă vizual: nu poate fi ocolită apelând API-ul direct.",
      },
    ],
  },
];
