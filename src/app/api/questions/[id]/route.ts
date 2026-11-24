import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { handle, readJson } from "@/lib/errors";
import { updateQuestionSchema } from "@/lib/validation";
import { getVisibleQuestion, setVisibility } from "@/server/questions";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireRole(req, "INSTRUCTOR");
  const { id } = await params;
  return NextResponse.json(await getVisibleQuestion(user, id));
});

// Authors change visibility here. Sharing a self-approved question sends it back for peer review.
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireRole(req, "INSTRUCTOR");
  const { id } = await params;
  const { visibility } = updateQuestionSchema.parse(await readJson(req));
  return NextResponse.json(await setVisibility(user, id, visibility));
});
