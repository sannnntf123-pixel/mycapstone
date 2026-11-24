import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { handle, readJson } from "@/lib/errors";
import { createExamSchema } from "@/lib/validation";
import { createExam, listExams } from "@/server/exams";

export const GET = handle(async (req: Request) => {
  const user = await requireRole(req, "INSTRUCTOR");
  return NextResponse.json(await listExams(user));
});

// Generates an exam from the question bank and saves it as a draft.
export const POST = handle(async (req: Request) => {
  const user = await requireRole(req, "INSTRUCTOR");
  const input = createExamSchema.parse(await readJson(req));
  return NextResponse.json(await createExam(user, input), { status: 201 });
});
