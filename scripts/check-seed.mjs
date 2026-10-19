// Logs in as each seeded instructor and checks, through the API, that they see exactly
// their own questions plus shared ones, and that the bank holds only approved questions.
// Usage: npm run db:seed, npm run dev, then `npm run check:seed`.
const BASE = process.env.API_URL ?? "http://localhost:3100/api";
const PASSWORD = process.env.SEED_PASSWORD;
const EMAILS = ["lina.nasser@example.com", "omar.khalil@example.com", "sara.haddad@example.com"];
const SEEDED = ["Mathematics 101", "Introduction to Programming"];
let failures = 0;

if (!PASSWORD) {
  console.error("Set SEED_PASSWORD (e.g. `node --env-file=.env scripts/check-seed.mjs`).");
  process.exit(1);
}

const get = (path, token) =>
  fetch(BASE + path, { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json());

function check(label, cond, extra) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${!cond && extra !== undefined ? "  -> " + JSON.stringify(extra) : ""}`);
  if (!cond) failures++;
}

const sessions = [];
for (const email of EMAILS) {
  const res = await fetch(BASE + "/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const data = await res.json();
  check(`login ${email}`, res.status === 200, data);
  sessions.push({ email, ...data });
}

const curricula = (await get("/curricula", sessions[0].token)).items.filter((c) => SEEDED.includes(c.name));
check("both seeded curricula exist with chapters", curricula.length === 2 && curricula.every((c) => c.chapters.length >= 3));

// Build the full picture from the owners' own views (each owner sees all of their own questions).
const all = new Map();
for (const s of sessions) {
  for (const c of curricula) {
    for (const q of (await get(`/questions?curriculumId=${c.id}&mine=true&pageSize=100`, s.token)).items) all.set(q.id, q);
  }
}
check("25 seeded questions found", all.size === 25, all.size);

for (const s of sessions) {
  const visible = new Set();
  const bank = new Set();
  for (const c of curricula) {
    for (const q of (await get(`/questions?curriculumId=${c.id}&pageSize=100`, s.token)).items) visible.add(q.id);
    for (const q of (await get(`/questions/bank?curriculumId=${c.id}&pageSize=100`, s.token)).items) bank.add(q.id);
  }
  const expected = [...all.values()].filter((q) => q.createdBy.id === s.user.id || q.visibility === "SHARED");
  const expectedBank = expected.filter((q) => q.status === "APPROVED");
  const name = s.user.name;
  check(`${name}: sees ${expected.length} questions (own + shared)`,
    visible.size === expected.length && expected.every((q) => visible.has(q.id)), visible.size);
  check(`${name}: never sees another instructor's private question`,
    [...visible].every((id) => all.get(id).visibility === "SHARED" || all.get(id).createdBy.id === s.user.id));
  check(`${name}: bank has ${expectedBank.length} approved questions`,
    bank.size === expectedBank.length && [...bank].every((id) => all.get(id).status === "APPROVED"), bank.size);
}

const ai = [...all.values()].filter((q) => q.source === "AI");
check("AI-generated questions exist and are all still PENDING", ai.length === 2 && ai.every((q) => q.status === "PENDING"));
check("every approved question records approver and date",
  [...all.values()].filter((q) => q.status === "APPROVED").every((q) => q.approvedBy && q.approvedAt));
check("every rejected question has a reason",
  [...all.values()].filter((q) => q.status === "REJECTED").every((q) => q.rejectionReason));

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
