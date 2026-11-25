// End-to-end check of the running API. Usage: npm run dev, then `npm run smoke`.
// Creates fresh users on every run. Note: the final section deliberately trips the
// per-IP invite-code rate limit, so registration from this machine stays blocked for
// RATE_LIMIT_WINDOW_MINUTES — restart the dev server before running the script again.
import { execFileSync } from "node:child_process";

const BASE = process.env.API_URL ?? "http://localhost:3100/api";
const INVITE = process.env.INSTRUCTOR_INVITE_CODE ?? "capstone-instructor";
const PROFILE = { major: "MATHEMATICS", degree: "DOCTORATE", university: "Test University", courses: ["Calculus I"] };
const MAX_ATTEMPTS = Number(process.env.RATE_LIMIT_MAX_ATTEMPTS ?? 5);
const DB_CONTAINER = process.env.DB_CONTAINER ?? "my-capstone-db-1";
const run = Date.now();
let failures = 0;

async function call(method, path, { token, body, rawBody, headers = {} } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: rawBody ?? (body ? JSON.stringify(body) : undefined),
  });
  const text = await res.text(); // 204 responses have no body
  return { status: res.status, headers: res.headers, data: text ? JSON.parse(text) : null };
}

// Runs SQL directly in the database container, bypassing the API. Returns the error text or "".
function sqlError(sql) {
  try {
    execFileSync("docker", ["exec", DB_CONTAINER, "psql", "-U", "capstone", "-d", "question_bank", "-v", "ON_ERROR_STOP=1", "-c", sql], { stdio: "pipe" });
    return "";
  } catch (e) {
    return String(e.stderr);
  }
}

function check(label, cond, extra) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${!cond && extra ? "  -> " + JSON.stringify(extra) : ""}`);
  if (!cond) failures++;
}

const reg = (name, extra = {}) =>
  call("POST", "/auth/register", {
    body: { email: `${name}-${run}@test.com`, password: "password123", name, inviteCode: INVITE, ...PROFILE, ...extra },
  });

// --- registration & login ---
const noCode = await reg("nocode", { inviteCode: undefined });
check("register without profile -> 400", (await reg("noprofile", { major: undefined, degree: undefined, university: undefined, courses: undefined })).status === 400);
check("register with a major not on the list -> 400", (await reg("badmajor", { major: "Underwater Basket Weaving" })).status === 400);
check("register with no courses -> 400", (await reg("nocourses", { courses: [] })).status === 400);
check("register with unknown degree -> 400", (await reg("baddegree", { degree: "WIZARD" })).status === 400);
check("register without invite code -> 400", noCode.status === 400, noCode);
const badCode = await reg("badcode", { inviteCode: "wrong" });
check("register with wrong invite code -> 403", badCode.status === 403, badCode);
const sneaky = await reg("sneaky", { role: "STUDENT" });
check("client-supplied role is ignored; account is INSTRUCTOR", sneaky.status === 201 && sneaky.data.user.role === "INSTRUCTOR", sneaky);

// Courses at sign-up: existing ones are matched (ignoring case); new ones are created right away.
const names = await call("GET", "/curricula/names");
check("course names are public for the sign-up form", names.status === 200 && Array.isArray(names.data.items));
const newCourse = `Quantum Computing ${run}`;
check("sign-up with a new course -> 201", (await reg("newcourse", { courses: [newCourse] })).status === 201);
check("…and the course now exists", (await call("GET", "/curricula/names")).data.items.includes(newCourse));
check("sign-up with the same course in other capitals -> 201", (await reg("samecourse", { courses: [newCourse.toUpperCase()] })).status === 201);
check("…links to it instead of making a duplicate", (await call("GET", "/curricula/names")).data.items.filter((n) => n.toLowerCase() === newCourse.toLowerCase()).length === 1);

const A = (await reg("alice")).data;
const B = (await reg("bob")).data;
check("register two instructors", A.token && B.token && A.user.role === "INSTRUCTOR");
check("duplicate email -> 409", (await reg("alice")).status === 409);

const login = await call("POST", "/auth/login", { body: { email: `alice-${run}@test.com`, password: "password123" } });
check("login returns token", login.status === 200 && login.data.token);
const wrongPw = await call("POST", "/auth/login", { body: { email: `alice-${run}@test.com`, password: "nope" } });
check("wrong password -> 401", wrongPw.status === 401);
check("/auth/me returns current user", (await call("GET", "/auth/me", { token: A.token })).data.user?.id === A.user.id);
check("garbage token -> 401", (await call("GET", "/auth/me", { token: "not.a.jwt" })).status === 401);

// --- anonymous access is blocked everywhere ---
for (const path of ["/auth/me", "/curricula", "/questions", "/questions/bank", "/exams"]) {
  check(`no token GET ${path} -> 401`, (await call("GET", path)).status === 401);
}

// --- curricula & chapters ---
const cur = await call("POST", "/curricula", { token: A.token, body: { name: `Math ${run}` } });
check("create curriculum", cur.status === 201, cur);
check("duplicate curriculum name -> 409", (await call("POST", "/curricula", { token: B.token, body: { name: `Math ${run}` } })).status === 409);
const ch = await call("POST", `/curricula/${cur.data.id}/chapters`, { token: A.token, body: { title: "Algebra", orderIndex: 1 } });
check("create chapter", ch.status === 201, ch);
const chapters = await call("GET", `/curricula/${cur.data.id}/chapters`, { token: B.token });
check("other instructor can list chapters", chapters.status === 200 && chapters.data.items.length === 1);
check("no token list chapters -> 401", (await call("GET", `/curricula/${cur.data.id}/chapters`)).status === 401);

// --- question creation & validation ---
const base = { curriculumId: cur.data.id, chapterId: ch.data.id, difficulty: 3, estimatedTimeMinutes: 5 };
const q1 = (await call("POST", "/questions", { token: A.token, body: { ...base, content: "Private Q", answer: "4" } })).data;
const q2 = (await call("POST", "/questions", {
  token: A.token,
  body: { ...base, content: "Shared MCQ", options: ["1", "2", "3"], answer: "2", visibility: "SHARED" },
})).data;
check("new question is PENDING and PRIVATE by default", q1.status === "PENDING" && q1.visibility === "PRIVATE", q1);
check("source is MANUAL", q2.source === "MANUAL");
const forced = await call("POST", "/questions", { token: A.token, body: { ...base, content: "x", answer: "y", status: "APPROVED", createdById: B.user.id } });
check("client cannot set status or owner on create", forced.data.status === "PENDING" && forced.data.createdBy.id === A.user.id, forced.data);
check("difficulty 7 -> 400", (await call("POST", "/questions", { token: A.token, body: { ...base, difficulty: 7, content: "x", answer: "y" } })).status === 400);
const other = await call("POST", "/curricula", { token: A.token, body: { name: `Other ${run}` } });
check("chapter from another curriculum -> 400", (await call("POST", "/questions", { token: A.token, body: { ...base, curriculumId: other.data.id, content: "x", answer: "y" } })).status === 400);
check("MCQ answer not in options -> 400", (await call("POST", "/questions", { token: A.token, body: { ...base, content: "x", options: ["a", "b"], answer: "c" } })).status === 400);

// --- privacy between instructors ---
const bIds = (await call("GET", `/questions?curriculumId=${cur.data.id}`, { token: B.token })).data.items.map((q) => q.id);
check("other instructor sees shared, not private", bIds.includes(q2.id) && !bIds.includes(q1.id), bIds);
check("visibility=PRIVATE filter cannot reveal others' questions", (await call("GET", `/questions?curriculumId=${cur.data.id}&visibility=PRIVATE`, { token: B.token })).data.items.length === 0);
check("other instructor GET private -> 404", (await call("GET", `/questions/${q1.id}`, { token: B.token })).status === 404);
check("other instructor approve private -> 404", (await call("POST", `/questions/${q1.id}/approve`, { token: B.token })).status === 404);
check("other instructor reject private -> 404", (await call("POST", `/questions/${q1.id}/reject`, { token: B.token, body: { reason: "x" } })).status === 404);

// --- approval workflow ---
const ap = await call("POST", `/questions/${q2.id}/approve`, { token: B.token });
check("approve records approver + time", ap.status === 200 && ap.data.status === "APPROVED" && ap.data.approvedBy?.id === B.user.id && ap.data.approvedAt, ap);
check("re-approve -> 409", (await call("POST", `/questions/${q2.id}/approve`, { token: A.token })).status === 409);
check("reject without reason -> 400", (await call("POST", `/questions/${q1.id}/reject`, { token: A.token })).status === 400);
check("reject with blank reason -> 400", (await call("POST", `/questions/${q1.id}/reject`, { token: A.token, body: { reason: "   " } })).status === 400);
const rj = await call("POST", `/questions/${q1.id}/reject`, { token: A.token, body: { reason: "Too easy" } });
check("owner rejects with reason", rj.status === 200 && rj.data.status === "REJECTED" && rj.data.rejectionReason === "Too easy" && !rj.data.approvedBy, rj);
check("reject records rejecter + time", rj.data.rejectedBy?.id === A.user.id && rj.data.rejectedAt, rj);
check("approve a rejected question -> 409", (await call("POST", `/questions/${q1.id}/approve`, { token: A.token })).status === 409);

// --- bank & filters ---
const bank = await call("GET", `/questions/bank?curriculumId=${cur.data.id}`, { token: A.token });
check("bank contains only approved", bank.data.items.length === 1 && bank.data.items[0].id === q2.id, bank.data);
const bankOverride = await call("GET", `/questions/bank?curriculumId=${cur.data.id}&status=PENDING`, { token: A.token });
check("bank ignores status override", bankOverride.data.items.every((q) => q.status === "APPROVED"));
const filt = await call("GET", `/questions?curriculumId=${cur.data.id}&status=REJECTED&difficulty=3`, { token: A.token });
check("filter by status + difficulty", filt.data.items.length === 1 && filt.data.items[0].id === q1.id);

// --- review rules, review queue, visibility ---
const mk = (token, extra) => call("POST", "/questions", { token, body: { ...base, content: `R ${Math.random()}`, answer: "a", ...extra } }).then((r) => r.data);
const aShared = await mk(A.token, { visibility: "SHARED" });
const aPrivate = await mk(A.token, { visibility: "PRIVATE" });
const bShared = await mk(B.token, { visibility: "SHARED" });
const bPriv = await mk(B.token, { visibility: "PRIVATE" });
// Same-major rule: a Chemistry instructor can't judge a Mathematics question.
const Chem = (await reg("chem", { major: "CHEMISTRY" })).data;
const chemTry = await call("POST", `/questions/${aShared.id}/approve`, { token: Chem.token });
check("different major can't approve a shared question -> 403", chemTry.status === 403 && /Mathematics/.test(chemTry.data.error), chemTry.data);
check("different major can't reject it either -> 403", (await call("POST", `/questions/${aShared.id}/reject`, { token: Chem.token, body: { reason: "x" } })).status === 403);
const chemQueue = (await call("GET", "/questions/review?pageSize=100", { token: Chem.token })).data;
check("review queue hides other majors' shared questions", chemQueue.major === "CHEMISTRY" && !chemQueue.items.some((q) => q.id === aShared.id || q.id === bShared.id), chemQueue.major);
check("author can't approve their own shared question -> 403", (await call("POST", `/questions/${aShared.id}/approve`, { token: A.token })).status === 403);
check("author can't reject their own shared question -> 403", (await call("POST", `/questions/${aShared.id}/reject`, { token: A.token, body: { reason: "x" } })).status === 403);
const queue = (await call("GET", "/questions/review?pageSize=100", { token: A.token })).data;
const qIds = queue.items.map((q) => q.id);
check("review queue: others' shared + own private pending", qIds.includes(bShared.id) && qIds.includes(aPrivate.id), qIds);
check("review queue: never own shared or others' private", !qIds.includes(aShared.id) && !qIds.includes(bPriv.id));
check("review queue holds only pending questions", queue.items.every((q) => q.status === "PENDING"));
check("no token review queue -> 401", (await call("GET", "/questions/review")).status === 401);

const selfOk = await call("POST", `/questions/${aPrivate.id}/approve`, { token: A.token });
check("author approves their own private question", selfOk.status === 200 && selfOk.data.approvedBy?.id === A.user.id, selfOk);
const shared = await call("PATCH", `/questions/${aPrivate.id}`, { token: A.token, body: { visibility: "SHARED" } });
check("sharing a self-approved question sends it back for review", shared.status === 200 && shared.data.visibility === "SHARED" && shared.data.status === "PENDING" && !shared.data.approvedBy, shared.data);
check("…and it then needs another instructor", (await call("POST", `/questions/${aPrivate.id}/approve`, { token: A.token })).status === 403 &&
  (await call("POST", `/questions/${aPrivate.id}/approve`, { token: B.token })).status === 200);
const priv = await call("PATCH", `/questions/${q2.id}`, { token: A.token, body: { visibility: "PRIVATE" } });
check("making a peer-approved question private keeps its approval", priv.status === 200 && priv.data.visibility === "PRIVATE" && priv.data.status === "APPROVED" && priv.data.approvedBy?.id === B.user.id, priv.data);
check("…and hides it from others -> 404", (await call("GET", `/questions/${q2.id}`, { token: B.token })).status === 404);
const reShare = await call("PATCH", `/questions/${q2.id}`, { token: A.token, body: { visibility: "SHARED" } });
check("re-sharing a peer-approved question keeps it approved", reShare.data.status === "APPROVED");
check("only the author can change visibility -> 403", (await call("PATCH", `/questions/${bShared.id}`, { token: A.token, body: { visibility: "PRIVATE" } })).status === 403);
check("invalid visibility -> 400", (await call("PATCH", `/questions/${q2.id}`, { token: A.token, body: { visibility: "PUBLIC" } })).status === 400);

// --- exam generation ---
// A small known bank: course E with two chapters. A owns everything except one private question of B's.
const E = (await call("POST", "/curricula", { token: A.token, body: { name: `Exams ${run}` } })).data;
const e1 = (await call("POST", `/curricula/${E.id}/chapters`, { token: A.token, body: { title: "One", orderIndex: 1 } })).data;
const e2 = (await call("POST", `/curricula/${E.id}/chapters`, { token: A.token, body: { title: "Two", orderIndex: 2 } })).data;
async function bankQ(token, chapterId, difficulty, minutes, { approve = true, visibility = "SHARED" } = {}) {
  const q = (await call("POST", "/questions", {
    token,
    body: { curriculumId: E.id, chapterId, difficulty, estimatedTimeMinutes: minutes, content: `E d${difficulty} ${minutes}m ${Math.random()}`, answer: "a", visibility },
  })).data;
  // Shared questions need a second instructor; private ones are approved by their author.
  const reviewer = visibility === "SHARED" ? (token === A.token ? B.token : A.token) : token;
  if (approve) await call("POST", `/questions/${q.id}/approve`, { token: reviewer });
  return q;
}
const eBank = [
  await bankQ(A.token, e1.id, 2, 10), await bankQ(A.token, e1.id, 3, 5), await bankQ(A.token, e1.id, 3, 15),
  await bankQ(A.token, e1.id, 5, 20), await bankQ(A.token, e2.id, 3, 10), await bankQ(A.token, e2.id, 4, 5),
];
const bPrivate = await bankQ(B.token, e1.id, 3, 5, { visibility: "PRIVATE" });
const aPending = await bankQ(A.token, e2.id, 3, 5, { approve: false });
const byId = new Map(eBank.map((q) => [q.id, q]));

const avail = await call("GET", `/exams/availability?curriculumId=${E.id}&difficulty=3`, { token: A.token });
const a1 = avail.data.chapters?.find((c) => c.id === e1.id);
check("availability counts only approved, visible, in-band questions", avail.status === 200 && a1?.approved === 4 && a1?.matching === 3 && a1?.matchingMinutes === 30, avail.data);

const gen = await call("POST", "/exams", { token: A.token, body: { curriculumId: E.id, chapterIds: [e1.id, e2.id], difficulty: 3, durationMinutes: 30 } });
const genIds = gen.data.questions?.map((q) => q.id) ?? [];
check("generate exam -> 201 DRAFT", gen.status === 201 && gen.data.status === "DRAFT", gen);
check("exam never exceeds the duration and fills at least 90%", gen.data.totalMinutes <= 30 && gen.data.totalMinutes >= 27, gen.data.totalMinutes);
check("exam uses only approved questions visible to the author", genIds.length > 0 && genIds.every((id) => byId.has(id)) && !genIds.includes(bPrivate.id) && !genIds.includes(aPending.id), genIds);
check("exam stays within one level of the target difficulty", gen.data.questions.every((q) => Math.abs(q.difficulty - 3) <= 1));
check("exam covers every chosen chapter", new Set(gen.data.questions.map((q) => q.chapter.id)).size === 2);
check("exam has a default title and no warnings", gen.data.title.includes(`Exams ${run}`) && gen.data.warnings.length === 0, gen.data);

const hard = await call("POST", "/exams", { token: A.token, body: { curriculumId: E.id, chapterIds: [e1.id, e2.id], difficulty: 5, durationMinutes: 60 } });
check("short bank -> exam is shorter, with an explanation", hard.status === 201 && hard.data.totalMinutes === 25 && hard.data.warnings[0]?.startsWith("Only 25 of 60 minutes"), hard.data);
const mixed = await call("POST", "/exams", { token: A.token, body: { curriculumId: E.id, chapterIds: [e1.id], difficulty: null, durationMinutes: 45 } });
check("mixed difficulty may use any level, one chapter only", mixed.status === 201 && mixed.data.questions.every((q) => q.chapter.id === e1.id) && mixed.data.totalMinutes <= 45, mixed.data);

check("chapter from another course -> 400", (await call("POST", "/exams", { token: A.token, body: { curriculumId: E.id, chapterIds: [ch.data.id], difficulty: 3, durationMinutes: 30 } })).status === 400);
check("duration under 5 minutes -> 400", (await call("POST", "/exams", { token: A.token, body: { curriculumId: E.id, chapterIds: [e1.id], difficulty: 3, durationMinutes: 3 } })).status === 400);
check("other instructor cannot see the exam -> 404", (await call("GET", `/exams/${gen.data.id}`, { token: B.token })).status === 404);
check("other instructor's exam list excludes it", !(await call("GET", "/exams", { token: B.token })).data.items.some((x) => x.id === gen.data.id));
check("exam list shows it with totals", (await call("GET", "/exams", { token: A.token })).data.items.some((x) => x.id === gen.data.id && x.questionCount === genIds.length));

const ex = `/exams/${gen.data.id}`;
check("cannot add another instructor's private question -> 400", (await call("PATCH", ex, { token: A.token, body: { questionIds: [...genIds, bPrivate.id] } })).status === 400);
check("cannot add a pending question -> 400", (await call("PATCH", ex, { token: A.token, body: { questionIds: [...genIds, aPending.id] } })).status === 400);
check("duplicate question -> 400", (await call("PATCH", ex, { token: A.token, body: { questionIds: [genIds[0], genIds[0]] } })).status === 400);
const reordered = await call("PATCH", ex, { token: A.token, body: { questionIds: [...genIds].reverse(), title: "Midterm" } });
check("reorder and rename", reordered.status === 200 && reordered.data.title === "Midterm" && reordered.data.questions[0].id === genIds.at(-1), reordered.data);
const alts = await call("GET", `${ex}/alternatives?replace=${genIds[0]}`, { token: A.token });
check("alternatives exclude questions already in the exam", alts.status === 200 && alts.data.items.every((q) => !genIds.includes(q.id) && q.id !== bPrivate.id), alts.data);
check("regenerate keeps the rules", (await call("POST", `${ex}/regenerate`, { token: A.token })).data.totalMinutes <= 30);

const fin = await call("POST", `${ex}/finalize`, { token: A.token });
const finIds = fin.data.questions?.map((q) => q.id) ?? [];
check("finalize -> FINAL with a timestamp", fin.status === 200 && fin.data.status === "FINAL" && fin.data.finalizedAt, fin);
const usedQ = (await call("GET", `/questions/${finIds[0]}`, { token: A.token })).data;
check("finalize counts questions as used", usedQ.timesUsed >= 1 && usedQ.lastUsedAt, usedQ);
check("final exam can't be edited -> 409", (await call("PATCH", ex, { token: A.token, body: { questionIds: [] } })).status === 409);
check("final exam can't be regenerated or finalized again -> 409",
  (await call("POST", `${ex}/regenerate`, { token: A.token })).status === 409 && (await call("POST", `${ex}/finalize`, { token: A.token })).status === 409);
check("empty draft can't be finalized -> 400", await (async () => {
  await call("PATCH", `/exams/${mixed.data.id}`, { token: A.token, body: { questionIds: [] } });
  return (await call("POST", `/exams/${mixed.data.id}/finalize`, { token: A.token })).status === 400;
})());
check("delete exam -> 204, then 404",
  (await call("DELETE", `/exams/${hard.data.id}`, { token: A.token })).status === 204 && (await call("GET", `/exams/${hard.data.id}`, { token: A.token })).status === 404);

// --- AI question generation (runs only in fake mode, so the test never spends money) ---
const aiState = await call("GET", "/questions/generate/status", { token: A.token });
check("AI status endpoint", aiState.status === 200 && ["fake", "live", "off"].includes(aiState.data.mode), aiState.data);
if (aiState.data.mode !== "fake") {
  console.log(`SKIP  AI generation checks (AI mode is "${aiState.data.mode}"; set AI_FAKE=true to run them)`);
} else {
  const genBody = { curriculumId: E.id, chapterId: e1.id, count: 3, difficulty: 3, kind: "mixed" };
  const mineBefore = (await call("GET", "/questions?mine=true&pageSize=1", { token: A.token })).data.total;
  const gen1 = await call("POST", "/questions/generate", { token: A.token, body: genBody });
  check("generate returns drafts", gen1.status === 200 && gen1.data.drafts.length === 3 && gen1.data.generationId, gen1.data);
  check("generating saves no questions", (await call("GET", "/questions?mine=true&pageSize=1", { token: A.token })).data.total === mineBefore);
  check("drafts follow the question rules", gen1.data.drafts.every((d) => d.difficulty >= 1 && d.difficulty <= 5 && (!d.options || d.options.includes(d.answer))));
  const bad = await call("POST", "/questions/generate", { token: A.token, body: { ...genBody, count: 1, focus: "__invalid__" } });
  check("invalid AI drafts are dropped with a note", bad.status === 200 && bad.data.drafts.length === 1 && bad.data.notes.some((n) => n.includes("dropped")), bad.data);
  check("count over 10 -> 400", (await call("POST", "/questions/generate", { token: A.token, body: { ...genBody, count: 11 } })).status === 400);
  check("chapter from another course -> 400", (await call("POST", "/questions/generate", { token: A.token, body: { ...genBody, chapterId: ch.data.id } })).status === 400);
  check("no token generate -> 401", (await call("POST", "/questions/generate", { body: genBody })).status === 401);

  const keep = gen1.data.drafts.slice(0, 2).map(({ explanation, ...d }) => d);
  keep[0].content = keep[0].content + " (edited)";
  check("another instructor can't submit my drafts -> 404",
    (await call("POST", "/questions/generate/submit", { token: B.token, body: { generationId: gen1.data.generationId, visibility: "SHARED", questions: keep } })).status === 404);
  const mcqBad = gen1.data.drafts.find((d) => d.options);
  if (mcqBad) {
    const { explanation, ...m } = mcqBad;
    check("submit MCQ whose answer isn't an option -> 400",
      (await call("POST", "/questions/generate/submit", { token: A.token, body: { generationId: gen1.data.generationId, visibility: "SHARED", questions: [{ ...m, answer: "nope" }] } })).status === 400);
  }
  const sub = await call("POST", "/questions/generate/submit", { token: A.token, body: { generationId: gen1.data.generationId, visibility: "SHARED", questions: keep } });
  check("submit kept drafts -> 201, PENDING and labelled AI", sub.status === 201 && sub.data.items.length === 2 && sub.data.items.every((q) => q.status === "PENDING" && q.source === "AI" && q.visibility === "SHARED"), sub.data);
  const saved = (await call("GET", `/questions/${sub.data.items[0].id}`, { token: A.token })).data;
  check("submitted draft keeps the instructor's edits", saved.content.endsWith("(edited)") && saved.chapter.id === e1.id);
  check("can't submit more drafts than were generated -> 409",
    (await call("POST", "/questions/generate/submit", { token: A.token, body: { generationId: gen1.data.generationId, visibility: "SHARED", questions: keep } })).status === 409);
  check("AI question goes to a colleague's review queue",
    (await call("GET", "/questions/review?pageSize=100", { token: B.token })).data.items.some((q) => q.id === saved.id));
  check("AI question is also in its generator's own review queue",
    (await call("GET", "/questions/review?pageSize=100", { token: A.token })).data.items.some((q) => q.id === saved.id));
  const selfAi = await call("POST", `/questions/${saved.id}/approve`, { token: A.token });
  check("generator approves their own shared AI question", selfAi.status === 200 && selfAi.data.approvedBy?.id === A.user.id, selfAi.data);
  check("…and it stays shared and approved", selfAi.data.visibility === "SHARED" && selfAi.data.status === "APPROVED");
  check("a same-major colleague can still approve the other AI question",
    (await call("POST", `/questions/${sub.data.items[1].id}/approve`, { token: B.token })).status === 200);
  check("DB rejects a generation link on a non-AI question",
    sqlError(`UPDATE questions SET source = 'MANUAL' WHERE id = '${saved.id}'`).includes("questions_ai_generation_is_ai"));
}

// --- step 3: malformed input ---
check("malformed JSON -> 400", (await call("POST", "/questions", { token: A.token, rawBody: "{not json" })).status === 400);
check("empty body on create -> 400", (await call("POST", "/curricula", { token: A.token, rawBody: "" })).status === 400);
check("malformed JSON on reject -> 400", (await call("POST", `/questions/${q2.id}/reject`, { token: A.token, rawBody: "{oops" })).status === 400);
check("password over 72 bytes -> 400", (await reg("longpw", { password: "x".repeat(73) })).status === 400);

// --- step 3: database-level rules (direct SQL, bypassing the API) ---
check("DB rejects difficulty 9", sqlError(`UPDATE questions SET difficulty = 9 WHERE id = '${q1.id}'`).includes("questions_difficulty_range"));
check("DB rejects estimatedTimeMinutes 0", sqlError(`UPDATE questions SET "estimatedTimeMinutes" = 0 WHERE id = '${q1.id}'`).includes("questions_estimated_time_range"));
check("DB rejects APPROVED without approvedAt", sqlError(`UPDATE questions SET status = 'APPROVED' WHERE id = '${q1.id}'`).includes("questions_approval_consistency"));
check("DB rejects approvedAt on a non-approved question", sqlError(`UPDATE questions SET "approvedAt" = now() WHERE id = '${q1.id}'`).includes("questions_approval_consistency"));
check("DB rejects chapter from another curriculum", sqlError(`UPDATE questions SET "curriculumId" = '${other.data.id}' WHERE id = '${q1.id}'`).includes("questions_chapterId_curriculumId_fkey"));
check("DB rejects exam duration 1 minute", sqlError(`UPDATE exams SET "durationMinutes" = 1 WHERE id = '${gen.data.id}'`).includes("exams_duration_range"));
check("DB rejects a FINAL exam without finalizedAt", sqlError(`UPDATE exams SET "finalizedAt" = NULL WHERE id = '${gen.data.id}'`).includes("exams_final_consistency"));
check("DB rejects chapter orderIndex 0", sqlError(`UPDATE chapters SET "orderIndex" = 0 WHERE id = '${ch.data.id}'`).includes("chapters_order_index_positive"));

// --- step 3: login rate limiting ---
const C = (await reg("carol")).data;
const loginAs = (email, password, headers) => call("POST", "/auth/login", { body: { email, password }, headers });
const carol = `carol-${run}@test.com`;
const wrong = [];
for (let i = 0; i < MAX_ATTEMPTS; i++) wrong.push((await loginAs(carol, "wrong-password")).status);
check(`${MAX_ATTEMPTS} wrong passwords -> 401 each`, wrong.every((s) => s === 401), wrong);
const locked = await loginAs(carol, "wrong-password");
check(`attempt ${MAX_ATTEMPTS + 1} -> 429 with Retry-After`, locked.status === 429 && Number(locked.headers.get("retry-after")) > 0, locked.status);
check("while locked, even the correct password -> 429", (await loginAs(carol, "password123")).status === 429);
check("other accounts are not affected by the lock", (await loginAs(`alice-${run}@test.com`, "password123")).status === 200);

await reg("dave");
const dave = `dave-${run}@test.com`;
for (let i = 0; i < MAX_ATTEMPTS; i++) await loginAs(dave, "wrong-password", { "x-forwarded-for": `10.0.0.${i + 1}` });
check("spoofed X-Forwarded-For does not bypass the limit", (await loginAs(dave, "wrong-password", { "x-forwarded-for": "10.9.9.9" })).status === 429);

await reg("erin");
const erin = `erin-${run}@test.com`;
for (let i = 0; i < MAX_ATTEMPTS - 1; i++) await loginAs(erin, "wrong-password");
await loginAs(erin, "password123");
const afterReset = [];
for (let i = 0; i < MAX_ATTEMPTS - 1; i++) afterReset.push((await loginAs(erin, "wrong-password")).status);
check("successful login resets the failure counter", afterReset.every((s) => s === 401), afterReset);
check("C registered for rate-limit tests", Boolean(C.token));

// --- step 3: invite-code brute force (runs last: it locks registration from this IP) ---
// One wrong code was already sent by the "wrong invite code -> 403" check at the top.
const codeStatuses = [];
for (let i = 1; i <= MAX_ATTEMPTS; i++) {
  const res = await call("POST", "/auth/register", {
    body: { email: `guess${i}-${run}@test.com`, password: "password123", name: "guess", inviteCode: `guess-${i}`, ...PROFILE },
    headers: { "x-forwarded-for": `10.1.0.${i}` }, // a fresh fake IP each time must not help
  });
  codeStatuses.push(res.status);
}
check(`wrong invite codes (spoofed IPs): ${MAX_ATTEMPTS} x 403 in total, then 429`, codeStatuses.slice(0, -1).every((s) => s === 403) && codeStatuses.at(-1) === 429, codeStatuses);
check("while locked, even the correct invite code -> 429", (await reg("late")).status === 429);

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
