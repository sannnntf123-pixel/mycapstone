import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import type { z } from "zod";
import type { createQuestionSchema, listQuestionsQuery } from "@/lib/validation";

// The single source of truth for "which questions may this instructor see":
// their own questions (any status/visibility) plus anything shared.
export function visibleToInstructor(userId: string): Prisma.QuestionWhereInput {
  return { OR: [{ createdById: userId }, { visibility: "SHARED" }] };
}

// Who may approve or reject a pending question:
// - shared questions are peer-reviewed: any instructor except the author;
// - private questions are visible only to their author, so the author reviews them.
export function canReview(user: SessionUser, q: { createdById: string; visibility: string }) {
  return q.visibility === "PRIVATE" ? q.createdById === user.id : q.createdById !== user.id;
}

export function reviewQueueWhere(user: SessionUser): Prisma.QuestionWhereInput {
  return {
    status: "PENDING",
    OR: [
      { createdById: user.id, visibility: "PRIVATE" },
      { createdById: { not: user.id }, visibility: "SHARED" },
    ],
  };
}

const questionInclude = {
  curriculum: { select: { id: true, name: true } },
  chapter: { select: { id: true, title: true, orderIndex: true } },
  createdBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
  rejectedBy: { select: { id: true, name: true } },
} satisfies Prisma.QuestionInclude;

export async function createQuestion(
  user: SessionUser,
  input: z.infer<typeof createQuestionSchema>,
) {
  const chapter = await prisma.chapter.findUnique({ where: { id: input.chapterId } });
  if (!chapter || chapter.curriculumId !== input.curriculumId) {
    throw badRequest("chapterId does not belong to the given curriculumId");
  }
  if (input.options && !input.options.includes(input.answer)) {
    throw badRequest("For multiple-choice questions the answer must be one of the options");
  }

  return prisma.question.create({
    data: {
      ...input,
      source: "MANUAL",
      status: "PENDING",
      createdById: user.id,
    },
    include: questionInclude,
  });
}

export async function listQuestions(
  user: SessionUser,
  query: z.infer<typeof listQuestionsQuery>,
) {
  const where: Prisma.QuestionWhereInput = {
    AND: [
      visibleToInstructor(user.id),
      {
        curriculumId: query.curriculumId,
        chapterId: query.chapterId,
        difficulty: query.difficulty,
        status: query.status,
        visibility: query.visibility,
        createdById: query.mine === "true" ? user.id : undefined,
      },
    ],
  };

  const [items, total] = await prisma.$transaction([
    prisma.question.findMany({
      where,
      include: questionInclude,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.question.count({ where }),
  ]);

  return { items, total, page: query.page, pageSize: query.pageSize };
}

// Returns 404 (not 403) for questions the user can't see, so private
// questions don't leak their existence.
export async function getVisibleQuestion(user: SessionUser, id: string) {
  const question = await prisma.question.findFirst({
    where: { AND: [{ id }, visibleToInstructor(user.id)] },
    include: questionInclude,
  });
  if (!question) throw notFound("Question not found");
  return question;
}

async function review(
  user: SessionUser,
  id: string,
  decision: { status: "APPROVED" } | { status: "REJECTED"; reason: string },
) {
  const question = await getVisibleQuestion(user, id);
  if (question.status !== "PENDING") {
    throw conflict(`Question is already ${question.status.toLowerCase()}`);
  }
  if (!canReview(user, question)) {
    throw forbidden("Shared questions must be reviewed by another instructor");
  }

  // Conditional update guards against two instructors reviewing at the same moment.
  const data: Prisma.QuestionUncheckedUpdateManyInput =
    decision.status === "APPROVED"
      ? { status: "APPROVED", approvedById: user.id, approvedAt: new Date(), rejectionReason: null }
      : { status: "REJECTED", rejectedById: user.id, rejectedAt: new Date(), rejectionReason: decision.reason };

  const result = await prisma.question.updateMany({ where: { id, status: "PENDING" }, data });
  if (result.count === 0) throw conflict("Question was reviewed by someone else");

  return getVisibleQuestion(user, id);
}

export const approveQuestion = (user: SessionUser, id: string) =>
  review(user, id, { status: "APPROVED" });

export const rejectQuestion = (user: SessionUser, id: string, reason: string) =>
  review(user, id, { status: "REJECTED", reason });

/** Pending questions this instructor may review, oldest first. */
export async function listReviewQueue(user: SessionUser, page: number, pageSize: number) {
  const where = reviewQueueWhere(user);
  const [items, total] = await prisma.$transaction([
    prisma.question.findMany({
      where,
      include: questionInclude,
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.question.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

/**
 * Authors control who can see their questions. Making a self-approved private question
 * shared sends it back for review, so nothing reaches the shared bank without a second
 * instructor's approval.
 */
export async function setVisibility(user: SessionUser, id: string, visibility: "PRIVATE" | "SHARED") {
  const question = await getVisibleQuestion(user, id);
  if (question.createdById !== user.id) throw forbidden("Only the author can change who sees a question");
  if (question.visibility === visibility) return question;

  const needsPeerReview =
    visibility === "SHARED" && question.status === "APPROVED" && question.approvedById === user.id;
  await prisma.question.update({
    where: { id },
    data: needsPeerReview
      ? { visibility, status: "PENDING", approvedById: null, approvedAt: null }
      : { visibility },
  });
  return getVisibleQuestion(user, id);
}
