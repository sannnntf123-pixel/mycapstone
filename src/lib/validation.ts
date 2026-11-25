import { z } from "zod";
import { MAJOR_VALUES } from "./majors";

export const registerSchema = z.object({
  email: z.string().email().max(254).toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    // bcrypt silently ignores everything after 72 bytes, so longer passwords would give false security.
    .refine((p) => new TextEncoder().encode(p).length <= 72, "Password must be at most 72 bytes"),
  name: z.string().trim().min(1).max(100),
  inviteCode: z.string().min(1, "An instructor invite code is required"),
  major: z.enum(MAJOR_VALUES, { errorMap: () => ({ message: "Choose your major from the list" }) }),
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

// Optional corrections a reviewer makes while approving.
export const approveQuestionSchema = z.object({
  difficulty: z.number().int().min(1).max(5).optional(),
  estimatedTimeMinutes: z.number().int().min(1).max(600).optional(),
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

// ---------- AI question generation ----------
export const generateQuestionsSchema = z.object({
  curriculumId: z.string().min(1),
  chapterId: z.string().min(1),
  count: z.number().int().min(1, "Ask for at least 1 question").max(10, "Ask for at most 10 questions at a time"),
  // null = a spread of difficulties
  difficulty: z.number().int().min(1).max(5).nullable(),
  kind: z.enum(["written", "multiple_choice", "mixed"]),
  focus: z.string().trim().max(300, "Keep the focus under 300 characters").optional(),
});

const draftQuestionSchema = z.object({
  content: z.string().trim().min(1, "A question needs text").max(5000),
  options: z
    .array(z.string().trim().min(1, "Options can't be empty").max(500))
    .min(2, "Multiple choice needs at least 2 options")
    .max(8)
    .refine((o) => new Set(o.map((x) => x.toLowerCase())).size === o.length, "Options must be different from each other")
    .nullable(),
  answer: z.string().trim().min(1, "A question needs an answer").max(5000),
  difficulty: z.number().int().min(1).max(5),
  estimatedTimeMinutes: z.number().int().min(1).max(600),
});

export const submitDraftsSchema = z.object({
  generationId: z.string().min(1),
  visibility: z.enum(["PRIVATE", "SHARED"]),
  questions: z.array(draftQuestionSchema).min(1, "Choose at least one draft to submit").max(12),
});
