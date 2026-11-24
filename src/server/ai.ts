// AI question generation with Claude.
//
// Claude writes *drafts*. Nothing is saved as a question here: the instructor previews
// and edits the drafts, then submits the ones they keep, which enter the normal review
// queue as PENDING. Every generation is recorded in ai_generations for traceability.

import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z4 from "zod/v4";
import type { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { badRequest, conflict, HttpError, notFound } from "@/lib/errors";
import type { generateQuestionsSchema, submitDraftsSchema } from "@/lib/validation";
import { visibleToInstructor } from "./questions";

export const AI_MODEL = "claude-opus-5-5";
const FAKE_MODEL = "fake";
/** Drafts can be submitted for this long after they were generated. */
const DRAFT_LIFETIME_MS = 24 * 60 * 60 * 1000;
const DIFFICULTY_LABELS = ["Very easy", "Easy", "Medium", "Hard", "Very hard"];

export type GenerateInput = z.infer<typeof generateQuestionsSchema>;
export type SubmitInput = z.infer<typeof submitDraftsSchema>;

/** A validated draft, in the same shape the question API uses. */
export type Draft = {
  content: string;
  options: string[] | null;
  answer: string;
  difficulty: number;
  estimatedTimeMinutes: number;
  explanation: string;
};

export function aiStatus() {
  const env = getEnv();
  if (env.AI_FAKE) return { mode: "fake" as const, model: FAKE_MODEL };
  if (env.ANTHROPIC_API_KEY) return { mode: "live" as const, model: AI_MODEL };
  return { mode: "off" as const, model: null };
}

// ---------------------------------------------------------------------------
// What Claude must return (structured output, so there is no free text to parse).
// Ranges are checked afterwards by validateDraft, with the same rules as manual questions.
const DraftSchema = z4.object({
  content: z4.string().describe("The question exactly as students will read it."),
  kind: z4.enum(["written", "multiple_choice"]),
  options: z4.array(z4.string()).describe("Answer options for multiple choice (2 to 6). Empty for written questions."),
  correct_option: z4.number().int().nullable().describe("0-based index of the correct option; null for written questions."),
  answer: z4.string().describe("For written questions, the model answer. For multiple choice, the correct option's text."),
  difficulty: z4.number().int().describe("1 (very easy) to 5 (very hard)."),
  estimated_minutes: z4.number().int().describe("Minutes a prepared student needs to solve it."),
  explanation: z4.string().describe("One or two sentences for the reviewing instructor: what it tests and why the answer is right."),
});
const DraftsSchema = z4.object({ questions: z4.array(DraftSchema) });
type RawDraft = z4.infer<typeof DraftSchema>;

const SYSTEM_PROMPT = `You write exam questions for university courses. An instructor will review every question before students see it, so accuracy matters more than volume.

Write questions that:
- test the chosen chapter's material, at the requested difficulty;
- are self-contained, unambiguous and answerable in the estimated time;
- have a correct, complete model answer (for calculations, the final value and the key steps);
- for multiple choice, have exactly one correct option and plausible distractors drawn from common mistakes;
- differ from the existing questions listed, and from each other.

Difficulty scale: 1 = direct recall or a one-step exercise; 2 = a routine exercise; 3 = a standard problem needing several steps; 4 = a problem combining ideas or needing insight; 5 = a challenging problem for the strongest students.
Estimate time honestly for a prepared student, in whole minutes.
Use plain text. Write maths in readable ASCII (x^2, sqrt(x), integral of ...).
If a request can't be met (for example, the focus doesn't fit the chapter), write the closest good questions you can and say so in their explanations.`;

// ---------------------------------------------------------------------------
// Validation: the same rules the manual question API enforces.
function validateDraft(raw: RawDraft, wantKind: GenerateInput["kind"]): { draft?: Draft; problem?: string } {
  const content = raw.content.trim();
  const answer = raw.answer.trim();
  if (!content) return { problem: "a question had no text" };
  if (!Number.isInteger(raw.difficulty) || raw.difficulty < 1 || raw.difficulty > 5) return { problem: "a difficulty was outside 1–5" };
  if (!Number.isInteger(raw.estimated_minutes) || raw.estimated_minutes < 1 || raw.estimated_minutes > 600)
    return { problem: "a solving time was outside 1–600 minutes" };
  if (wantKind !== "mixed" && raw.kind !== wantKind) return { problem: "a question was the wrong type" };

  let options: string[] | null = null;
  let finalAnswer = answer;
  if (raw.kind === "multiple_choice") {
    options = raw.options.map((o) => o.trim());
    if (options.length < 2 || options.length > 8) return { problem: "a multiple-choice question had too few or too many options" };
    if (options.some((o) => !o)) return { problem: "a multiple-choice question had an empty option" };
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return { problem: "a multiple-choice question repeated an option" };
    const idx = raw.correct_option;
    if (idx === null || !Number.isInteger(idx) || idx < 0 || idx >= options.length) return { problem: "a multiple-choice question had no valid correct option" };
    finalAnswer = options[idx];
  } else if (!answer) {
    return { problem: "a written question had no answer" };
  }

  return {
    draft: {
      content,
      options,
      answer: finalAnswer,
      difficulty: raw.difficulty,
      estimatedTimeMinutes: raw.estimated_minutes,
      explanation: raw.explanation.trim(),
    },
  };
}

// ---------------------------------------------------------------------------
type Context = {
  course: { name: string; description: string | null };
  chapter: { title: string; orderIndex: number };
  otherChapters: string[];
  examples: { content: string; options: unknown; answer: string; difficulty: number; estimatedTimeMinutes: number }[];
  existing: string[];
};

function buildPrompt(input: GenerateInput, ctx: Context) {
  const kind =
    input.kind === "mixed"
      ? "a mix of written-answer and multiple-choice questions"
      : input.kind === "written"
        ? "written-answer questions only"
        : "multiple-choice questions only";
  const level =
    input.difficulty === null
      ? "a spread of difficulties from 1 to 5"
      : `difficulty ${input.difficulty} (${DIFFICULTY_LABELS[input.difficulty - 1]}); one level either side is acceptable`;

  const examples = ctx.examples.length
    ? ctx.examples
        .map(
          (q, i) =>
            `${i + 1}. [difficulty ${q.difficulty}, ${q.estimatedTimeMinutes} min] ${q.content}\n   ${
              Array.isArray(q.options) ? `Options: ${(q.options as string[]).join(" | ")}\n   ` : ""
            }Answer: ${q.answer}`,
        )
        .join("\n")
    : "(none yet)";

  return `<course>
Name: ${ctx.course.name}
${ctx.course.description ? `Description: ${ctx.course.description}\n` : ""}Chapter ${ctx.chapter.orderIndex}: ${ctx.chapter.title}
Other chapters in the course: ${ctx.otherChapters.join("; ") || "(none)"}
</course>

<approved_examples>
Approved questions from this chapter, showing the expected style and level:
${examples}
</approved_examples>

<existing_questions>
Do not repeat or closely paraphrase these:
${ctx.existing.map((c) => `- ${c}`).join("\n") || "(none)"}
</existing_questions>

<request>
Write ${input.count} new question${input.count === 1 ? "" : "s"} for Chapter ${ctx.chapter.orderIndex} (${ctx.chapter.title}).
Type: ${kind}.
Difficulty: ${level}.
${input.focus ? `Focus on: ${input.focus}` : "Cover different parts of the chapter."}
</request>`;
}

async function callClaude(input: GenerateInput, ctx: Context) {
  const client = new Anthropic({ apiKey: getEnv().ANTHROPIC_API_KEY, timeout: 180_000, maxRetries: 2 });
  let response;
  try {
    response = await client.beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 16000,
      // If Claude declines, the API retries on a fallback model chosen for the decline's category.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(DraftsSchema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPrompt(input, ctx) }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
      throw new HttpError(503, "The AI service rejected the API key. Check ANTHROPIC_API_KEY.");
    }
    if (err instanceof Anthropic.RateLimitError) {
      throw new HttpError(503, "The AI service is busy right now. Try again in a minute.");
    }
    if (err instanceof Anthropic.APIConnectionError) {
      throw new HttpError(503, "Couldn't reach the AI service. Check the server's internet connection.");
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Claude API error", err.status, err.message);
      throw new HttpError(502, "The AI service returned an error. Try again.");
    }
    throw err;
  }

  if (response.stop_reason === "refusal") {
    throw new HttpError(422, "The AI declined to write these questions. Try rewording the focus.");
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new HttpError(502, "The AI's answer was incomplete. Try fewer questions.");
  }
  return {
    raw: response.parsed_output.questions,
    model: response.model,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  };
}

// Canned drafts for tests and demos. A focus of "__invalid__" adds drafts that break the rules.
function fakeClaude(input: GenerateInput, ctx: Context) {
  const raw: RawDraft[] = [];
  for (let i = 0; i < input.count; i++) {
    const mcq = input.kind === "multiple_choice" || (input.kind === "mixed" && i % 2 === 1);
    const difficulty = input.difficulty ?? (i % 5) + 1;
    raw.push({
      content: `[Sample] ${ctx.chapter.title}: practice question ${i + 1}${input.focus && input.focus !== "__invalid__" ? ` on ${input.focus}` : ""}.`,
      kind: mcq ? "multiple_choice" : "written",
      options: mcq ? ["First option", "Second option", "Third option", "Fourth option"] : [],
      correct_option: mcq ? 1 : null,
      answer: mcq ? "Second option" : "A complete model answer.",
      difficulty,
      estimated_minutes: 2 + difficulty * 2,
      explanation: "Sample draft generated in fake mode (no AI call was made).",
    });
  }
  if (input.focus === "__invalid__") {
    raw.push({ ...raw[0], options: ["Same", "same"], kind: "multiple_choice", correct_option: 0 });
    raw.push({ ...raw[0], difficulty: 9 });
  }
  return { raw, model: FAKE_MODEL, inputTokens: 0, outputTokens: 0 };
}

// ---------------------------------------------------------------------------
export async function generateDrafts(user: SessionUser, input: GenerateInput) {
  const status = aiStatus();
  if (status.mode === "off") {
    throw new HttpError(503, "AI generation isn't set up on this server. An administrator needs to add ANTHROPIC_API_KEY.");
  }

  const chapter = await prisma.chapter.findUnique({ where: { id: input.chapterId }, include: { curriculum: { include: { chapters: true } } } });
  if (!chapter || chapter.curriculumId !== input.curriculumId) throw badRequest("chapterId does not belong to the given curriculumId");

  // Per-instructor hourly limit, counted from the database so restarts don't reset it.
  const limit = getEnv().AI_GENERATIONS_PER_HOUR;
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.aiGeneration.findMany({
    where: { createdById: user.id, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true },
  });
  if (recent.length >= limit) {
    const retryAfter = Math.max(1, Math.ceil((recent[0].createdAt.getTime() + 3_600_000 - Date.now()) / 1000));
    throw new HttpError(429, `You've reached the limit of ${limit} AI generations per hour. Try again later.`, {
      "Retry-After": String(retryAfter),
    });
  }

  // Only questions this instructor may see are sent to Claude: never others' private ones.
  const visible: Prisma.QuestionWhereInput = { AND: [visibleToInstructor(user.id), { chapterId: chapter.id }] };
  const [examples, existing] = await Promise.all([
    prisma.question.findMany({
      where: { AND: [visible, { status: "APPROVED" }] },
      orderBy: { approvedAt: "desc" },
      take: 6,
      select: { content: true, options: true, answer: true, difficulty: true, estimatedTimeMinutes: true },
    }),
    prisma.question.findMany({
      where: { AND: [visible, { status: { in: ["APPROVED", "PENDING"] } }] },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { content: true },
    }),
  ]);
  const ctx: Context = {
    course: { name: chapter.curriculum.name, description: chapter.curriculum.description },
    chapter: { title: chapter.title, orderIndex: chapter.orderIndex },
    otherChapters: chapter.curriculum.chapters
      .filter((c) => c.id !== chapter.id)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((c) => `${c.orderIndex}. ${c.title}`),
    examples,
    existing: existing.map((q) => q.content.slice(0, 200)),
  };

  const result = status.mode === "fake" ? fakeClaude(input, ctx) : await callClaude(input, ctx);

  const drafts: Draft[] = [];
  const problems: string[] = [];
  for (const raw of result.raw.slice(0, input.count + 2)) {
    const { draft, problem } = validateDraft(raw, input.kind);
    if (draft) drafts.push(draft);
    else if (problem) problems.push(problem);
  }
  const notes: string[] = [];
  if (problems.length) {
    notes.push(`${problems.length} draft${problems.length === 1 ? " was" : "s were"} dropped because ${[...new Set(problems)].join("; ")}.`);
  }
  if (drafts.length < input.count && result.raw.length < input.count) {
    notes.push(`The AI wrote ${result.raw.length} of the ${input.count} questions requested.`);
  }

  const generation = await prisma.aiGeneration.create({
    data: {
      createdById: user.id,
      curriculumId: chapter.curriculumId,
      chapterId: chapter.id,
      params: { count: input.count, difficulty: input.difficulty, kind: input.kind, focus: input.focus ?? null },
      model: result.model,
      drafts,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
    },
  });

  return {
    generationId: generation.id,
    mode: status.mode,
    model: result.model,
    drafts,
    notes,
    usage: { inputTokens: result.inputTokens, outputTokens: result.outputTokens },
  };
}

/**
 * Saves the drafts the instructor kept (possibly edited) as PENDING, AI-labelled questions.
 * Only drafts from the instructor's own recent generation can be saved, and never more than
 * the generation produced.
 */
export async function submitDrafts(user: SessionUser, input: SubmitInput) {
  const generation = await prisma.aiGeneration.findFirst({ where: { id: input.generationId, createdById: user.id } });
  if (!generation) throw notFound("Generation not found");
  if (Date.now() - generation.createdAt.getTime() > DRAFT_LIFETIME_MS) {
    throw conflict("These drafts have expired. Generate new ones.");
  }
  const produced = (generation.drafts as unknown[]).length;
  const n = input.questions.length;

  for (const q of input.questions) {
    if (q.options && !q.options.includes(q.answer)) {
      throw badRequest("For multiple-choice questions the answer must be one of the options");
    }
  }

  return prisma.$transaction(async (tx) => {
    // Conditional increment: two tabs submitting at once can't exceed the drafts produced.
    const claimed = await tx.aiGeneration.updateMany({
      where: { id: generation.id, submittedCount: { lte: produced - n } },
      data: { submittedCount: { increment: n } },
    });
    if (claimed.count === 0) throw conflict("These drafts have already been submitted");

    const created = [];
    for (const q of input.questions) {
      created.push(
        await tx.question.create({
          data: {
            content: q.content,
            options: q.options ?? undefined,
            answer: q.answer,
            difficulty: q.difficulty,
            estimatedTimeMinutes: q.estimatedTimeMinutes,
            curriculumId: generation.curriculumId,
            chapterId: generation.chapterId,
            visibility: input.visibility,
            source: "AI",
            status: "PENDING",
            createdById: user.id,
            aiGenerationId: generation.id,
          },
          select: { id: true, status: true, source: true, visibility: true },
        }),
      );
    }
    return { items: created };
  });
}
