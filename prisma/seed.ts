// Demo data for local development. Run with `npm run db:seed`.
// Idempotent: creates only what is missing and never deletes existing rows.
import { PrismaClient, type QuestionSource, type QuestionStatus, type Visibility } from "@prisma/client";
import bcrypt from "bcryptjs";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed demo data in production.");
  process.exit(1);
}

const password = process.env.SEED_PASSWORD ?? "";
if (password.length < 8) {
  console.error("Set SEED_PASSWORD (at least 8 characters) in .env before seeding.");
  process.exit(1);
}

const prisma = new PrismaClient();

const instructors = {
  lina: { email: "lina.nasser@example.com", name: "Dr. Lina Nasser" },
  omar: { email: "omar.khalil@example.com", name: "Dr. Omar Khalil" },
  sara: { email: "sara.haddad@example.com", name: "Dr. Sara Haddad" },
} as const;
type Who = keyof typeof instructors;

const curricula = [
  {
    name: "Mathematics 101",
    description: "Foundations of algebra and introductory calculus.",
    owner: "lina" as Who,
    chapters: ["Algebra", "Functions", "Limits", "Derivatives"],
  },
  {
    name: "Introduction to Programming",
    description: "Programming fundamentals using Python.",
    owner: "omar" as Who,
    chapters: ["Variables and Types", "Control Flow", "Functions"],
  },
];

type SeedQuestion = {
  owner: Who;
  curriculum: string;
  chapter: string;
  content: string;
  options?: string[];
  answer: string;
  difficulty: number;
  minutes: number;
  visibility: Visibility;
  status: QuestionStatus;
  approvedBy?: Who;
  rejectionReason?: string;
  source?: QuestionSource;
  timesUsed?: number;
  lastUsedDaysAgo?: number;
};

const M = "Mathematics 101";
const P = "Introduction to Programming";

const questions: SeedQuestion[] = [
  // ---- Mathematics 101 / Algebra ----
  { owner: "lina", curriculum: M, chapter: "Algebra", content: "Solve for x: 2x + 6 = 14.",
    options: ["x = 2", "x = 4", "x = 6", "x = 10"], answer: "x = 4", difficulty: 1, minutes: 2,
    visibility: "SHARED", status: "APPROVED", approvedBy: "omar", timesUsed: 3, lastUsedDaysAgo: 20 },
  { owner: "lina", curriculum: M, chapter: "Algebra", content: "Factor x^2 - 5x + 6.",
    answer: "(x - 2)(x - 3)", difficulty: 2, minutes: 4,
    visibility: "SHARED", status: "APPROVED", approvedBy: "sara", timesUsed: 1, lastUsedDaysAgo: 45 },
  { owner: "sara", curriculum: M, chapter: "Algebra", content: "Solve the system: x + y = 10 and x - y = 2.",
    answer: "x = 6, y = 4", difficulty: 2, minutes: 5,
    visibility: "SHARED", status: "APPROVED", approvedBy: "lina" },
  { owner: "lina", curriculum: M, chapter: "Algebra", content: "Find all real solutions of x^4 - 5x^2 + 4 = 0.",
    answer: "x = -2, -1, 1, 2", difficulty: 4, minutes: 10,
    visibility: "PRIVATE", status: "APPROVED", approvedBy: "lina" },
  // ---- Mathematics 101 / Functions ----
  { owner: "omar", curriculum: M, chapter: "Functions", content: "If f(x) = 3x - 2, what is f(4)?",
    options: ["8", "10", "12", "14"], answer: "10", difficulty: 1, minutes: 2,
    visibility: "SHARED", status: "APPROVED", approvedBy: "lina", timesUsed: 5, lastUsedDaysAgo: 7 },
  { owner: "lina", curriculum: M, chapter: "Functions", content: "What is the domain of f(x) = 1 / (x - 3)?",
    answer: "All real numbers except x = 3", difficulty: 2, minutes: 3,
    visibility: "SHARED", status: "PENDING" },
  { owner: "sara", curriculum: M, chapter: "Functions", content: "Find the inverse of f(x) = (2x + 1) / 3.",
    answer: "f^-1(x) = (3x - 1) / 2", difficulty: 3, minutes: 6,
    visibility: "PRIVATE", status: "PENDING" },
  { owner: "lina", curriculum: M, chapter: "Functions", content: "Is f(x) = x^3 an even function?",
    options: ["Yes", "No"], answer: "No", difficulty: 1, minutes: 1,
    visibility: "SHARED", status: "REJECTED",
    rejectionReason: "Too simple for this course; ask students to classify several functions as even, odd or neither." },
  // ---- Mathematics 101 / Limits ----
  { owner: "sara", curriculum: M, chapter: "Limits", content: "Evaluate the limit of (x^2 - 9) / (x - 3) as x approaches 3.",
    answer: "6", difficulty: 3, minutes: 6,
    visibility: "SHARED", status: "APPROVED", approvedBy: "omar", timesUsed: 2, lastUsedDaysAgo: 30 },
  { owner: "lina", curriculum: M, chapter: "Limits", content: "Evaluate the limit of sin(x) / x as x approaches 0.",
    options: ["0", "1", "Does not exist", "Infinity"], answer: "1", difficulty: 2, minutes: 3,
    visibility: "SHARED", status: "APPROVED", approvedBy: "sara" },
  { owner: "omar", curriculum: M, chapter: "Limits", content: "Evaluate the limit of (1 + 1/n)^n as n approaches infinity.",
    answer: "e", difficulty: 4, minutes: 8,
    visibility: "PRIVATE", status: "REJECTED",
    rejectionReason: "The model answer needs the expected reasoning steps, not only the final value." },
  // ---- Mathematics 101 / Derivatives ----
  { owner: "lina", curriculum: M, chapter: "Derivatives", content: "Differentiate f(x) = 5x^3 - 2x + 7.",
    answer: "f'(x) = 15x^2 - 2", difficulty: 2, minutes: 4,
    visibility: "SHARED", status: "APPROVED", approvedBy: "omar", timesUsed: 4, lastUsedDaysAgo: 14 },
  { owner: "sara", curriculum: M, chapter: "Derivatives", content: "Find the derivative of f(x) = x^2 * e^x.",
    answer: "f'(x) = e^x (x^2 + 2x)", difficulty: 3, minutes: 7,
    visibility: "SHARED", status: "PENDING" },
  { owner: "lina", curriculum: M, chapter: "Derivatives",
    content: "A 10 m ladder leans against a wall. Its base slides away from the wall at 1 m/s. How fast is the top sliding down when the base is 6 m from the wall?",
    answer: "0.75 m/s", difficulty: 5, minutes: 15,
    visibility: "SHARED", status: "APPROVED", approvedBy: "sara" },
  { owner: "lina", curriculum: M, chapter: "Derivatives", content: "Find the slope of the tangent line to y = ln(x) at x = 2.",
    answer: "1/2", difficulty: 2, minutes: 4,
    visibility: "PRIVATE", status: "PENDING", source: "AI" },

  // ---- Introduction to Programming / Variables and Types ----
  { owner: "omar", curriculum: P, chapter: "Variables and Types", content: "Which of these is a valid Python variable name?",
    options: ["2total", "total_2", "total-2", "class"], answer: "total_2", difficulty: 1, minutes: 2,
    visibility: "SHARED", status: "APPROVED", approvedBy: "sara", timesUsed: 6, lastUsedDaysAgo: 3 },
  { owner: "sara", curriculum: P, chapter: "Variables and Types", content: "What is the type of the value 3 / 2 in Python 3?",
    options: ["int", "float", "str", "bool"], answer: "float", difficulty: 1, minutes: 2,
    visibility: "SHARED", status: "APPROVED", approvedBy: "omar" },
  { owner: "omar", curriculum: P, chapter: "Variables and Types",
    content: "Explain the difference between a mutable and an immutable type, with one Python example of each.",
    answer: "A mutable object can be changed in place (e.g. list); an immutable one cannot (e.g. tuple or str).",
    difficulty: 3, minutes: 8, visibility: "PRIVATE", status: "APPROVED", approvedBy: "omar" },
  // ---- Introduction to Programming / Control Flow ----
  { owner: "omar", curriculum: P, chapter: "Control Flow", content: "How many lines does `for i in range(2, 10, 3): print(i)` print?",
    options: ["2", "3", "4", "8"], answer: "3", difficulty: 2, minutes: 3,
    visibility: "SHARED", status: "APPROVED", approvedBy: "lina", timesUsed: 2, lastUsedDaysAgo: 21 },
  { owner: "sara", curriculum: P, chapter: "Control Flow", content: "Write a loop that prints the even numbers from 0 to 20 inclusive.",
    answer: "for i in range(0, 21, 2): print(i)", difficulty: 2, minutes: 5,
    visibility: "SHARED", status: "PENDING" },
  { owner: "omar", curriculum: P, chapter: "Control Flow", content: "What does `break` do inside a nested loop?",
    answer: "It exits only the innermost loop that contains it.", difficulty: 2, minutes: 3,
    visibility: "SHARED", status: "REJECTED",
    rejectionReason: "Ambiguous: state the programming language and include a short code example." },
  // ---- Introduction to Programming / Functions ----
  { owner: "omar", curriculum: P, chapter: "Functions", content: "Write a recursive function that returns the n-th Fibonacci number.",
    answer: "def fib(n): return n if n < 2 else fib(n - 1) + fib(n - 2)", difficulty: 3, minutes: 10,
    visibility: "SHARED", status: "APPROVED", approvedBy: "sara", timesUsed: 1, lastUsedDaysAgo: 60 },
  { owner: "sara", curriculum: P, chapter: "Functions",
    content: "Given `def f(x=[]): x.append(1); return len(x)`, what does the second call to f() return?",
    answer: "2, because the default list is created once and shared between calls.", difficulty: 4, minutes: 8,
    visibility: "SHARED", status: "APPROVED", approvedBy: "omar" },
  { owner: "omar", curriculum: P, chapter: "Functions",
    content: "Analyse the time complexity of the naive recursive Fibonacci function and propose an O(n) alternative.",
    answer: "O(2^n); memoisation or an iterative loop gives O(n).", difficulty: 5, minutes: 20,
    visibility: "PRIVATE", status: "PENDING" },
  { owner: "sara", curriculum: P, chapter: "Functions", content: "What does a Python function return if it has no return statement?",
    options: ["0", "None", "False", "It raises an error"], answer: "None", difficulty: 1, minutes: 2,
    visibility: "SHARED", status: "PENDING", source: "AI" },
];

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

async function main() {
  const passwordHash = await bcrypt.hash(password, 10);

  const userIds = {} as Record<Who, string>;
  for (const [key, info] of Object.entries(instructors) as [Who, (typeof instructors)[Who]][]) {
    const user = await prisma.user.upsert({
      where: { email: info.email },
      update: { name: info.name, passwordHash },
      create: { email: info.email, name: info.name, passwordHash, role: "INSTRUCTOR" },
    });
    userIds[key] = user.id;
  }

  const chapterIds = new Map<string, { curriculumId: string; chapterId: string }>();
  for (const c of curricula) {
    const curriculum = await prisma.curriculum.upsert({
      where: { name: c.name },
      update: {},
      create: { name: c.name, description: c.description, createdById: userIds[c.owner] },
    });
    for (const [i, title] of c.chapters.entries()) {
      const chapter = await prisma.chapter.upsert({
        where: { curriculumId_title: { curriculumId: curriculum.id, title } },
        update: {},
        create: { curriculumId: curriculum.id, title, orderIndex: i + 1 },
      });
      chapterIds.set(`${c.name}/${title}`, { curriculumId: curriculum.id, chapterId: chapter.id });
    }
  }

  let created = 0;
  for (const q of questions) {
    const location = chapterIds.get(`${q.curriculum}/${q.chapter}`);
    if (!location) throw new Error(`Unknown chapter ${q.curriculum}/${q.chapter}`);
    if (q.options && !q.options.includes(q.answer)) throw new Error(`Answer not in options: ${q.content}`);
    if ((q.status === "APPROVED") !== Boolean(q.approvedBy)) throw new Error(`approvedBy must be set exactly for approved questions: ${q.content}`);

    const exists = await prisma.question.findFirst({ where: { createdById: userIds[q.owner], content: q.content } });
    if (exists) continue;

    await prisma.question.create({
      data: {
        ...location,
        content: q.content,
        options: q.options,
        answer: q.answer,
        difficulty: q.difficulty,
        estimatedTimeMinutes: q.minutes,
        source: q.source ?? "MANUAL",
        createdById: userIds[q.owner],
        visibility: q.visibility,
        status: q.status,
        approvedById: q.approvedBy ? userIds[q.approvedBy] : null,
        approvedAt: q.approvedBy ? daysAgo((q.lastUsedDaysAgo ?? 0) + 10) : null,
        rejectionReason: q.rejectionReason ?? null,
        timesUsed: q.timesUsed ?? 0,
        lastUsedAt: q.lastUsedDaysAgo !== undefined ? daysAgo(q.lastUsedDaysAgo) : null,
      },
    });
    created++;
  }

  console.log(`Seed complete: ${created} new question(s) created (${questions.length} in the seed set).`);
  console.log("Demo instructor logins (password = SEED_PASSWORD from .env):");
  for (const info of Object.values(instructors)) console.log(`  ${info.email}  (${info.name})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
