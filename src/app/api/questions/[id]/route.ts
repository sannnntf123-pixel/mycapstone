import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/errors";
import { getVisibleQuestion } from "@/server/questions";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireRole(req, "INSTRUCTOR");
  const { id } = await params;
  return NextResponse.json(await getVisibleQuestion(user, id));
});
