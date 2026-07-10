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

## Cum rulezi local (odată ce codul e completat)

```bash
docker compose up --build
# backend:  http://localhost:4000
# frontend: http://localhost:5173
```

## Stare curentă

Acesta este scaffold-ul inițial de structură (foldere + configurare de bază). Implementarea efectivă a fiecărui scenariu se face sprint cu sprint, conform planului din `Roadmap_Demo_Scenarii.html`.
