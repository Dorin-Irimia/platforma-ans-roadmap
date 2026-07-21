# Roadmap PM — Platformă Digitală Integrată ANS

Structură de proiect (PM), arhitectură software, module funcționale, integrări și plan de task-uri, derivate din analiza Caietului de Sarcini (326 pagini) pentru platforma digitală a Agenției Naționale pentru Sport (ANS).

## Conținut

- **[Roadmap_PM_Platforma_ANS.html](./Roadmap_PM_Platforma_ANS.html)** — roadmap vizual interactiv: faze de implementare (Gantt, 24 luni), arhitectură software pe straturi, cele 13 module funcționale cu task-uri de dezvoltare, infrastructură cloud, securitate, integrări externe, echipa de proiect, livrabile/plăți, riscuri și KPI. Deschide-l direct în browser.
- **[docs/01-module-functionale.md](./docs/01-module-functionale.md)** — extras detaliat al cerințelor funcționale și al celor 13 module (secțiunile 4.4–4.5.13 din caiet).
- **[docs/02-infrastructura-securitate.md](./docs/02-infrastructura-securitate.md)** — extras arhitectură hardware/cloud, integrare/interoperabilitate, securitate, confidențialitate date (secțiunile 4.6–4.11).
- **[docs/03-metodologie-echipa.md](./docs/03-metodologie-echipa.md)** — extras riscuri, KPI, metodologie de implementare, livrabile, faze, echipa de proiect (secțiunile 5–7).
- **[source/](./source/)** — Caietul de sarcini original (PDF), sursa tuturor informațiilor de mai sus.

## Context

- Autoritate Contractantă: Agenția Națională pentru Sport (ANS)
- Durată implementare: 24 luni + 36 luni garanție
- Model: soluții COTS (licențe perpetue) + dezvoltări custom pe 13 module
- Infrastructură țintă: Cloud Privat Guvernamental (Azure Stack Hub)

Document elaborat pentru uz intern de planificare de proiect, fără valoare contractuală.

## Demo — Scenariul de Demonstrație Obligatoriu (nou)

Caietul de sarcini (Cap. 8) impune o demonstrație video obligatorie a 5 scenarii funcționale, ca și condiție de calificare a ofertei. Am pornit lucrul de aici:

- **[Roadmap_Demo_Scenarii.html](./Roadmap_Demo_Scenarii.html)** — roadmap vizual: cele 5 scenarii, arhitectură tehnică, structură repo, plan de sprint-uri (8 săptămâni), scalare spre roadmap-ul PM complet.
- **[docs/04-scenariu-demonstrativ.md](./docs/04-scenariu-demonstrativ.md)** — extras complet al cerințelor de demonstrat, punct cu punct.
- **[demo-app/](./demo-app/)** — scaffold-ul codului (Node.js + React + PostgreSQL), organizat pe module: `iam`, `dms`, `bi`, `chatbot`, `lms` — câte unul per scenariu. Pentru instalare pe un dispozitiv nou (ce trebuie instalat, cum se configurează `.env`), vezi **[demo-app/README.md → Pornire pe un dispozitiv nou](./demo-app/README.md#pornire-pe-un-dispozitiv-nou)**.
