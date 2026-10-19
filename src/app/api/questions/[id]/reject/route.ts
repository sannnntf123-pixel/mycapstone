import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { handle, readJson } from "@/lib/errors";
import { rejectQuestionSchema } from "@/lib/validation";
import { rejectQuestion } from "@/server/questions";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireRole(req, "INSTRUCTOR");
  const { id } = await params;
  // The body is optional: a rejection may or may not include a reason.
  const { reason } = rejectQuestionSchema.parse(await readJson(req, { optional: true }));
  return NextResponse.json(await rejectQuestion(user, id, reason));
});
