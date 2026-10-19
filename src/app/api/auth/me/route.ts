import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { handle } from "@/lib/errors";

export const GET = handle(async (req: Request) => {
  const user = await requireRole(req, "INSTRUCTOR");
  return NextResponse.json({ user });
});
