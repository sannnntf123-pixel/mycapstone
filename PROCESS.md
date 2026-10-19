# Capstone Progress Log

Cloud-based exam question bank with AI-assisted exam generation.
Read this first when resuming work.

_Last updated: 2026-10-16_

Detailed technical report (schema, auth, privacy, workflow, test results): `docs/Capstone_Technical_Report_Step1.pdf`

---

## Where we are

**Step 1 (Foundation), sub-steps 1 and 2 are done.** Sub-steps 3 to 6 are next.

| # | Sub-step | Status |
|---|----------|--------|
| 1 | Project setup: Next.js, Prisma, PostgreSQL in Docker, schema and first migration | Done |
| 2 | API routes: auth, curricula/chapters, questions (create / list / filter / approve / reject / bank) | Done; smoke-tested end to end |
| 3 | Route-level middleware / auth guard review (helpers already exist in `src/lib/auth.ts`) | Next |
| 4 | Seed script: 3 instructors, 1 student, 2 curricula with chapters, questions in each state | To do |
| 5 | Automated tests (Vitest) for the approval workflow and privacy rules, using a separate test DB | To do |
| 6 | Dockerfile for the app, `docker-compose` with app and db, README | To do |

**Out of scope until later steps:** AI question generation, exam generation, student exam-taking, frontend UI.

---

## Tech stack

| Layer | Choice | Why (for the presentation) |
|-------|--------|---------------------------|
| Framework | **Next.js 15 (App Router, TypeScript)** | One codebase for the API now and the UI later; it deploys to Vercel or to any container host. |
| Database | **PostgreSQL 16** (Docker) | The data is relational (curriculum → chapter → question → user). Every cloud provider offers managed Postgres. |
| ORM | **Prisma 6** | A type-safe schema, versioned migrations (`prisma/migrations`), and one schema file that acts as documentation. |
| Auth | **JWT (`jose`) + bcrypt**, `Authorization: Bearer <token>` | Stateless, so it scales horizontally in the cloud. Easy to test, and it works for a future mobile app too. We chose this over NextAuth because the Credentials provider and server-side RBAC are awkward to test in NextAuth. |
| Validation | **Zod** | Every request body and query is validated at the API boundary, and bad input returns a 400 with field errors. |

---

## How to run (local)

```bash
cd ~/Desktop/my-capstone
npm install
cp .env.example .env        # then set JWT_SECRET (openssl rand -base64 32)
npm run db:up               # starts Postgres in Docker on host port 5434
npm run db:migrate          # applies migrations + generates Prisma client
npm run dev                 # API on http://localhost:3100
```

Machine notes (this Mac):
- Docker runs through **Colima**. Run `colima start` first if `docker ps` fails.
- Use `docker-compose` (with a hyphen). The `docker compose` plugin is not installed.
- A local Homebrew Postgres already uses port **5432**, and another project uses **5433**, so this project uses **5434**.
- `.env` holds a random JWT secret and instructor invite code `capstone-instructor`. Git ignores `.env`; `.env.example` is committed.

---

## Folder structure

```
my-capstone/
├── prisma/
│   ├── schema.prisma            # database schema (source of truth)
│   └── migrations/              # versioned SQL migrations
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
├── docker-compose.yml           # Postgres
├── .env.example
└── PROCESS.md                   # this file
```

Later steps slot in as `src/server/ai.ts`, `src/server/exams.ts`, `src/app/api/exams/...`, and UI pages under `src/app/`.

---

## Database schema (summary)

- **User**: email (unique), passwordHash, name, role `INSTRUCTOR | STUDENT`
- **Curriculum**: name (unique), description, createdBy
- **Chapter**: belongs to a Curriculum (cascade delete), title, orderIndex; unique per curriculum
- **Question**: content, `options` (JSON, optional, for MCQ), answer, curriculumId, chapterId, difficulty 1–5, estimatedTimeMinutes, source `MANUAL | AI`, createdById, status `PENDING | APPROVED | REJECTED`, approvedById, approvedAt, rejectionReason, visibility `PRIVATE | SHARED`, timesUsed, lastUsedAt
- Indexes: (curriculumId, chapterId), (status, visibility), createdById, difficulty. These match the filters that exam generation will use.

---

## API (current)

All endpoints except register and login need `Authorization: Bearer <token>`.

| Method | Path | Who | Notes |
|--------|------|-----|-------|
| POST | `/api/auth/register` | public | Students by default; `role: "INSTRUCTOR"` requires `inviteCode` |
| POST | `/api/auth/login` | public | Returns `{ user, token }` |
| GET | `/api/auth/me` | any user | |
| GET | `/api/curricula` | any user | Includes chapters |
| POST | `/api/curricula` | instructor | |
| GET/POST | `/api/curricula/:id/chapters` | GET any user / POST instructor | |
| GET | `/api/questions` | instructor | Filters: `curriculumId, chapterId, difficulty, status, visibility, mine=true, page, pageSize` |
| POST | `/api/questions` | instructor | Always created as `PENDING`, `source: MANUAL` |
| GET | `/api/questions/bank` | instructor | Approved questions only (the question bank) |
| GET | `/api/questions/:id` | instructor | 404 if not visible to you |
| POST | `/api/questions/:id/approve` | instructor | Records approvedBy and approvedAt; 409 if not pending |
| POST | `/api/questions/:id/reject` | instructor | Optional `{ reason }`; 409 if not pending |

---

## Key design decisions (to defend in the presentation)

1. **Privacy lives in one function.** `visibleToInstructor()` in `src/server/questions.ts` is the only definition of "who can see what": your own questions plus shared ones. Every list, get, approve, and reject call goes through it, so no single endpoint can forget the rule.
2. **Students are blocked at the role check.** Every `/api/questions*` route calls `requireRole(req, "INSTRUCTOR")`, so students get a 403 before any query runs.
3. **404 instead of 403 for other people's private questions.** This doesn't reveal that the question exists.
4. **Who can approve:** any instructor who can *see* the question. Shared questions get peer review. A private question can only be approved by its owner, since nobody else can see it.
5. **Race-safe approval.** The update is conditional (`WHERE id = ? AND status = 'PENDING'`), so two instructors approving at the same moment cannot both succeed.
6. **Approval is final.** Approved and rejected questions cannot be reviewed again (409). Editing and resubmitting can be added later.
7. **Instructor sign-up needs an invite code** (env variable). Otherwise anyone could make themselves an instructor and read the bank.
8. **The user is reloaded from the DB on every request** instead of trusting the role inside the token. A role change or a deleted account takes effect immediately.
9. **Future-proofing:** `source` (MANUAL/AI) already exists for AI generation, and `timesUsed`/`lastUsedAt` exist for exam generation. Indexes match the exam-builder filters. `options` JSON supports MCQ without a schema change.
10. **Config comes only from environment variables** (12-factor), so the same build runs locally and in the cloud.

---

## Verification log

- `tsc --noEmit` and `eslint`: clean.
- Migration `20261016091130_init` applied to the Docker DB.
- Live API smoke test: **28/28 checks passed**, covering:
  - registration, invite code, login, wrong password, missing token
  - curriculum and chapter permissions
  - validation: difficulty range, chapter/curriculum mismatch, MCQ answer
  - private versus shared visibility
  - approve records approver and time; double approve and approve-after-reject return 409
  - bank is approved-only; filters work
  - students get 403 on every question endpoint
- These checks will become permanent automated tests in sub-step 5.

## Open questions for the student

- Should instructors be allowed to **edit** a question after rejection and resubmit it? This is not built yet.
- Should an instructor be allowed to **approve their own shared question**, or should shared questions require a different instructor? Currently both are allowed.
- The project folder is not a git repository yet. Run `git init` and commit when you're ready.
