import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { handle } from "@/lib/errors";
import { aiStatus } from "@/server/ai";

// Whether AI generation is available: "live" (Claude), "fake" (canned drafts) or "off".
export const GET = handle(async (req: Request) => {
  await requireRole(req, "INSTRUCTOR");
  return NextResponse.json({ ...aiStatus(), perHour: getEnv().AI_GENERATIONS_PER_HOUR });
});
