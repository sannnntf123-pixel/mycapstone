import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { handle, readJson } from "@/lib/errors";
import { generateQuestionsSchema } from "@/lib/validation";
import { generateDrafts } from "@/server/ai";

// Asks Claude for question drafts. Saves nothing as a question: the instructor previews,
// edits and submits the drafts they keep via /api/questions/generate/submit.
export const POST = handle(async (req: Request) => {
  const user = await requireRole(req, "INSTRUCTOR");
  const input = generateQuestionsSchema.parse(await readJson(req));
  return NextResponse.json(await generateDrafts(user, input));
});
