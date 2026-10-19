// End-to-end check of the running API. Usage: npm run dev, then `npm run smoke`.
// Creates fresh users on every run, so it is safe to repeat.
const BASE = process.env.API_URL ?? "http://localhost:3100/api";
const INVITE = process.env.INSTRUCTOR_INVITE_CODE ?? "capstone-instructor";
const run = Date.now();
let failures = 0;

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
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

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
