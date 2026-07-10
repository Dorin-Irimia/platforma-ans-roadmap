# Modul IAM — Scenariul 4 ✅ Sprint 0 implementat

Implementare inițială completă (backend + frontend minimal):

- [x] CRUD conturi (`POST /api/iam/register`) + identity service
- [x] Autentificare user/parolă (`POST /api/iam/login`) + 2FA TOTP (`/2fa/setup`, `/2fa/verify`)
- [x] Politici sesiune/parolă configurabile (`types.ts` — `DEFAULT_AUTH_POLICY`) + blocare cont după N tentative eșuate
- [x] RBAC granular (`rbac.middleware.ts`) — roluri: Super Admin, Admin Instituție, Moderator, Evaluator, Autor, Co-autor, Utilizator standard
- [x] Audit trail imuabil + filtrare (`audit.service.ts`, `GET /api/iam/audit`)
- [x] Secret Manager (AES-256-GCM) — `POST/GET /api/iam/secrets`
- [ ] Integrare reală eIDAS/ROeID (momentan doar hook în politică — se leagă la un provider extern real ulterior)
- [ ] Grupuri (model `Group`/`GroupMembership` există în schema Prisma, endpoint-uri CRUD grup — TODO)

## Frontend

`frontend/src/pages`: `LoginPage`, `RegisterPage`, `AdminUsersPage` (listă + blocare/deblocare), `AuditLogPage`.

## Verificare efectuată în acest sandbox

- `npm run test:iam` — self-test fără bază de date, validează hashing parolă, JWT, TOTP, criptare secrete → **toate testele trec**.
- `npx tsc --noEmit` (backend) și `npm run build` (frontend, Vite) → **compilare curată, fără erori**.
- **Nu s-a putut rula** `npx prisma generate` sau porni PostgreSQL în acest sandbox (mediul blochează `binaries.prisma.sh` și nu are Docker) — se rulează pe mașina ta cu `docker compose up --build` (vezi `demo-app/README.md`).

## Cum testezi local (pe mașina ta, cu Docker)

```bash
cd demo-app
docker compose up --build
# apoi, într-un alt terminal, generează clientul Prisma și schema în DB:
docker compose exec backend npx prisma generate
docker compose exec backend npx prisma db push
```

Apoi accesează `http://localhost:5173`, creează un cont din „Cont nou", autentifică-te, și `http://localhost:5173/admin` pentru panoul de administrare (necesită rol Super Admin/Admin Instituție — setează manual rolul primului utilizator direct în DB pentru primul test).
