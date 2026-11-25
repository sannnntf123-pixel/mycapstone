import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { handle } from "@/lib/errors";

// Public on purpose: the sign-up form suggests existing courses before the person has
// an account. Only course names are exposed; chapters and questions still need a login.
export const GET = handle(async () => {
  const items = await prisma.curriculum.findMany({ orderBy: { name: "asc" }, select: { name: true }, take: 500 });
  return NextResponse.json({ items: items.map((c) => c.name) });
});
