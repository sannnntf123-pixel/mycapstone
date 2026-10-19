import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().trim().min(1),
  role: z.enum(["INSTRUCTOR", "STUDENT"]).default("STUDENT"),
  inviteCode: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export const createCurriculumSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
});

export const createChapterSchema = z.object({
  title: z.string().trim().min(1),
  orderIndex: z.number().int().positive(),
});

export const createQuestionSchema = z.object({
  content: z.string().trim().min(1),
  options: z.array(z.string().trim().min(1)).min(2).optional(),
  answer: z.string().trim().min(1),
  curriculumId: z.string().min(1),
  chapterId: z.string().min(1),
  difficulty: z.number().int().min(1).max(5),
  estimatedTimeMinutes: z.number().int().min(1).max(600),
  visibility: z.enum(["PRIVATE", "SHARED"]).default("PRIVATE"),
});

export const rejectQuestionSchema = z.object({
  reason: z.string().trim().min(1).optional(),
});

// Query strings arrive as text, so numbers are coerced.
export const listQuestionsQuery = z.object({
  curriculumId: z.string().optional(),
  chapterId: z.string().optional(),
  difficulty: z.coerce.number().int().min(1).max(5).optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
  visibility: z.enum(["PRIVATE", "SHARED"]).optional(),
  mine: z.enum(["true", "false"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
