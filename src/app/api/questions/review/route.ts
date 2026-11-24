import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/errors";
import { pageQuery } from "@/lib/validation";
import { listReviewQueue } from "@/server/questions";

// Pending questions this instructor may review: others' shared questions and their own private ones.
export const GET = handle(async (req: Request) => {
  const user = await requireRole(req, "INSTRUCTOR");
  const { page, pageSize } = pageQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
  return NextResponse.json(await listReviewQueue(user, page, pageSize));
});
