// Generates a new question selection with the exam's saved settings (drafts only).
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/errors";
import { regenerateExam } from "@/server/exams";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireRole(req, "INSTRUCTOR");
  return NextResponse.json(await regenerateExam(user, (await params).id));
});
