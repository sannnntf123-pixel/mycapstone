import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { handle, readJson } from "@/lib/errors";
import { submitDraftsSchema } from "@/lib/validation";
import { submitDrafts } from "@/server/ai";

// Saves kept drafts as PENDING, AI-labelled questions; they then go through normal review.
export const POST = handle(async (req: Request) => {
  const user = await requireRole(req, "INSTRUCTOR");
  const input = submitDraftsSchema.parse(await readJson(req));
  return NextResponse.json(await submitDrafts(user, input), { status: 201 });
});
