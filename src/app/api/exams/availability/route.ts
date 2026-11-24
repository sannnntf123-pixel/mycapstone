import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/errors";
import { availabilityQuery } from "@/lib/validation";
import { examAvailability } from "@/server/exams";

// Per chapter: how many approved questions (and minutes) match the chosen difficulty.
export const GET = handle(async (req: Request) => {
  const user = await requireRole(req, "INSTRUCTOR");
  const query = availabilityQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json(await examAvailability(user, query));
});
