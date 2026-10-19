import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { handle, readJson } from "@/lib/errors";
import { createQuestionSchema, listQuestionsQuery } from "@/lib/validation";
import { createQuestion, listQuestions } from "@/server/questions";

export const GET = handle(async (req: Request) => {
  const user = await requireRole(req, "INSTRUCTOR");
  const query = listQuestionsQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json(await listQuestions(user, query));
});

export const POST = handle(async (req: Request) => {
  const user = await requireRole(req, "INSTRUCTOR");
  const input = createQuestionSchema.parse(await readJson(req));
  return NextResponse.json(await createQuestion(user, input), { status: 201 });
});
