// End-to-end check of the running API. Usage: npm run dev, then `npm run smoke`.
// Creates fresh users on every run. Note: the final section deliberately trips the
// per-IP invite-code rate limit, so registration from this machine stays blocked for
// RATE_LIMIT_WINDOW_MINUTES — restart the dev server before running the script again.
import { execFileSync } from "node:child_process";

const BASE = process.env.API_URL ?? "http://localhost:3100/api";
const INVITE = process.env.INSTRUCTOR_INVITE_CODE ?? "capstone-instructor";
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
  return { status: res.status, headers: res.headers, data: await res.json() };
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
    body: { email: `${name}-${run}@test.com`, password: "password123", name, inviteCode: INVITE, ...extra },
  });

// --- registration & login ---
const noCode = await reg("nocode", { inviteCode: undefined });
check("register without invite code -> 400", noCode.status === 400, noCode);
const badCode = await reg("badcode", { inviteCode: "wrong" });
check("register with wrong invite code -> 403", badCode.status === 403, badCode);
const sneaky = await reg("sneaky", { role: "STUDENT" });
check("client-supplied role is ignored; account is INSTRUCTOR", sneaky.status === 201 && sneaky.data.user.role === "INSTRUCTOR", sneaky);

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
for (const path of ["/auth/me", "/curricula", "/questions", "/questions/bank"]) {
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
check("other instructor reject private -> 404", (await call("POST", `/questions/${q1.id}/reject`, { token: B.token })).status === 404);

// --- approval workflow ---
const ap = await call("POST", `/questions/${q2.id}/approve`, { token: B.token });
check("approve records approver + time", ap.status === 200 && ap.data.status === "APPROVED" && ap.data.approvedBy?.id === B.user.id && ap.data.approvedAt, ap);
check("re-approve -> 409", (await call("POST", `/questions/${q2.id}/approve`, { token: A.token })).status === 409);
const rj = await call("POST", `/questions/${q1.id}/reject`, { token: A.token, body: { reason: "Too easy" } });
check("owner rejects with reason", rj.status === 200 && rj.data.status === "REJECTED" && rj.data.rejectionReason === "Too easy" && !rj.data.approvedBy, rj);
check("approve a rejected question -> 409", (await call("POST", `/questions/${q1.id}/approve`, { token: A.token })).status === 409);

// --- bank & filters ---
const bank = await call("GET", `/questions/bank?curriculumId=${cur.data.id}`, { token: A.token });
check("bank contains only approved", bank.data.items.length === 1 && bank.data.items[0].id === q2.id, bank.data);
const bankOverride = await call("GET", `/questions/bank?curriculumId=${cur.data.id}&status=PENDING`, { token: A.token });
check("bank ignores status override", bankOverride.data.items.every((q) => q.status === "APPROVED"));
const filt = await call("GET", `/questions?curriculumId=${cur.data.id}&status=REJECTED&difficulty=3`, { token: A.token });
check("filter by status + difficulty", filt.data.items.length === 1 && filt.data.items[0].id === q1.id);

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
    body: { email: `guess${i}-${run}@test.com`, password: "password123", name: "guess", inviteCode: `guess-${i}` },
    headers: { "x-forwarded-for": `10.1.0.${i}` }, // a fresh fake IP each time must not help
  });
  codeStatuses.push(res.status);
}
check(`wrong invite codes (spoofed IPs): ${MAX_ATTEMPTS} x 403 in total, then 429`, codeStatuses.slice(0, -1).every((s) => s === 403) && codeStatuses.at(-1) === 429, codeStatuses);
check("while locked, even the correct invite code -> 429", (await reg("late")).status === 429);

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
