import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    // bcrypt silently ignores everything after 72 bytes, so longer passwords would give false security.
    .refine((p) => new TextEncoder().encode(p).length <= 72, "Password must be at most 72 bytes"),
  name: z.string().trim().min(1).max(100),
  inviteCode: z.string().min(1, "An instructor invite code is required"),
  major: z.string().trim().min(1, "Major is required").max(100),
  degree: z.enum(["BACHELOR", "MASTER", "DOCTORATE", "OTHER"], {
    errorMap: () => ({ message: "Choose your highest degree" }),
  }),
  university: z.string().trim().min(1, "University is required").max(150),
  courses: z
    .array(z.string().trim().min(1).max(100))
    .min(1, "Add at least one course you teach")
    .max(20, "At most 20 courses")
    // Same course typed twice (any case) is stored once.
    .transform((list) => [...new Map(list.map((c) => [c.toLowerCase(), c])).values()]),
});

export const loginSchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
  password: z.string().min(1).max(200),
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
  reason: z.string({ required_error: "A rejection reason is required" }).trim().min(1, "A rejection reason is required"),
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

// ---------- exams ----------
const difficultyOrMixed = z.number().int().min(1).max(5).nullable();

export const createExamSchema = z.object({
  title: z.string().trim().max(150).optional(),
  curriculumId: z.string().min(1),
  chapterIds: z.array(z.string().min(1)).min(1, "Choose at least one chapter").max(100),
  // null = mixed difficulty
  difficulty: difficultyOrMixed,
  durationMinutes: z.number().int().min(5, "An exam must be at least 5 minutes").max(600, "An exam can be at most 600 minutes"),
});

export const updateExamSchema = z
  .object({
    title: z.string().trim().min(1, "Give the exam a title").max(150).optional(),
    questionIds: z.array(z.string().min(1)).max(200).optional(),
  })
  .refine((v) => v.title !== undefined || v.questionIds !== undefined, "Nothing to update");

export const availabilityQuery = z.object({
  curriculumId: z.string().min(1),
  // Query strings are text: "mixed" or absent means no target.
  difficulty: z
    .union([z.literal("mixed"), z.coerce.number().int().min(1).max(5)])
    .optional()
    .transform((v) => (v === "mixed" || v === undefined ? null : v)),
});

export const updateQuestionSchema = z.object({
  visibility: z.enum(["PRIVATE", "SHARED"]),
});

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
