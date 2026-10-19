# Capstone Progress Log

Cloud-based exam question bank with AI-assisted exam generation.
Read this first when resuming work.

_Last updated: 2026-10-19_

- Detailed technical report (schema, auth, privacy, workflow, test results): `docs/Capstone_Technical_Report_Step1.pdf`
- Repository: https://github.com/sannnntf123-pixel/mycapstone (branch `main`)

---

## Scope change (2026-10-19): instructors only

The system **no longer has students**. Only instructors use it: they add questions, approve them, and (in a later step) generate exams. The `STUDENT` role was removed from the schema with migration `20261019100000_remove_student_role`. Student exam-taking has been dropped from the plan.

---

## Where we are

**Step 1 (Foundation), sub-steps 1 and 2 are done, plus the instructor-only change.** Sub-steps 3 to 6 are next.

| # | Sub-step | Status |
|---|----------|--------|
| 1 | Project setup: Next.js, Prisma, PostgreSQL in Docker, schema and first migration | Done |
| 2 | API routes: auth, curricula/chapters, questions (create / list / filter / approve / reject / bank) | Done |
| 2b | Remove the Student role; every endpoint requires an instructor | Done; 36/36 smoke checks |
| 3 | Guard review and hardening: DB CHECK constraint on difficulty, rate limit on login | **Next** |
| 4 | Seed script: several instructors, 2 curricula with chapters, questions in each state (private and shared) | To do |
| 5 | Automated tests (Vitest) for the approval workflow and privacy rules, using a separate test DB (port `scripts/smoke-test.mjs`) | To do |
| 6 | Dockerfile for the app, `docker-compose` with app and db, README | To do |

**Later steps:** AI question generation, then instructor-only AI exam generation (by curriculum, chapters, difficulty, total duration), then the frontend UI.

---

## Tech stack

| Layer | Choice | Why (for the presentation) |
|-------|--------|---------------------------|
| Framework | **Next.js 15 (App Router, TypeScript)** | One codebase for the API now and the UI later; it deploys to Vercel or to any container host. |
| Database | **PostgreSQL 16** (Docker) | The data is relational (curriculum → chapter → question → user). Every cloud provider offers managed Postgres. |
| ORM | **Prisma 6** | A type-safe schema, versioned migrations (`prisma/migrations`), and one schema file that acts as documentation. |
| Auth | **JWT (`jose`) + bcrypt**, `Authorization: Bearer <token>` | Stateless, so it scales horizontally in the cloud. Easy to test. We chose this over NextAuth because the Credentials provider and server-side role checks are awkward to test in NextAuth. |
| Validation | **Zod** | Every request body and query is validated at the API boundary, and bad input returns a 400 with field errors. |

---

## How to run (local)

```bash
cd ~/Desktop/my-capstone
npm install
cp .env.example .env        # then set JWT_SECRET (openssl rand -base64 32) and INSTRUCTOR_INVITE_CODE
npm run db:up               # starts Postgres in Docker on host port 5434
npm run db:migrate          # applies migrations + generates Prisma client
npm run dev                 # API on http://localhost:3100
npm run smoke               # second terminal: 36 end-to-end checks against the running API
```

Machine notes (this Mac):
- Docker runs through **Colima**. Run `colima start` first if `docker ps` fails.
- Use `docker-compose` (with a hyphen). The `docker compose` plugin is not installed.
- A local Homebrew Postgres already uses port **5432**, and another project uses **5433**, so this project uses **5434**.
- `.env` holds a random JWT secret and the invite code `capstone-instructor`. Git ignores `.env`; `.env.example` is committed.
- `prisma migrate dev` refuses to run in Claude's non-interactive shell when a change could lose data. In that case, write the migration SQL by hand, then run `npx prisma migrate deploy`. Check for drift with `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script`, which should print an empty migration.

Regenerate the PDF report after changes:

```bash
python3 -m venv .venv-report && .venv-report/bin/pip install reportlab
.venv-report/bin/python docs/report/build_report.py docs/Capstone_Technical_Report_Step1.pdf
```

---

## Folder structure

```
my-capstone/
├── prisma/
│   ├── schema.prisma            # database schema (source of truth)
│   └── migrations/              # init + remove_student_role
├── src/
│   ├── app/api/                 # HTTP layer: thin route handlers only
│   │   ├── auth/{register,login,me}/route.ts
│   │   ├── curricula/route.ts
│   │   ├── curricula/[id]/chapters/route.ts
│   │   └── questions/
│   │       ├── route.ts               # GET list/filter, POST create
│   │       ├── bank/route.ts          # GET approved-only question bank
│   │       └── [id]/{route,approve/route,reject/route}.ts
│   ├── lib/                     # shared infrastructure
│   │   ├── prisma.ts            # single Prisma client
│   │   ├── auth.ts              # hashing, JWT, requireUser / requireRole
│   │   ├── errors.ts            # HttpError + handle() wrapper → JSON errors
│   │   └── validation.ts        # Zod schemas for every input
│   └── server/                  # business logic (domain services)
│       └── questions.ts         # privacy filter + approval workflow
├── scripts/smoke-test.mjs       # end-to-end API checks (npm run smoke)
├── docs/                        # technical report PDF + its generator (docs/report/)
├── docker-compose.yml           # Postgres
├── .env.example
└── PROCESS.md                   # this file
```

Later steps slot in as `src/server/ai.ts`, `src/server/exams.ts`, `src/app/api/exams/...`, and UI pages under `src/app/`.

---

## Database schema (summary)

- **User**: email (unique), passwordHash, name, role `INSTRUCTOR` (the only value; kept as an enum so other roles can be added by migration)
- **Curriculum**: name (unique), description, createdBy
- **Chapter**: belongs to a Curriculum (cascade delete), title, orderIndex; unique per curriculum
- **Question**: content, `options` (JSON, optional, for MCQ), answer, curriculumId, chapterId, difficulty 1–5, estimatedTimeMinutes, source `MANUAL | AI`, createdById, status `PENDING | APPROVED | REJECTED`, approvedById, approvedAt, rejectionReason, visibility `PRIVATE | SHARED`, timesUsed, lastUsedAt
- Indexes: (curriculumId, chapterId), (status, visibility), createdById, difficulty. These match the filters that exam generation will use.

---

## API (current)

All endpoints except register and login need `Authorization: Bearer <token>` from an instructor.

| Method | Path | Who | Notes |
|--------|------|-----|-------|
| POST | `/api/auth/register` | public + invite code | Always creates an INSTRUCTOR; `inviteCode` required (missing: 400, wrong: 403) |
| POST | `/api/auth/login` | public | Returns `{ user, token }` |
| GET | `/api/auth/me` | instructor | |
| GET/POST | `/api/curricula` | instructor | GET includes chapters |
| GET/POST | `/api/curricula/:id/chapters` | instructor | |
| GET | `/api/questions` | instructor | Filters: `curriculumId, chapterId, difficulty, status, visibility, mine=true, page, pageSize` |
| POST | `/api/questions` | instructor | Always created as `PENDING`, `source: MANUAL` |
| GET | `/api/questions/bank` | instructor | Approved questions only (the question bank) |
| GET | `/api/questions/:id` | instructor | 404 if not visible to you |
| POST | `/api/questions/:id/approve` | instructor | Records approvedBy and approvedAt; 409 if not pending |
| POST | `/api/questions/:id/reject` | instructor | Optional `{ reason }`; 409 if not pending |

---

## Key design decisions (to defend in the presentation)

1. **Privacy lives in one function.** `visibleToInstructor()` in `src/server/questions.ts` is the only definition of "who can see what": your own questions plus shared ones. Every list, get, approve, and reject call goes through it, so no single endpoint can forget the rule.
2. **Every route checks the role explicitly** with `requireRole(req, "INSTRUCTOR")`, even though it's currently the only role. Adding a new role later can't silently give it access to existing endpoints.
3. **404 instead of 403 for other people's private questions.** This doesn't reveal that the question exists.
4. **Who can approve:** any instructor who can *see* the question. Shared questions get peer review. A private question can only be approved by its owner, since nobody else can see it.
5. **Race-safe approval.** The update is conditional (`WHERE id = ? AND status = 'PENDING'`), so two instructors approving at the same moment cannot both succeed.
6. **Approval is final.** Approved and rejected questions cannot be reviewed again (409). Editing and resubmitting can be added later.
7. **Registration needs an invite code** (env variable). If it isn't set, registration is closed. Otherwise anyone on the internet could sign up and read the shared bank. The role is always set by the server; a client-sent `role` is ignored.
8. **The user is reloaded from the DB on every request** instead of trusting the role inside the token. A deleted account takes effect immediately.
9. **Removing the Student role entirely** rather than just disabling it. Unused roles still have to be guarded everywhere, so dropping them shrinks the attack surface. The role column is kept as an enum, so adding a role back is one migration.
10. **Future-proofing:** `source` (MANUAL/AI) already exists for AI generation, and `timesUsed`/`lastUsedAt` exist for exam generation. Indexes match the exam-builder filters. `options` JSON supports MCQ without a schema change.
11. **Config comes only from environment variables** (12-factor), so the same build runs locally and in the cloud.

---

## Verification log

- 2026-10-16: initial API, 28/28 smoke checks.
- 2026-10-19 (instructor-only change):
  - Migration `20261019100000_remove_student_role` was applied.
  - `prisma migrate diff` against the live DB is empty, so there is no drift.
  - `tsc` and `eslint` are clean.
  - `npm run smoke` passes **36/36**. The checks cover:
    - registration needs an invite code; a role sent by the client is ignored
    - every endpoint returns 401 without a token
    - validation, and that the client can't set status or owner
    - private versus shared visibility, including that a `visibility=PRIVATE` filter can't leak other people's questions
    - approve/reject behaviour and 409 on a second review
    - the bank is approved-only and ignores a status override

## Open questions

- Should instructors be allowed to **edit** a question after rejection and resubmit it? This is not built yet.
- Should an instructor be allowed to **approve their own shared question**, or should shared questions require a different instructor? Currently both are allowed.
- Should instructors be able to change a question's visibility after approval?
