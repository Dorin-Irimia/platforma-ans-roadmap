# Modul IAM — Scenariul 4 ✅ Sprint 0 implementat

Implementare inițială completă (backend + frontend minimal):

- [x] Autentificare (`POST /api/iam/login`) și auto-înregistrare cetățeni (`POST /api/iam/register`) — parola/sesiunea sunt gestionate de **Supabase Auth** (`shared/supabase.ts`); baza locală (`User`) reține doar `role`/`isActive`, cheiată pe id-ul contului din Supabase
- [x] Invitație angajați pe email (`POST /api/iam/users/invite`, doar Super Admin/Admin Instituție) — via `supabase.auth.admin.inviteUserByEmail`
- [x] RBAC granular (`rbac.middleware.ts`) — roluri: Super Admin, Admin Instituție, Moderator, Evaluator, Autor, Co-autor, Utilizator standard
- [x] Audit trail imuabil + filtrare (`audit.service.ts`, `GET /api/iam/audit`)
- [x] Secret Manager (AES-256-GCM) — `POST/GET /api/iam/secrets`
- [ ] Integrare reală eIDAS/ROeID (se leagă la un provider extern real ulterior)
- [ ] Grupuri (model `Group`/`GroupMembership` există în schema Prisma, endpoint-uri CRUD grup — TODO)

2FA (TOTP) custom a fost eliminat odată cu migrarea la Supabase Auth, care are propriul mecanism MFA dacă va fi nevoie ulterior.

## Frontend

`frontend/src/pages`: `LoginPage`, `RegisterPage`, `AdminUsersPage` (listă + blocare/deblocare), `AuditLogPage`.

## Verificare efectuată în acest sandbox

- `npm run test:iam` — self-test fără bază de date, validează criptarea secretelor (Secret Manager) → **toate testele trec**.
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
