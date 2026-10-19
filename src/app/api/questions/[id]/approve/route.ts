import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/errors";
import { approveQuestion } from "@/server/questions";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireRole(req, "INSTRUCTOR");
  const { id } = await params;
  return NextResponse.json(await approveQuestion(user, id));
});
