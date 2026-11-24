import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/errors";
import { examAlternatives } from "@/server/exams";

type Ctx = { params: Promise<{ id: string }> };

// ?replace=<questionId> ranks replacements for that question; without it, questions to add.
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const user = await requireRole(req, "INSTRUCTOR");
  const replace = new URL(req.url).searchParams.get("replace") ?? undefined;
  return NextResponse.json(await examAlternatives(user, (await params).id, replace));
});
