# Metodologie, livrabile, faze, echipă, riscuri (secțiunile 5–7)

Sursă: Caiet de sarcini Platf. rev (1).pdf, paginile 250–299.

---

## 5. Ipoteze și riscuri

### 5.1 Ipoteze
- Nu se prevăd schimbări majore ale cadrului instituțional/legal.
- Autoritatea contractantă nominalizează o echipă de experți și un manager de proiect.
- Solicitările de informații primesc răspuns în 3-5 zile lucrătoare.
- Se pot realiza recepții parțiale pentru diferite livrabile.

### 5.2 Riscuri principale (din 15 identificate)
| Risc | Impact | Probabilitate | Măsuri |
|---|---|---|---|
| Nerespectare termene subcontractori | Mare | Medie | Plan comunicare furnizori, marje de timp |
| Erori specificații echipamente | Mare | Mică | Planificare detaliată, resurse calificate |
| Resurse insuficiente | Mare | Medie | Personal back-up, monitorizare încărcare |
| Schimbări legislative | Mare | Medie | Monitorizare legislativă, acte adiționale |
| Întârziere avizare decizii AC | Mare | Mare | Pregătire informații pentru decizii rapide |
| Întârzieri proceduri atribuire | Mare | Medie | Descriere circumstanțe în plan de proiect |
| Soluție tehnică diferită | Mare | Mică | Specialiști experimentați, variante intermediare |
| Depășire buget | Mare | Mică | Monitorizare/control conform metodologiei PM |

### 5.3 Indicatori de performanță (KPI, scor 1-5)
1. Raportul de analiză și proiectare — completitudine, aplicabilitate, relevanță.
2. Livrabil adecvat scopului — corelare cerințe ↔ implementare, migrare date.
3. Livrabile la termen — întârzieri peste 60 zile = Satisfăcător (2); peste 120 zile = Nesatisfăcător (1).

---

## 6. Abordare și metodologie în cadrul contractului

### 6.1 Cadrul activităților
- **Localizare:** Sediul ANS, Str. Vasile Conta, Nr. 16, Sector 2, București.
- **Durata de implementare: 24 luni**, cu termene maximale (L=lună):
  - Livrare/preluare echipamente HW: L1-L3
  - Analiza fluxurilor și proiectarea sistemului: L1-L8
  - Dezvoltare soluție TIC + testare internă: L1-L13
  - Implementarea măsurilor de securitate cibernetică: L8-L15
  - Implementare sistem integrat: L13-L20
  - Testare finală: L19-L24
  - Instruire administratori/utilizatori: L19-L23

### 6.2 Servicii și livrabile specifice

**6.2.1 Livrare hardware** — transport, instalare, configurare. Livrabile: avize însoțire marfă, certificate garanție/conformitate, raport instalare.

**6.2.2 Analiza fluxurilor și proiectare** — cartografiere procese, arhitectură sistem, model de date, scenarii testare. Livrabil: Raport de analiză de business și proiectare.

**6.2.3 Dezvoltare soluție TIC integrată** — cele 13 module. Livrabile: cod sursă, documentație tehnică/utilizare, release notes, raport testare internă.

**6.2.4 Implementarea măsurilor de securitate cibernetică** — autentificare/control acces, criptare, monitorizare/detectare (SIEM), plan continuitate/DR. Testele de penetrare black-box/white-box de terți NU fac parte din acest contract, dar recepția finală se face doar după remedierea integrală a vulnerabilităților.

**6.2.5 Implementarea sistemului integrat** — fazare obligatorie:
1. Faza 1 — ANS
2. Faza 2 — Federații Sportive
3. Faza 3 — Cluburi Sportive
4. Faza 4 — Sportivi
5. Faza 5 — Alte structuri sportive

**6.2.6 Testarea platformei** — funcțională, integrare, performanță, UAT, pentest greybox (Prestator) + audit extern black/white-box.

**6.2.7 Instruirea personalului** — 130 persoane total:
- Competențe digitale de bază: 130 persoane, online.
- Utilizatori platformă: 110 persoane (grupe max 20, 3 zile) + Management 15 persoane (grupe max 15, 3 zile).
- Administratori: 5 persoane (grupă max 5, 5 zile).

**6.2.8 Garanția sistemului** — 36 luni de la recepția finală.

| Gravitate | Timp răspuns | Soluționare temporară | Remediere |
|---|---|---|---|
| Critic | 4 ore | 8 ore | 24 ore |
| Mediu | 8 ore | 24 ore | 48 ore |
| Minor | 48 ore | 72 ore | 96 ore |

### 6.3 Grafic de execuție
Format Gantt (MS Project/Primavera), cod WBS, dependențe. Activitățile nu depășesc 14 zile calendaristice.

### 6.4 Recepția
Recepție cantitativă (livrare) + calitativă (funcționare, remediere neconformități). PV de Recepție = singurul temei pentru plată.

### 6.5 Grafic de plăți
3 tranșe pe bază de PV de acceptanță parțială (HW+licențe, licențe SW+funcționalități standard, finalizare etape majore). Termen plată: 30 zile de la factura electronică (RO e-Factura).

### 6.6 Strategia de organizare (3 niveluri)
- Nivel 1 — Comitetul de Conducere (decizie).
- Nivel 2 — Coordonare (planificare, urmărire, control).
- Nivel 3 — Execuție (echipe AC + Prestator).

### 6.7 Metodologia de implementare
Kick-off, întâlniri planificare/confirmare per etapă, ședințe lunare de management, rapoarte lunare, Registru de acțiuni, Registrul Riscurilor.

### 6.8-6.9 Evaluare și raportare
Evaluare permanentă + finală + audit financiar extern. Rapoarte lunare, de etapă, ad-hoc, Raport Final.

### 6.10 Responsabilități
Contractant: planificare resurse, respectare legislație/best practices, interdicție angajare personal AC implicat în evaluare timp de minim 12 luni. AC: informații, echipă suport, resurse, plăți.

---

## 7. Echipa de proiect a ofertantului

### Experți cheie (implementare platformă)
| Rol | Experiență minimă | Responsabilități |
|---|---|---|
| Manager de proiect | 5 ani; proiect similar ≥1.000.000 EUR | Management contract, arie, riscuri, comunicare |
| Expert analiză business | 3 ani; certificare CBAP | Analiză cerințe, interviuri stakeholderi |
| Expert arhitect software Full-Stack | 3 ani | Arhitectură soluție, pattern-uri, containerizare |
| Expert securitate informatică | 3 ani; certificare | Vulnerabilități, proceduri securitate |
| Expert integrare | 3 ani | Orchestrare API, mapări date, Vault |
| Expert dezvoltare software Full-Stack | 3 ani | Dezvoltare module, integrare legacy, ETL |
| Expert baze de date | 3 ani; certificare | Model date, securitate BD, backup/recovery |
| Expert testare software | 3 ani; certificare | Planuri/cazuri test, rapoarte |
| Expert instruire | 3 ani; certificare formare | Sesiuni formare, evaluare |

### Experți arhivare (fizică & digitizare)
| Rol | Nr. persoane |
|---|---|
| Coordonator tehnic arhivare fizică | 1 (5 ani exp.) |
| Coordonator tehnic digitizare | 1 (5 ani exp.) |
| Coordonator tehnic procesare date | 1 (5 ani exp.) |
| Arhiviști/Arhivari atestați | min. 5 + 5 |
| Legători manuali | min. 2 |
| Operatori scanare | min. 5 |
| Operatori procesare date | min. 3 |

Reguli: un expert = un singur rol; înlocuire în max. 2 săptămâni cu profil egal/superior, pe cheltuiala prestatorului.
