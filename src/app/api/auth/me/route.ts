import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { handle } from "@/lib/errors";

export const GET = handle(async (req: Request) => {
  const user = await requireUser(req);
  return NextResponse.json({ user });
});
