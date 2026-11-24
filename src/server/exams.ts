import type { Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";
import { badRequest, conflict, notFound } from "@/lib/errors";
import type { availabilityQuery, createExamSchema, updateExamSchema } from "@/lib/validation";
import { visibleToInstructor } from "./questions";
import { DIFFICULTY_LABELS, generateExam, inBand, type Candidate, type ChapterRef } from "./exam-generator";

const examQuestionSelect = {
  id: true,
  content: true,
  options: true,
  answer: true,
  difficulty: true,
  estimatedTimeMinutes: true,
  source: true,
  visibility: true,
  timesUsed: true,
  chapter: { select: { id: true, title: true, orderIndex: true } },
  createdBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
} satisfies Prisma.QuestionSelect;

// The bank questions an exam may draw from: approved, visible to this instructor,
// in the course and (optionally) the given chapters.
function poolWhere(user: SessionUser, curriculumId: string, chapterIds?: string[]): Prisma.QuestionWhereInput {
  return {
    AND: [
      visibleToInstructor(user.id),
      { status: "APPROVED", curriculumId, ...(chapterIds ? { chapterId: { in: chapterIds } } : {}) },
    ],
  };
}

async function loadPool(user: SessionUser, curriculumId: string, chapterIds: string[]): Promise<Candidate[]> {
  const rows = await prisma.question.findMany({
    where: poolWhere(user, curriculumId, chapterIds),
    select: { id: true, chapterId: true, difficulty: true, estimatedTimeMinutes: true, timesUsed: true, lastUsedAt: true },
  });
  return rows.map((r) => ({ ...r, minutes: r.estimatedTimeMinutes }));
}

// Checks the course exists and every chapter belongs to it; returns chapters in course order.
async function resolveChapters(curriculumId: string, chapterIds: string[]): Promise<ChapterRef[]> {
  const curriculum = await prisma.curriculum.findUnique({
    where: { id: curriculumId },
    include: { chapters: { orderBy: { orderIndex: "asc" }, select: { id: true, title: true, orderIndex: true } } },
  });
  if (!curriculum) throw badRequest("Course not found");
  const wanted = new Set(chapterIds);
  const chapters = curriculum.chapters.filter((c) => wanted.has(c.id));
  if (chapters.length !== wanted.size) throw badRequest("Every chapter must belong to the chosen course");
  return chapters;
}

/** Live "can the bank support this exam?" numbers for the generate form. */
export async function examAvailability(user: SessionUser, query: z.infer<typeof availabilityQuery>) {
  const curriculum = await prisma.curriculum.findUnique({
    where: { id: query.curriculumId },
    include: { chapters: { orderBy: { orderIndex: "asc" }, select: { id: true, title: true, orderIndex: true } } },
  });
  if (!curriculum) throw notFound("Course not found");
  const pool = await loadPool(
    user,
    curriculum.id,
    curriculum.chapters.map((c) => c.id),
  );
  const target = query.difficulty ?? null;
  const chapters = curriculum.chapters.map((c) => {
    const all = pool.filter((q) => q.chapterId === c.id);
    const matching = all.filter((q) => inBand(q.difficulty, target));
    return {
      ...c,
      approved: all.length,
      matching: matching.length,
      matchingMinutes: matching.reduce((s, q) => s + q.minutes, 0),
    };
  });
  return { curriculumId: curriculum.id, targetDifficulty: target, chapters };
}

function defaultTitle(courseName: string, target: number | null) {
  const level = target === null ? "" : ` · ${DIFFICULTY_LABELS[target - 1]}`;
  return `${courseName} exam${level}`;
}

async function writeQuestions(tx: Prisma.TransactionClient, examId: string, questionIds: string[]) {
  await tx.examQuestion.deleteMany({ where: { examId } });
  if (questionIds.length) {
    await tx.examQuestion.createMany({ data: questionIds.map((questionId, i) => ({ examId, questionId, position: i + 1 })) });
  }
}

export async function createExam(user: SessionUser, input: z.infer<typeof createExamSchema>) {
  const chapters = await resolveChapters(input.curriculumId, input.chapterIds);
  const course = await prisma.curriculum.findUniqueOrThrow({ where: { id: input.curriculumId }, select: { name: true } });
  const pool = await loadPool(user, input.curriculumId, input.chapterIds);
  const result = generateExam({
    pool,
    chapters,
    targetDifficulty: input.difficulty,
    durationMinutes: input.durationMinutes,
  });

  const exam = await prisma.$transaction(async (tx) => {
    const created = await tx.exam.create({
      data: {
        title: input.title?.trim() || defaultTitle(course.name, input.difficulty),
        curriculumId: input.curriculumId,
        chapterIds: chapters.map((c) => c.id),
        targetDifficulty: input.difficulty,
        durationMinutes: input.durationMinutes,
        warnings: result.warnings,
        createdById: user.id,
      },
    });
    await writeQuestions(tx, created.id, result.questionIds);
    return created;
  });
  return getExam(user, exam.id);
}

async function ownedExam(user: SessionUser, id: string) {
  // 404 (not 403) for someone else's exam, so exam ids don't leak.
  const exam = await prisma.exam.findFirst({ where: { id, createdById: user.id } });
  if (!exam) throw notFound("Exam not found");
  return exam;
}

function requireDraft(exam: { status: string }) {
  if (exam.status !== "DRAFT") throw conflict("This exam is final and can no longer be changed");
}

export async function getExam(user: SessionUser, id: string) {
  await ownedExam(user, id);
  const exam = await prisma.exam.findUniqueOrThrow({
    where: { id },
    include: {
      curriculum: { select: { id: true, name: true } },
      questions: { orderBy: { position: "asc" }, include: { question: { select: examQuestionSelect } } },
    },
  });
  const chapters = await prisma.chapter.findMany({
    where: { id: { in: exam.chapterIds } },
    orderBy: { orderIndex: "asc" },
    select: { id: true, title: true, orderIndex: true },
  });
  const questions = exam.questions.map((eq) => ({ position: eq.position, ...eq.question }));
  return {
    id: exam.id,
    title: exam.title,
    status: exam.status,
    curriculum: exam.curriculum,
    chapters,
    targetDifficulty: exam.targetDifficulty,
    durationMinutes: exam.durationMinutes,
    totalMinutes: questions.reduce((s, q) => s + q.estimatedTimeMinutes, 0),
    warnings: exam.warnings,
    finalizedAt: exam.finalizedAt,
    createdAt: exam.createdAt,
    updatedAt: exam.updatedAt,
    questions,
  };
}

export async function listExams(user: SessionUser) {
  const exams = await prisma.exam.findMany({
    where: { createdById: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      curriculum: { select: { id: true, name: true } },
      questions: { select: { question: { select: { estimatedTimeMinutes: true } } } },
    },
  });
  return {
    items: exams.map(({ questions, ...e }) => ({
      id: e.id,
      title: e.title,
      status: e.status,
      curriculum: e.curriculum,
      chapterCount: e.chapterIds.length,
      targetDifficulty: e.targetDifficulty,
      durationMinutes: e.durationMinutes,
      questionCount: questions.length,
      totalMinutes: questions.reduce((s, q) => s + q.question.estimatedTimeMinutes, 0),
      finalizedAt: e.finalizedAt,
      createdAt: e.createdAt,
    })),
  };
}

/** Rename, and/or set the full ordered question list (covers remove, reorder, swap and add). */
export async function updateExam(user: SessionUser, id: string, input: z.infer<typeof updateExamSchema>) {
  const exam = await ownedExam(user, id);
  if (input.questionIds) {
    requireDraft(exam);
    const ids = input.questionIds;
    if (new Set(ids).size !== ids.length) throw badRequest("A question can appear only once in an exam");
    const current = new Set((await prisma.examQuestion.findMany({ where: { examId: id } })).map((r) => r.questionId));
    const added = ids.filter((q) => !current.has(q));
    if (added.length) {
      const allowed = await prisma.question.count({ where: { AND: [poolWhere(user, exam.curriculumId, exam.chapterIds), { id: { in: added } }] } });
      if (allowed !== added.length) {
        throw badRequest("Questions must be approved, visible to you, and from this exam's course and chapters");
      }
    }
  }
  await prisma.$transaction(async (tx) => {
    if (input.title !== undefined) await tx.exam.update({ where: { id }, data: { title: input.title } });
    if (input.questionIds) await writeQuestions(tx, id, input.questionIds);
  });
  return getExam(user, id);
}

/** Bank questions that could replace `replaceId` (or be added), best match first. */
export async function examAlternatives(user: SessionUser, id: string, replaceId?: string) {
  const exam = await ownedExam(user, id);
  const rows = await prisma.examQuestion.findMany({ where: { examId: id }, include: { question: { select: { estimatedTimeMinutes: true, difficulty: true, chapterId: true } } } });
  const replaced = replaceId ? rows.find((r) => r.questionId === replaceId) : undefined;
  if (replaceId && !replaced) throw badRequest("That question is not in this exam");

  const used = rows.reduce((s, r) => s + r.question.estimatedTimeMinutes, 0) - (replaced?.question.estimatedTimeMinutes ?? 0);
  const room = exam.durationMinutes - used;
  const candidates = await prisma.question.findMany({
    where: { AND: [poolWhere(user, exam.curriculumId, exam.chapterIds), { id: { notIn: rows.map((r) => r.questionId) } }] },
    select: examQuestionSelect,
  });

  const ref = replaced?.question;
  const items = candidates
    .filter((q) => inBand(q.difficulty, exam.targetDifficulty))
    .map((q) => ({ ...q, fitsTime: q.estimatedTimeMinutes <= room }))
    .sort((a, b) => {
      const rank = (q: (typeof candidates)[number] & { fitsTime: boolean }) =>
        (q.fitsTime ? 0 : 100) +
        (ref ? (q.chapter.id === ref.chapterId ? 0 : 3) + Math.abs(q.estimatedTimeMinutes - ref.estimatedTimeMinutes) / 5 + Math.abs(q.difficulty - ref.difficulty) : 0) +
        q.timesUsed * 0.2;
      return rank(a) - rank(b);
    })
    .slice(0, 12);
  return { roomMinutes: room, items };
}

export async function regenerateExam(user: SessionUser, id: string) {
  const exam = await ownedExam(user, id);
  requireDraft(exam);
  const chapters = await resolveChapters(exam.curriculumId, exam.chapterIds);
  const pool = await loadPool(user, exam.curriculumId, exam.chapterIds);
  const result = generateExam({ pool, chapters, targetDifficulty: exam.targetDifficulty, durationMinutes: exam.durationMinutes });
  await prisma.$transaction(async (tx) => {
    await tx.exam.update({ where: { id }, data: { warnings: result.warnings } });
    await writeQuestions(tx, id, result.questionIds);
  });
  return getExam(user, id);
}

/** Locks the exam and counts its questions as used. */
export async function finalizeExam(user: SessionUser, id: string) {
  const exam = await ownedExam(user, id);
  requireDraft(exam);
  const rows = await prisma.examQuestion.findMany({ where: { examId: id }, select: { questionId: true } });
  if (rows.length === 0) throw badRequest("Add at least one question before finalizing");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    // Conditional update: two tabs finalizing at once can't double-count usage.
    const done = await tx.exam.updateMany({ where: { id, status: "DRAFT" }, data: { status: "FINAL", finalizedAt: now } });
    if (done.count === 0) throw conflict("This exam is already final");
    await tx.question.updateMany({
      where: { id: { in: rows.map((r) => r.questionId) } },
      data: { timesUsed: { increment: 1 }, lastUsedAt: now },
    });
  });
  return getExam(user, id);
}

export async function deleteExam(user: SessionUser, id: string) {
  await ownedExam(user, id);
  await prisma.exam.delete({ where: { id } });
}
