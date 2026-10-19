import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/errors";
import { listQuestionsQuery } from "@/lib/validation";
import { listQuestions } from "@/server/questions";

// The question bank = approved questions only. Exam generation will draw from here.
export const GET = handle(async (req: Request) => {
  const user = await requireRole(req, "INSTRUCTOR");
  const query = listQuestionsQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json(await listQuestions(user, { ...query, status: "APPROVED" }));
});
