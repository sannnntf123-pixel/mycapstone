"""Builds docs/Capstone_Technical_Report_Step1.pdf.

Usage:  python3 -m venv .venv-report && .venv-report/bin/pip install reportlab
        .venv-report/bin/python docs/report/build_report.py docs/Capstone_Technical_Report_Step1.pdf
"""
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Preformatted, NextPageTemplate,
)
from reportlab.graphics.shapes import Drawing, Rect, String, Line, Polygon

OUT = sys.argv[1] if len(sys.argv) > 1 else "docs/Capstone_Technical_Report_Step1.pdf"
REPORT_DATE = "19 October 2026"
SCOPE = "Step 1: Foundation (sub-steps 1 to 3)"

INK = colors.HexColor("#1F2937")
MUTED = colors.HexColor("#6B7280")
ACCENT = colors.HexColor("#1D4ED8")
ACCENT_LIGHT = colors.HexColor("#DBEAFE")
RULE = colors.HexColor("#D1D5DB")
CODE_BG = colors.HexColor("#F3F4F6")
HEAD_BG = colors.HexColor("#E5E7EB")
GREEN = colors.HexColor("#047857")
AMBER = colors.HexColor("#B45309")
RED = colors.HexColor("#B91C1C")

ss = getSampleStyleSheet()
body = ParagraphStyle("body", parent=ss["Normal"], fontName="Helvetica", fontSize=9.5, leading=13.5, textColor=INK, spaceAfter=5)
small = ParagraphStyle("small", parent=body, fontSize=8.3, leading=11, spaceAfter=0)
cell = ParagraphStyle("cell", parent=body, fontSize=8.3, leading=10.8, spaceAfter=0)
cellb = ParagraphStyle("cellb", parent=cell, fontName="Helvetica-Bold")
h1 = ParagraphStyle("h1", parent=body, fontName="Helvetica-Bold", fontSize=16, leading=20, textColor=ACCENT, spaceBefore=10, spaceAfter=8, keepWithNext=1)
h2 = ParagraphStyle("h2", parent=body, fontName="Helvetica-Bold", fontSize=11.5, leading=15, textColor=INK, spaceBefore=10, spaceAfter=5, keepWithNext=1)
bullet = ParagraphStyle("bullet", parent=body, leftIndent=12, bulletIndent=2, spaceAfter=2.5)
caption = ParagraphStyle("caption", parent=small, textColor=MUTED, alignment=TA_CENTER, spaceBefore=3, spaceAfter=8)
code_style = ParagraphStyle("code", fontName="Courier", fontSize=7.6, leading=9.6, textColor=INK)

story = []
P = lambda t, s=body: story.append(Paragraph(t, s))
H1 = lambda t: story.append(Paragraph(t, h1))
H2 = lambda t: story.append(Paragraph(t, h2))
OK = '<font color="#047857"><b>Done</b></font>'
NEXT = '<font color="#B45309"><b>Next</b></font>'
PASS = '<font color="#047857"><b>PASS</b></font>'


def C(t):
    return f'<font face="Courier">{t}</font>'


def bullets(items):
    for it in items:
        story.append(Paragraph(it, bullet, bulletText="•"))
    story.append(Spacer(1, 3))


def code(text):
    t = Table([[Preformatted(text.strip("\n"), code_style)]], colWidths=[170 * mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), CODE_BG), ("BOX", (0, 0), (-1, -1), 0.5, RULE),
        ("LEFTPADDING", (0, 0), (-1, -1), 7), ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t)
    story.append(Spacer(1, 6))


def table(rows, widths, bold_first_col=False):
    data = [[Paragraph(v, cellb if (r == 0 or (bold_first_col and c == 0)) else cell) for c, v in enumerate(row)]
            for r, row in enumerate(rows)]
    t = Table(data, colWidths=[w * mm for w in widths], repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), HEAD_BG), ("LINEBELOW", (0, 0), (-1, 0), 0.8, MUTED),
        ("LINEBELOW", (0, 1), (-1, -1), 0.3, RULE), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]
    for i in range(2, len(rows), 2):
        style.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#F9FAFB")))
    t.setStyle(TableStyle(style))
    story.append(t)
    story.append(Spacer(1, 7))


# ---------- diagrams ----------
def box(d, x, y, w, h, title, sub="", fill=ACCENT_LIGHT, stroke=ACCENT):
    d.add(Rect(x, y, w, h, rx=4, ry=4, fillColor=fill, strokeColor=stroke, strokeWidth=0.8))
    d.add(String(x + w / 2, y + h - 13, title, fontName="Helvetica-Bold", fontSize=8.5, fillColor=INK, textAnchor="middle"))
    for i, line in enumerate(sub.split("\n") if sub else []):
        d.add(String(x + w / 2, y + h - 25 - i * 10, line, fontName="Helvetica", fontSize=7, fillColor=MUTED, textAnchor="middle"))


def arrow_down(d, x, y1, y2):
    d.add(Line(x, y1, x, y2 + 4, strokeColor=MUTED, strokeWidth=0.9))
    d.add(Polygon([x - 3, y2 + 5, x + 3, y2 + 5, x, y2], fillColor=MUTED, strokeColor=MUTED))


def architecture():
    d = Drawing(480, 330)
    layers = [
        ("HTTP client (instructor)", "Postman / curl / future Next.js UI\nAuthorization: Bearer <JWT>"),
        ("Route handlers  (src/app/api/**/route.ts)", "Thin: parse input, call guard, call service"),
        ("Guards + validation  (src/lib)", "requireRole('INSTRUCTOR')  |  Zod schemas\nhandle() maps errors to JSON"),
        ("Domain services  (src/server/questions.ts)", "visibleToInstructor()  |  approve / reject\ncross-entity checks"),
        ("Prisma Client  (src/lib/prisma.ts)", "Type-safe queries, singleton connection"),
        ("PostgreSQL 16  (Docker, host port 5434)", "users | curricula | chapters | questions"),
    ]
    h, gap, y = 40, 12, 326 - 40
    for i, (t, s) in enumerate(layers):
        fill = colors.HexColor("#ECFDF5") if i == 5 else (colors.white if i == 0 else ACCENT_LIGHT)
        stroke = GREEN if i == 5 else (MUTED if i == 0 else ACCENT)
        box(d, 100, y, 240, h, t, s, fill, stroke)
        if i < len(layers) - 1:
            arrow_down(d, 220, y, y - gap)
        y -= h + gap
    d.add(Rect(372, 96, 104, 180, rx=4, ry=4, fillColor=colors.HexColor("#FFFBEB"), strokeColor=AMBER, strokeWidth=0.8))
    d.add(String(424, 262, ".env (12-factor)", fontName="Helvetica-Bold", fontSize=8, fillColor=INK, textAnchor="middle"))
    for name, yy in [("JWT_SECRET", 234), ("JWT_EXPIRES_IN", 209), ("INSTRUCTOR_INVITE_CODE", 184), ("DATABASE_URL", 159)]:
        d.add(String(424, yy, name, fontName="Courier", fontSize=6.8, fillColor=AMBER, textAnchor="middle"))
    return d


def state_machine():
    d = Drawing(480, 145)
    box(d, 20, 55, 110, 44, "PENDING", "created_by set\napproved_by = null", colors.HexColor("#FFFBEB"), AMBER)
    box(d, 330, 95, 130, 44, "APPROVED", "approved_by, approved_at set\nin the question bank", colors.HexColor("#ECFDF5"), GREEN)
    box(d, 330, 10, 130, 44, "REJECTED", "rejection_reason (optional)\nnot in the bank", colors.HexColor("#FEF2F2"), RED)
    d.add(Line(130, 85, 326, 117, strokeColor=MUTED, strokeWidth=0.9))
    d.add(Polygon([322, 119, 324, 113, 330, 117.5], fillColor=MUTED, strokeColor=MUTED))
    d.add(String(225, 110, "POST /questions/:id/approve", fontName="Courier", fontSize=7, fillColor=INK, textAnchor="middle"))
    d.add(Line(130, 68, 326, 34, strokeColor=MUTED, strokeWidth=0.9))
    d.add(Polygon([322, 31, 324, 37, 330, 33], fillColor=MUTED, strokeColor=MUTED))
    d.add(String(225, 40, "POST /questions/:id/reject", fontName="Courier", fontSize=7, fillColor=INK, textAnchor="middle"))
    d.add(String(395, 70, "terminal: further review -> 409", fontName="Helvetica-Oblique", fontSize=7, fillColor=MUTED, textAnchor="middle"))
    d.add(String(75, 134, "POST /questions (always)", fontName="Courier", fontSize=7, fillColor=INK, textAnchor="middle"))
    arrow_down(d, 75, 130, 101)
    return d


def erd():
    d = Drawing(480, 200)

    def ent(x, y, name, fields, w=108):
        h = 22 + 10.5 * len(fields)
        d.add(Rect(x, y, w, h, fillColor=colors.white, strokeColor=ACCENT, strokeWidth=0.8))
        d.add(Rect(x, y + h - 15, w, 15, fillColor=ACCENT, strokeColor=ACCENT))
        d.add(String(x + w / 2, y + h - 11, name, fontName="Helvetica-Bold", fontSize=8, fillColor=colors.white, textAnchor="middle"))
        for i, f in enumerate(fields):
            d.add(String(x + 5, y + h - 26 - i * 10.5, f, fontName="Courier", fontSize=6.6, fillColor=INK))

    def rel(x1, y1, x2, y2, label):
        d.add(Line(x1, y1, x2, y2, strokeColor=MUTED, strokeWidth=0.8, strokeDashArray=[2, 2]))
        d.add(String((x1 + x2) / 2, (y1 + y2) / 2 + 3, label, fontName="Helvetica", fontSize=6.5, fillColor=MUTED, textAnchor="middle"))

    ent(5, 105, "users", ["PK id", "   email (unique)", "   passwordHash", "   name", "   role: INSTRUCTOR"])
    ent(5, 5, "curricula", ["PK id", "   name (unique)", "   description", "FK createdById"])
    ent(170, 5, "chapters", ["PK id", "FK curriculumId", "   title", "   orderIndex"])
    ent(350, 10, "questions", ["PK id", "   content / options / answer", "FK curriculumId", "FK (chapterId, curriculumId)",
                                "   difficulty, est.Minutes", "   source, status, visibility", "FK createdById",
                                "FK approvedById (nullable)", "   rejectionReason", "   timesUsed, lastUsedAt"], w=125)
    rel(60, 105, 60, 69, "1 : N creates")
    rel(113, 35, 170, 35, "1 : N (cascade)")
    rel(278, 35, 350, 50, "1 : N")
    rel(113, 150, 350, 120, "1 : N created_by / approved_by")
    return d


def on_page(canv, doc):
    canv.saveState()
    canv.setStrokeColor(RULE)
    canv.line(20 * mm, 15 * mm, 190 * mm, 15 * mm)
    canv.setFont("Helvetica", 7.5)
    canv.setFillColor(MUTED)
    canv.drawString(20 * mm, 10.5 * mm, "Exam Question Bank - Capstone Technical Report (Step 1, sub-steps 1-3)")
    canv.drawRightString(190 * mm, 10.5 * mm, f"Page {doc.page}")
    canv.restoreState()


def on_cover(canv, doc):
    canv.saveState()
    canv.setFillColor(ACCENT)
    canv.rect(0, A4[1] - 95 * mm, A4[0], 95 * mm, stroke=0, fill=1)
    canv.restoreState()


# ================= COVER =================
story.append(Spacer(1, 22 * mm))
story.append(Paragraph("Cloud-Based Exam Question Bank<br/>with AI-Assisted Exam Generation",
                       ParagraphStyle("ct", parent=body, fontName="Helvetica-Bold", fontSize=26, leading=31, textColor=colors.white)))
story.append(Spacer(1, 5 * mm))
story.append(Paragraph("Technical Progress Report  |  " + SCOPE,
                       ParagraphStyle("cs", parent=body, fontSize=12.5, leading=17, textColor=colors.HexColor("#DBEAFE"))))
story.append(Spacer(1, 36 * mm))


def kpi(value, label):
    return [Paragraph(f'<font size="20" color="#1D4ED8"><b>{value}</b></font>', ParagraphStyle("k", parent=body, alignment=TA_CENTER, leading=24)),
            Paragraph(label, ParagraphStyle("kl", parent=small, alignment=TA_CENTER, textColor=MUTED))]


k = [kpi("3", "migrations<br/>5 CHECK constraints"), kpi("13", "API operations<br/>in 9 route files"),
     kpi("8", "secondary indexes<br/>6 foreign keys"), kpi("56/56", "end-to-end API<br/>checks passing")]
kt = Table([[x[0] for x in k], [x[1] for x in k]], colWidths=[42.5 * mm] * 4)
kt.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.6, RULE), ("INNERGRID", (0, 0), (-1, -1), 0.4, RULE),
                        ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))
story.append(kt)
story.append(Spacer(1, 10 * mm))
table([
    ["Item", "Detail"],
    ["Report date", REPORT_DATE],
    ["Repository", C("github.com/sannnntf123-pixel/mycapstone")],
    ["Stack", "Next.js 15.5 (App Router, TypeScript) | PostgreSQL 16 | Prisma 6.19 | JWT (jose) | Zod"],
    ["Users", "Instructors only. Instructors author and approve questions and (in a later step) generate exams."],
    ["Status", "Project setup, schema, REST API and security hardening (sub-step 3) are complete and verified. "
               "Seed data, automated test suite, app Dockerfile and README are next."],
], [38, 132], bold_first_col=True)
story.append(NextPageTemplate("body"))
story.append(PageBreak())

# ================= 1. SUMMARY =================
H1("1. Executive summary")
P("This report documents the first delivered increment of the capstone: the back-end foundation for a question bank "
  "used by <b>instructors</b>. Instructors author exam questions; every question passes an explicit instructor approval "
  "step before it enters the bank; and each question can be kept private or shared with other instructors. Later "
  "increments will add AI question generation and AI exam assembly, both for instructors. The schema already carries "
  "the fields those features need, so they can be added without restructuring the data model.")
P("<b>Scope change (19 Oct 2026):</b> the system no longer has a Student role. Student exam-taking was removed from the "
  "plan and the role was dropped from the schema with a dedicated migration (Section 4.6). The system is instructor-only, "
  "and every endpoint except registration and login requires an authenticated instructor.")
P("The implementation is a Next.js 15 application exposing a JSON REST API through App Router route handlers, backed "
  "by PostgreSQL through the Prisma ORM. Authentication is stateless (signed JWT bearer tokens) and gated by an "
  "invite code; authorization for questions is row-level: the visibility rule is defined in exactly one function "
  "and every question query is composed with it. All 56 end-to-end checks pass against the running server and a "
  "real database.")
P("<b>Hardening (sub-step 3):</b> the database now enforces the business rules itself (CHECK constraints and a "
  "composite foreign key), failed logins and invite-code guesses are rate-limited, login timing no longer reveals which "
  "emails exist, configuration is validated at startup, and malformed requests return 400 instead of 500. The test "
  "suite grew to 56 checks and caught a real IP-spoofing weakness during development (Section 12.1).")

H2("1.1 Scope and status")
table([
    ["#", "Sub-step (Step 1)", "Status", "Evidence"],
    ["1", "Project setup: Next.js, Prisma, PostgreSQL in Docker, schema and initial migration", OK, "Migration 20261016091130_init"],
    ["2", "REST API: auth, curricula/chapters, questions (create, list/filter, get, approve, reject, bank)", OK, "Live checks; tsc + eslint clean"],
    ["2b", "Scope change: remove Student role, instructor-only system", OK, "Migration 20261019100000_remove_student_role"],
    ["3", "Guard review and hardening: DB constraints, rate limiting, timing-safe login, startup config validation", OK, "Migration 20261019120000_db_integrity_checks; 56/56 checks"],
    ["4", "Seed data (instructors, 2 curricula with chapters, questions in each state)", NEXT, "-"],
    ["5", "Automated test suite (approval + privacy) on an isolated test DB", "To do", "scripts/smoke-test.mjs to be ported"],
    ["6", "App Dockerfile, full docker-compose, README", "To do", "DB compose file exists"],
], [8, 92, 18, 52])
P("Out of scope for this step: AI question generation, exam generation and any user interface. Student exam-taking has been removed from the project.", small)

# ================= 2. STACK =================
H1("2. Technology stack")
table([
    ["Layer", "Choice (version)", "Rationale"],
    ["Runtime / framework", "Next.js 15.5.28, React 19.1, TypeScript 5, Node 23 (dev)",
     "One codebase serves the API now and the UI later. Route handlers are standard Web Request/Response functions, "
     "deployable to Vercel (serverless) or any container host."],
    ["Database", "PostgreSQL 16 (postgres:16-alpine)",
     "Data is strongly relational (curriculum > chapter > question > user). Native enum types, JSON columns, mature "
     "managed offerings on every cloud (RDS, Cloud SQL, Azure, Neon, Supabase)."],
    ["ORM / migrations", "Prisma 6.19.3",
     "Declarative schema is both documentation and source of truth; versioned SQL migrations and a fully typed client, "
     "so a typo in a column name is a compile error."],
    ["Authentication", "jose 6.2 (JWT HS256), bcryptjs 3.0 (cost 10)",
     "Stateless tokens scale horizontally with no session store. jose runs on both the Node and Edge runtimes. "
     "Chosen over NextAuth because its Credentials provider makes server-side RBAC and API testing awkward."],
    ["Validation", "Zod 3.25",
     "Every body and query string is parsed at the boundary; types are inferred from schemas, so validation and "
     "TypeScript types cannot drift apart."],
    ["Containers", "Docker via Colima, docker-compose", "Reproducible database locally; same image family used in the cloud."],
], [28, 45, 97], bold_first_col=True)

# ================= 3. ARCHITECTURE =================
H1("3. Architecture")
P("The code is organised in strict layers. Each layer only calls the one beneath it, which keeps route handlers "
  "trivial and concentrates every business rule in a domain service that can be unit-tested without HTTP.")
story.append(architecture())
story.append(Paragraph("Figure 1 - Layered architecture and request path", caption))
H2("3.1 Folder structure")
code("""
my-capstone/
|-- prisma/
|   |-- schema.prisma                 data model (source of truth)
|   `-- migrations/                   init, remove_student_role, db_integrity_checks
|-- src/
|   |-- app/api/                      HTTP layer - thin route handlers
|   |   |-- auth/register|login|me/route.ts
|   |   |-- curricula/route.ts, curricula/[id]/chapters/route.ts
|   |   `-- questions/route.ts, bank/route.ts,
|   |       [id]/route.ts, [id]/approve/route.ts, [id]/reject/route.ts
|   |-- instrumentation.ts            validates config at server startup
|   |-- lib/                          cross-cutting infrastructure
|   |   |-- env.ts                    Zod-validated environment
|   |   |-- prisma.ts                 singleton PrismaClient
|   |   |-- auth.ts                   hashing, JWT, requireUser / requireRole
|   |   |-- rate-limit.ts             failed-attempt counters (429)
|   |   |-- errors.ts                 HttpError, handle(), readJson()
|   |   `-- validation.ts             Zod schemas for every input
|   `-- server/questions.ts           privacy filter + approval workflow
|-- scripts/smoke-test.mjs            end-to-end API checks (npm run smoke)
|-- docs/                             this report + its generator
|-- docker-compose.yml   .env.example   PROCESS.md
""")
H2("3.2 Request lifecycle")
bullets([
    "The route handler is wrapped in " + C("handle()") + ", so any thrown error becomes a JSON response with the right status code.",
    C("requireRole(req, 'INSTRUCTOR')") + " verifies the bearer JWT signature and expiry, then <b>reloads the user from the database</b> and checks the role.",
    "The request body or query string is parsed by a Zod schema; failure produces HTTP 400 with per-field messages.",
    "The domain service applies business rules (visibility, chapter-belongs-to-curriculum, status transitions) and queries via Prisma.",
    "The handler returns " + C("NextResponse.json(...)") + " with 200/201.",
])
P("Extension points for later steps: " + C("src/server/ai.ts") + ", " + C("src/server/exams.ts") + " and " +
  C("src/app/api/exams/**") + " plug in at the same layers; UI pages go under " + C("src/app/") + ".")

# ================= 4. DATABASE =================
H1("4. Database design")
story.append(erd())
story.append(Paragraph("Figure 2 - Entity-relationship overview", caption))
P("Primary keys are " + C("cuid") + " strings rather than auto-increment integers: they are non-guessable "
  "(no enumeration of other instructors' questions by incrementing an id), can be generated without a database "
  "round-trip, and are safe to merge across environments. Table names are mapped to snake-case plurals via "
  + C("@@map") + ". All tables carry " + C("createdAt") + " and an automatically maintained " + C("updatedAt") + ".")
H2("4.1 Enumerated types (native PostgreSQL ENUMs)")
table([
    ["Type", "Values", "Used by"],
    ["Role", "INSTRUCTOR", "users.role (default INSTRUCTOR). Kept as an enum so further roles (e.g. Admin) can be added by migration without touching the auth layer."],
    ["QuestionStatus", "PENDING, APPROVED, REJECTED", "questions.status (default PENDING)"],
    ["Visibility", "PRIVATE, SHARED", "questions.visibility (default PRIVATE)"],
    ["QuestionSource", "MANUAL, AI", "questions.source (default MANUAL; AI reserved for a later step)"],
], [32, 50, 88], bold_first_col=True)
H2("4.2 Table: questions")
table([
    ["Column", "Type", "Null", "Notes"],
    ["id", "text (cuid)", "no", "Primary key"],
    ["content", "text", "no", "Question stem"],
    ["options", "jsonb", "yes", "Array of choices for MCQ; null for open questions. API enforces answer is one of them."],
    ["answer", "text", "no", "Correct answer / model solution"],
    ["curriculumId", "text FK", "no", "-> curricula.id, ON DELETE RESTRICT"],
    ["chapterId", "text FK", "no", "Composite FK (chapterId, curriculumId) -> chapters(id, curriculumId): the DB guarantees the chapter belongs to the curriculum"],
    ["difficulty", "integer", "no", "1-5 (Zod + DB CHECK)"],
    ["estimatedTimeMinutes", "integer", "no", "1-600 (Zod + DB CHECK); input for exam-duration planning"],
    ["source", "QuestionSource", "no", "Forced to MANUAL by the create endpoint"],
    ["createdById", "text FK", "no", "-> users.id, ON DELETE RESTRICT; the owner"],
    ["status", "QuestionStatus", "no", "Forced to PENDING on create"],
    ["approvedById", "text FK", "yes", "-> users.id, ON DELETE SET NULL; set only on approval"],
    ["approvedAt", "timestamp(3)", "yes", "Set exactly when status = APPROVED (DB CHECK)"],
    ["rejectionReason", "text", "yes", "Optional reviewer comment on rejection"],
    ["visibility", "Visibility", "no", "PRIVATE by default (privacy-safe default)"],
    ["timesUsed", "integer", "no", "Default 0, never negative (DB CHECK); incremented by exam generation later"],
    ["lastUsedAt", "timestamp(3)", "yes", "Lets exam generation prefer less recently used questions"],
    ["createdAt / updatedAt", "timestamp(3)", "no", "Audit timestamps"],
], [36, 25, 10, 99])
H2("4.3 Tables: users, curricula, chapters")
table([
    ["Table", "Columns", "Constraints"],
    ["users", "id, email, passwordHash, name, role, createdAt, updatedAt", "email UNIQUE. Only a bcrypt hash is stored, never the password."],
    ["curricula", "id, name, description?, createdById, createdAt, updatedAt", "name UNIQUE; createdById -> users (RESTRICT)"],
    ["chapters", "id, curriculumId, title, orderIndex, createdAt, updatedAt",
     "UNIQUE(curriculumId, orderIndex), UNIQUE(curriculumId, title), UNIQUE(id, curriculumId); orderIndex > 0 (CHECK); curriculumId -> curricula ON DELETE CASCADE"],
], [22, 70, 78], bold_first_col=True)
H2("4.4 Indexes and why each exists")
table([
    ["Index", "Columns", "Serves"],
    ["questions_curriculumId_chapterId_idx", "(curriculumId, chapterId)", "Filtering by curriculum and chapter; the primary access path for exam assembly"],
    ["questions_status_visibility_idx", "(status, visibility)", "Bank queries (status = APPROVED) combined with the shared-visibility predicate"],
    ["questions_createdById_idx", "(createdById)", "The 'own questions' branch of the privacy filter and ?mine=true"],
    ["questions_difficulty_idx", "(difficulty)", "Difficulty filtering / difficulty-balanced exam generation"],
    ["users_email_key", "UNIQUE(email)", "Login lookup and duplicate-registration prevention"],
    ["curricula_name_key", "UNIQUE(name)", "Prevents duplicate curricula"],
    ["chapters_..._orderIndex_key / _title_key", "UNIQUE per curriculum", "Stable chapter ordering; no duplicate chapter titles"],
    ["chapters_id_curriculumId_key", "UNIQUE(id, curriculumId)", "Target of the composite foreign key from questions"],
], [58, 38, 74])
H2("4.5 Referential-integrity decisions")
bullets([
    "<b>Deleting a curriculum cascades to its chapters</b>, but is <b>blocked</b> (RESTRICT) while any question references it, so approved bank content can never disappear silently.",
    "<b>Deleting a user is blocked</b> while they own questions or curricula. If an approver is removed, " + C("approvedById") + " becomes NULL (SET NULL) while " + C("approvedAt") + " keeps the historical fact.",
    "Denormalising " + C("curriculumId") + " onto questions (it is derivable through the chapter) is deliberate: it makes the most common filter a single-column index lookup with no join. "
    "The risk of denormalisation (the two copies disagreeing) is removed by the composite foreign key (Section 4.7).",
])
H2("4.6 Migration history")
table([
    ["Migration", "Change"],
    ["20261016091130_init", "Creates the four tables, four enum types, eight secondary indexes and six foreign keys."],
    ["20261019100000_remove_student_role", "Deletes accounts with role STUDENT, then recreates the Role enum with INSTRUCTOR only "
     "(PostgreSQL cannot drop an enum value in place) and sets the default to INSTRUCTOR. Safe: students could never own "
     "curricula or questions, so no rows are orphaned."],
], [55, 115], bold_first_col=True)
code("""
DELETE FROM "users" WHERE "role" = 'STUDENT';
CREATE TYPE "Role_new" AS ENUM ('INSTRUCTOR');
ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'INSTRUCTOR';
""")
P("After applying it, " + C("prisma migrate diff") + " between the live database and " + C("schema.prisma") +
  " produced an empty migration, confirming the database and schema are in sync.")
table([
    ["Migration", "Change"],
    ["20261019120000_db_integrity_checks", "Adds the composite foreign key and five CHECK constraints described in Section 4.7. "
     "Before applying it, the existing rows were queried and none violated the new rules."],
], [55, 115], bold_first_col=True)

H2("4.7 Rules enforced by the database itself (defence in depth)")
P("Every rule below was already validated by the API. Enforcing it a second time in PostgreSQL means that a future bug, "
  "a new code path (for example the AI generator writing questions), or a manual SQL edit still cannot store invalid "
  "data. Prisma's schema language cannot express CHECK constraints, so they live in a hand-written migration.")
table([
    ["Constraint", "Rule", "Why"],
    ["questions_chapterId_curriculumId_fkey", "(chapterId, curriculumId) -> chapters(id, curriculumId)",
     "A question's chapter must belong to the question's curriculum; makes the denormalised curriculumId safe"],
    ["questions_difficulty_range", "difficulty BETWEEN 1 AND 5", "Exam generation relies on the 1-5 scale"],
    ["questions_estimated_time_range", "estimatedTimeMinutes BETWEEN 1 AND 600", "Exam duration sums must be meaningful"],
    ["questions_times_used_non_negative", "timesUsed >= 0", "Usage statistics can never go negative"],
    ["questions_approval_consistency", "(status = 'APPROVED') = (approvedAt IS NOT NULL)",
     "Approval date exists exactly for approved questions. approvedById is excluded because it becomes NULL if the approver's account is deleted"],
    ["chapters_order_index_positive", "orderIndex > 0", "Chapter numbering starts at 1"],
], [52, 55, 63])
code("""
ALTER TABLE "questions" ADD CONSTRAINT "questions_chapterId_curriculumId_fkey"
  FOREIGN KEY ("chapterId", "curriculumId") REFERENCES "chapters"("id", "curriculumId");
ALTER TABLE "questions" ADD CONSTRAINT "questions_approval_consistency"
  CHECK (("status" = 'APPROVED') = ("approvedAt" IS NOT NULL));
""")
P("The test script verifies each rule by running SQL directly inside the database container, bypassing the API, and "
  "checking that PostgreSQL rejects the write with the expected constraint name (Section 11).")

# ================= 5. AUTH =================
H1("5. Authentication and access control")
H2("5.1 Registration and login")
bullets([
    "Passwords are hashed with <b>bcrypt, cost factor 10</b> (salted, deliberately slow); length 8 characters to "
    "<b>72 bytes</b>. bcrypt silently ignores everything after 72 bytes, so longer passwords are rejected rather than "
    "giving a false sense of security.",
    "<b>Every registration requires an invite code</b> equal to the " + C("INSTRUCTOR_INVITE_CODE") +
    " environment variable (missing code: 400, wrong code: 403). Without this, anyone on the internet could create an "
    "account and read the shared question bank. If the variable is not set, registration fails closed.",
    "The role is <b>always set server-side</b> to INSTRUCTOR; a " + C("role") + " field sent by the client is ignored.",
    "Login returns the same <i>'Invalid email or password'</i> (401) for an unknown email and a wrong password, and "
    "<b>takes the same time</b>: for an unknown email the password is still compared against a fixed dummy bcrypt hash. "
    "Measured: 56 ms vs 55 ms average. Without this, the faster answer for unknown emails would reveal which accounts exist.",
    "Emails are normalised to lower case before storage and lookup.",
])
H2("5.2 Token design")
table([
    ["Property", "Value"],
    ["Format / algorithm", "JWT, HS256 (HMAC-SHA256) signed with JWT_SECRET (random 256-bit, generated with openssl)"],
    ["Claims", C("sub") + " = user id, " + C("role") + ", " + C("iat") + ", " + C("exp")],
    ["Lifetime", "JWT_EXPIRES_IN, default 8h (a teaching day)"],
    ["Transport", C("Authorization: Bearer &lt;token&gt;") + " header (no cookies, therefore no CSRF surface for the API)"],
    ["Verification", "jose.jwtVerify with <b>algorithms pinned to HS256</b> (a token claiming another algorithm, e.g. 'none', is rejected); then the user row is reloaded"],
    ["Secret strength", "JWT_SECRET must be at least 32 characters, checked at server startup (Section 5.5)"],
], [38, 132], bold_first_col=True)
P("<b>Why reload the user on every request?</b> The token's " + C("role") + " claim is informational only; authorization "
  "uses the role read from the database. A deleted account or a changed role therefore takes effect on the next "
  "request instead of when the token expires. The cost is one primary-key lookup per request.")
code("""
export async function requireRole(req: Request, ...roles: Role[]) {
  const user = await requireUser(req);                 // 401 if missing/invalid/expired
  if (!roles.includes(user.role)) throw forbidden();   // 403 if wrong role
  return user;
}
""")
P("Every protected route calls " + C("requireRole(req, 'INSTRUCTOR')") + " explicitly, even though INSTRUCTOR is "
  "currently the only role. This keeps each endpoint's permission visible in its own code and means that adding a "
  "new role later cannot silently grant it access to existing endpoints.")
H2("5.3 Permission matrix")
Y = '<font color="#047857"><b>yes</b></font>'
table([
    ["Operation", "Anonymous", "Instructor"],
    ["Register (with invite code) / login", "yes", "-"],
    ["GET /api/auth/me", "no (401)", Y],
    ["List curricula and chapters", "no (401)", Y],
    ["Create curriculum / chapter", "no (401)", Y],
    ["Create question", "no (401)", Y],
    ["List / filter / get questions", "no (401)", "own + shared only"],
    ["View question bank", "no (401)", "approved, own + shared"],
    ["Approve / reject", "no (401)", "pending questions visible to them"],
    ["Generate exams (later step)", "no (401)", "planned"],
], [75, 35, 60], bold_first_col=True)
P("<b>Audit (sub-step 3):</b> all 13 operations were checked against this matrix. Every handler is wrapped in "
  + C("handle()") + ", every protected handler calls " + C("requireRole(req, 'INSTRUCTOR')") + " (" + C("/auth/me") +
  " was changed from a plain login check to the explicit role check), and every request body goes through " + C("readJson()") +
  " and a Zod schema.")

H2("5.4 Rate limiting (brute-force protection)")
table([
    ["Target", "Counter key", "Rule"],
    ["Login", C("login:&lt;email&gt;"), "After 5 failed logins for an account within 15 minutes, every login attempt for it returns 429 with a Retry-After header, even with the correct password. A successful login resets the counter."],
    ["Registration", C("register:&lt;client IP&gt;"), "After 5 wrong invite codes within 15 minutes, registration returns 429, even with the correct code (otherwise a correct guess would still be confirmed)."],
], [24, 40, 106], bold_first_col=True)
bullets([
    "Limits are configurable with " + C("RATE_LIMIT_MAX_ATTEMPTS") + " and " + C("RATE_LIMIT_WINDOW_MINUTES") + ".",
    "<b>Login is limited per account, not per IP.</b> An attacker who rotates IP addresses still gets only 5 guesses per account per window. "
    "Trade-off: an attacker can deliberately lock a known account for 15 minutes (a nuisance, not a breach).",
    "<b>Client IPs are only trusted behind a proxy.</b> " + C("X-Forwarded-For") + " is set by the client unless a proxy (Vercel, nginx) "
    "overwrites it. With " + C("TRUST_PROXY=false") + " (default) all invite-code attempts share one counter; with " + C("TRUST_PROXY=true") +
    " the proxy-appended last hop is used.",
    "The counters live in server memory behind a small " + C("AttemptStore") + " interface: correct for one instance; a multi-instance "
    "deployment would plug in a shared store such as Redis without changing the routes.",
])

H2("5.5 Fail-fast configuration")
P("All environment variables are validated with Zod in " + C("src/lib/env.ts") + ", called from " + C("src/instrumentation.ts") +
  ", which Next.js runs once at server startup. A missing or weak value stops the server immediately with a clear message, "
  "instead of failing on the first request in production. Verified by starting the server with an 8-character secret:")
code("""
Error: An error occurred while loading instrumentation hook: Invalid environment configuration:
  - JWT_SECRET: JWT_SECRET must be at least 32 characters (use: openssl rand -base64 32)
""")

# ================= 6. PRIVACY =================
H1("6. Privacy model (row-level authorization)")
P("<b>Rule:</b> an instructor may see a question if and only if they created it, or its visibility is SHARED. "
  "The rule lives in a single function:")
code("""
export function visibleToInstructor(userId: string): Prisma.QuestionWhereInput {
  return { OR: [{ createdById: userId }, { visibility: "SHARED" }] };
}

// every query composes the rule with the caller's filters using AND:
const where = { AND: [ visibleToInstructor(user.id),
                       { curriculumId, chapterId, difficulty, status, visibility, ... } ] };
""")
P("Because the rule is combined with " + C("AND") + ", no client-supplied filter can widen visibility. For example, "
  + C("?visibility=PRIVATE") + " returns only the caller's own private questions, never another instructor's (verified "
  "in Section 11). The rule is applied inside the database query rather than by filtering results in memory, so hidden "
  "rows never leave the database and pagination counts stay correct.")
table([
    ["Enforcement point", "Mechanism"],
    ["GET /api/questions, /api/questions/bank", "listQuestions() composes visibleToInstructor() into findMany and count"],
    ["GET /api/questions/:id", "getVisibleQuestion(): findFirst with id AND visibility rule; else 404"],
    ["approve / reject", "Both call getVisibleQuestion() first, so you cannot review what you cannot see"],
    ["Anonymous callers", "requireRole(req, 'INSTRUCTOR') on every route; 401 before any query runs"],
], [62, 108], bold_first_col=True)
P("<b>404 rather than 403</b> is returned for another instructor's private question, so the API does not even "
  "confirm that the question exists.")

# ================= 7. WORKFLOW =================
H1("7. Approval workflow")
story.append(state_machine())
story.append(Paragraph("Figure 3 - Question status state machine", caption))
table([
    ["Transition", "Preconditions", "Fields written"],
    ["create -> PENDING", "Instructor; chapter belongs to curriculum; MCQ answer within options",
     "status=PENDING, source=MANUAL, createdById=caller (all server-controlled, client cannot override)"],
    ["PENDING -> APPROVED", "Instructor who can see the question; status still PENDING", "approvedById=caller, approvedAt=now(), rejectionReason=null"],
    ["PENDING -> REJECTED", "Same as approve; optional reason", "rejectionReason=reason"],
    ["Reviewed -> any", "Not allowed (APPROVED and REJECTED are final)", "HTTP 409 Conflict"],
], [35, 62, 73], bold_first_col=True)
H2("7.1 Who may approve")
P("Any instructor who can see the question. Shared questions therefore get peer review from any colleague; a private "
  "question can only be approved by its owner (nobody else can see it). Whether an owner should be allowed to approve "
  "their <i>own shared</i> question is an open design question (Section 12).")
H2("7.2 Concurrency safety")
P("Two instructors could press 'approve' at the same moment. A naive read-check-write would let both succeed and the "
  "last write would overwrite " + C("approvedById") + ". The update is instead made <b>conditional on the current "
  "status</b>, which PostgreSQL evaluates atomically:")
code("""
const result = await prisma.question.updateMany({
  where: { id, status: "PENDING" },     // compare-and-set
  data,
});
if (result.count === 0) throw conflict("Question was reviewed by someone else");   // 409
""")
H2("7.3 The question bank")
P("The bank is defined as <b>status = APPROVED</b>, intersected with the visibility rule. " + C("GET /api/questions/bank") +
  " forces " + C("status: 'APPROVED'") + " server-side, overriding any status in the query string; this is the endpoint "
  "the exam generator will draw from in a later step.")

# ================= 8. VALIDATION =================
H1("8. Validation and error handling")
table([
    ["Schema", "Rules"],
    ["registerSchema", "email valid + lower-cased; password >= 8; name non-empty; inviteCode required (non-empty)"],
    ["createQuestionSchema", "content, answer non-empty; options: array of >= 2 non-empty strings (optional); difficulty int 1-5; "
                             "estimatedTimeMinutes int 1-600; visibility PRIVATE|SHARED (default PRIVATE)"],
    ["listQuestionsQuery", "query strings coerced to numbers; status/visibility enums; page >= 1; pageSize 1-100 (default 20)"],
    ["createChapterSchema", "title non-empty; orderIndex positive int"],
    ["rejectQuestionSchema", "reason optional; body itself optional"],
], [42, 128], bold_first_col=True)
P("Unknown fields such as " + C("role") + ", " + C("status") + " or " + C("createdById") +
  " are stripped by Zod, so clients cannot mass-assign protected fields (verified in Section 11).")
P("Request bodies are read with " + C("readJson()") + ": malformed JSON or a missing body now returns <b>400</b> instead of "
  "crashing with a 500. Before sub-step 3, the reject endpoint silently treated malformed JSON as 'no reason given'; it "
  "now rejects it too, while a genuinely empty body is still allowed there because the reason is optional.")
table([
    ["Status", "Meaning in this API"],
    ["200 / 201", "Success / resource created"],
    ["400", "Validation failed (with per-field details), malformed JSON, or inconsistent input (e.g. chapter not in curriculum)"],
    ["401", "Missing, invalid or expired token; bad login"],
    ["403", "Wrong role; invalid invite code"],
    ["404", "Not found, or not visible to the caller"],
    ["409", "Duplicate (email, curriculum, chapter) or invalid status transition / concurrent review"],
    ["429", "Too many failed logins or invite-code attempts; Retry-After header gives the seconds to wait"],
    ["500", "Unexpected error; logged server-side, generic message to client (no stack traces leak)"],
], [20, 150], bold_first_col=True)
code("""
HTTP/1.1 400 Bad Request
{ "error": "Validation failed",
  "details": { "difficulty": ["Number must be less than or equal to 5"] } }
""")

# ================= 9. API =================
H1("9. API reference")
table([
    ["Method", "Path", "Access", "Description"],
    ["POST", "/api/auth/register", "public + invite", "Create instructor account; returns { user, token } (201)"],
    ["POST", "/api/auth/login", "public", "Returns { user, token }"],
    ["GET", "/api/auth/me", "instructor", "Current user"],
    ["GET", "/api/curricula", "instructor", "All curricula with ordered chapters"],
    ["POST", "/api/curricula", "instructor", "Create curriculum { name, description? }"],
    ["GET", "/api/curricula/:id/chapters", "instructor", "Chapters of a curriculum, ordered"],
    ["POST", "/api/curricula/:id/chapters", "instructor", "Create chapter { title, orderIndex }"],
    ["GET", "/api/questions", "instructor", "List visible questions; filters + pagination"],
    ["POST", "/api/questions", "instructor", "Create question (PENDING)"],
    ["GET", "/api/questions/bank", "instructor", "Approved visible questions only"],
    ["GET", "/api/questions/:id", "instructor", "Single visible question"],
    ["POST", "/api/questions/:id/approve", "instructor", "Approve a pending question"],
    ["POST", "/api/questions/:id/reject", "instructor", "Reject; optional { reason }"],
], [14, 50, 24, 82])
P("<b>List filters:</b> " + C("curriculumId, chapterId, difficulty, status, visibility, mine=true, page, pageSize") +
  ". Results are ordered newest first and returned as " + C("{ items, total, page, pageSize }") + ".")
H2("9.1 Example: register and create a question")
code("""
POST /api/auth/register
{ "email": "alice@uni.edu", "password": "********", "name": "Alice", "inviteCode": "<code>" }
201 Created  { "user": { "id": "cmg...", "role": "INSTRUCTOR", ... },
               "token": "eyJhbGciOiJIUzI1NiJ9..." }

POST /api/questions
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
{ "content": "What is 1 + 1?", "options": ["1","2","3"], "answer": "2",
  "curriculumId": "cmg...", "chapterId": "cmg...", "difficulty": 1,
  "estimatedTimeMinutes": 2, "visibility": "SHARED" }

201 Created   (abridged)
{ "id": "cmg...", "status": "PENDING", "source": "MANUAL", "visibility": "SHARED",
  "approvedBy": null, "approvedAt": null, "timesUsed": 0,
  "chapter": { "title": "Algebra", "orderIndex": 1 }, "createdBy": { "name": "Alice" } }
""")
H2("9.2 Example: approve")
code("""
POST /api/questions/cmg.../approve          -> 200 { ..., "status": "APPROVED",
                                                  "approvedBy": { "name": "Bob" },
                                                  "approvedAt": "<ISO-8601 timestamp>" }
POST /api/questions/cmg.../approve (again)  -> 409 { "error": "Question is already approved" }
""")

# ================= 10. CONFIG =================
H1("10. Configuration and environment")
table([
    ["Variable", "Purpose", "Example / default"],
    ["DATABASE_URL", "PostgreSQL connection string", C("postgresql://capstone:***@localhost:5434/question_bank")],
    ["JWT_SECRET", "HMAC key for signing tokens (min 32 chars)", "random, from " + C("openssl rand -base64 32")],
    ["JWT_EXPIRES_IN", "Token lifetime", "8h"],
    ["INSTRUCTOR_INVITE_CODE", "Required to register (min 8 chars)", "set per deployment"],
    ["RATE_LIMIT_MAX_ATTEMPTS / _WINDOW_MINUTES", "Brute-force limits", "5 / 15"],
    ["TRUST_PROXY", "Trust X-Forwarded-For from a fronting proxy", "false (true on Vercel / behind nginx)"],
    ["DB_PORT, POSTGRES_*", "docker-compose overrides", "5434, capstone, question_bank"],
], [40, 60, 70], bold_first_col=True)
P("All configuration is read from the environment (12-factor), so the same build runs locally and in the cloud with "
  "different values. " + C(".env") + " is git-ignored; " + C(".env.example") + " is committed as the template.")
table([
    ["npm script", "Command"],
    ["dev", "next dev --turbopack -p 3100"],
    ["db:up / db:down", "docker-compose up -d / docker-compose down"],
    ["db:migrate", "prisma migrate dev"],
    ["db:studio", "prisma studio (visual DB browser)"],
    ["smoke", "node scripts/smoke-test.mjs (end-to-end checks against a running server)"],
    ["typecheck / lint", "tsc --noEmit / eslint"],
], [40, 130], bold_first_col=True)
code("""
npm install
cp .env.example .env          # set JWT_SECRET and INSTRUCTOR_INVITE_CODE
npm run db:up                 # Postgres on localhost:5434
npm run db:migrate            # apply migrations, generate client
npm run dev                   # API on http://localhost:3100
npm run smoke                 # in a second terminal
""")

# ================= 11. VERIFICATION =================
H1("11. Verification")
P("<b>Static checks:</b> " + C("tsc --noEmit") + " and " + C("eslint") + " report zero errors; " +
  C("prisma migrate diff") + " shows no drift between database and schema. <b>Dynamic checks:</b> "
  + C("scripts/smoke-test.mjs") + " registers fresh instructors and exercises every endpoint over HTTP against the "
  "running server and the real PostgreSQL database; the database-rule checks run SQL directly inside the container. "
  "Result after sub-step 3: <b>56 of 56 checks passed</b>.")
checks = [
    ("Auth", "Register without invite code -> 400; wrong invite code -> 403"),
    ("Auth", "Client-supplied role is ignored; account is INSTRUCTOR"),
    ("Auth", "Register two instructors; duplicate email -> 409"),
    ("Auth", "Login returns token; wrong password -> 401"),
    ("Auth", "/auth/me returns current user; garbage token -> 401"),
    ("Access", "No token on /auth/me, /curricula, /questions, /questions/bank -> 401 (4 checks)"),
    ("Curricula", "Create curriculum; duplicate name -> 409"),
    ("Curricula", "Create chapter; other instructor can list; no token -> 401"),
    ("Workflow", "New question is PENDING and PRIVATE by default; source MANUAL"),
    ("Validation", "Client cannot set status or owner on create"),
    ("Validation", "difficulty 7 -> 400; chapter from another curriculum -> 400; MCQ answer not in options -> 400"),
    ("Privacy", "Other instructor sees shared, not private"),
    ("Privacy", "?visibility=PRIVATE cannot reveal another instructor's questions"),
    ("Privacy", "Other instructor GET / approve / reject a private question -> 404"),
    ("Workflow", "Approve records approver + time; re-approve -> 409"),
    ("Workflow", "Owner rejects with reason; approving a rejected question -> 409"),
    ("Bank", "Bank contains only approved; ignores a status override in the query"),
    ("Filtering", "Filter by status + difficulty returns exactly the matching question"),
    ("Input", "Malformed JSON -> 400; empty body -> 400; malformed JSON on reject -> 400"),
    ("Input", "Password over 72 bytes -> 400"),
    ("Database", "Direct SQL: difficulty 9, estimatedTimeMinutes 0, chapter orderIndex 0 are rejected"),
    ("Database", "Direct SQL: APPROVED without approvedAt, and approvedAt on a non-approved question, are rejected"),
    ("Database", "Direct SQL: moving a question to a curriculum its chapter doesn't belong to is rejected"),
    ("Rate limit", "5 wrong passwords -> 401 each; 6th -> 429 with Retry-After; correct password also 429 while locked"),
    ("Rate limit", "Other accounts unaffected by one account's lock"),
    ("Rate limit", "Spoofed X-Forwarded-For (new fake IP per attempt) does not bypass the login limit"),
    ("Rate limit", "A successful login resets the failure counter"),
    ("Rate limit", "Wrong invite codes from spoofed IPs: 5 x 403, then 429; correct code also 429 while locked"),
    ("Config", "Server refuses to start with a JWT_SECRET under 32 characters (manual check)"),
    ("Timing", "Unknown email vs wrong password: 56 ms vs 55 ms average (manual check)"),
]
table([["Area", "Check", "Result"]] + [[a, c, PASS] for a, c in checks], [24, 128, 18])
P("Rows group related assertions; the script reports 56 individual checks (the last two rows were verified manually). "
  "The final section intentionally trips the invite-code limit, so the dev server must be restarted before re-running "
  "within the window. The checks will be ported to a permanent automated suite (Vitest, isolated test database) in sub-step 5.", small)

# ================= 12. ISSUES =================
H1("12. Engineering log, risks and open questions")
H2("12.1 Problems encountered and how they were resolved")
table([
    ["Problem", "Root cause", "Resolution"],
    ["npm ENOTEMPTY during install", "Dependency install started while create-next-app's own install was still writing node_modules",
     "Waited for all npm processes to exit, then reinstalled sequentially"],
    ["Prisma P1010 'access denied'", "A Homebrew PostgreSQL already listened on localhost:5432, so connections hit it instead of the container",
     "Mapped the container to host port 5434 (5433 used by another project), configurable via DB_PORT"],
    ["'docker compose' unknown", "Machine has the standalone docker-compose binary (Colima), not the CLI plugin", "npm scripts use docker-compose"],
    [".env.example ignored by git", "Default Next.js .gitignore ignores .env*", "Added !.env.example exception"],
    ["prisma migrate dev refused the enum change", "Removing an enum value that existing rows use needs interactive confirmation",
     "Wrote the migration by hand (Section 4.6), applied with migrate deploy, verified with migrate diff"],
    ["Rate limit bypassable by faking X-Forwarded-For (found by the new test)",
     "The first design keyed login failures by IP + email, reading the IP from X-Forwarded-For. The Next.js server passes the client's header through unchanged, so a fresh fake IP per attempt reset the counter",
     "Login limit keyed per account; client IPs trusted only with TRUST_PROXY=true behind a proxy that sets the header. The regression test now passes"],
    ["Broken JSON caused HTTP 500", "req.json() throws on malformed input and the error reached the generic handler",
     "readJson() helper returns 400; used by every route"],
    ["DB outage reported as 401", "A try/catch around both token verification and the user lookup swallowed database errors",
     "Narrowed the try/catch to token verification only; DB errors now surface as 500"],
], [38, 66, 66])
H2("12.2 Known limitations (to address in later sub-steps)")
bullets([
    "<b>Rate-limit counters are in memory.</b> They reset when the server restarts and are not shared between instances; a multi-instance deployment needs a shared store such as Redis.",
    "<b>Per-account login lockout can be abused</b> to lock a known account for 15 minutes. Acceptable for a small invite-only user base; CAPTCHA or progressive delays are the usual next step.",
    "<b>Without TRUST_PROXY</b>, all invite-code attempts share one counter, so repeated wrong codes from anyone pause registration for everyone for 15 minutes.",
    "<b>Tokens cannot be revoked early.</b> Mitigated by the per-request user reload (deleted users apply immediately); a token denylist or short-lived access + refresh tokens can follow.",
    "<b>A single shared invite code</b> gates registration; per-person invites or an admin approval step would allow revoking one person's invite.",
    "<b>options JSON is validated by Zod, not by the database.</b> Acceptable for now; could move to a dedicated table if per-option analytics are needed.",
])
H2("12.3 Open design questions")
bullets([
    "Should an instructor be allowed to approve their <b>own shared</b> question, or should shared questions require a second instructor (four-eyes principle)?",
    "Should a rejected question be <b>editable and resubmittable</b> (REJECTED -> PENDING), and should edits to an approved question send it back for review?",
    "Should instructors be able to change visibility after approval (e.g. share a previously private question)?",
])

# ================= 13. NEXT =================
H1("13. Next steps")
table([
    ["Sub-step", "Deliverable"],
    ["4 - Seed data", "prisma/seed.ts: several instructors, 2 curricula with chapters, questions in PENDING / APPROVED / REJECTED, private and shared"],
    ["5 - Automated tests", "Vitest suite on a separate test database covering the approval workflow and every privacy rule in Section 6"],
    ["6 - Cloud readiness", "Multi-stage Dockerfile (Next.js standalone output), docker-compose with app + db, README"],
    ["Later steps", "AI question generation (source = AI, still PENDING until approved); instructor-only AI exam generation by curriculum, chapters, difficulty and total duration"],
], [36, 134], bold_first_col=True)

# ---------- build ----------
doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=18 * mm, bottomMargin=20 * mm,
                      title="Capstone Technical Report - Step 1", author="Capstone project", subject="Exam Question Bank")
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="f")
doc.addPageTemplates([PageTemplate(id="cover", frames=[frame], onPage=on_cover),
                      PageTemplate(id="body", frames=[frame], onPage=on_page)])
doc.build(story)
print("written", OUT)
