import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { handle, readJson } from "@/lib/errors";
import { updateExamSchema } from "@/lib/validation";
import { deleteExam, getExam, updateExam } from "@/server/exams";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireRole(req, "INSTRUCTOR");
  return NextResponse.json(await getExam(user, (await params).id));
});

// { title?, questionIds? }: questionIds is the full ordered list (remove, reorder, swap, add).
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireRole(req, "INSTRUCTOR");
  const input = updateExamSchema.parse(await readJson(req));
  return NextResponse.json(await updateExam(user, (await params).id, input));
});

export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireRole(req, "INSTRUCTOR");
  await deleteExam(user, (await params).id);
  return new NextResponse(null, { status: 204 });
});
