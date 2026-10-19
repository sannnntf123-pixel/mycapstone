import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { conflict, handle } from "@/lib/errors";
import { createCurriculumSchema } from "@/lib/validation";

export const GET = handle(async (req: Request) => {
  await requireRole(req, "INSTRUCTOR");
  const curricula = await prisma.curriculum.findMany({
    orderBy: { name: "asc" },
    include: { chapters: { orderBy: { orderIndex: "asc" } } },
  });
  return NextResponse.json({ items: curricula });
});

export const POST = handle(async (req: Request) => {
  const user = await requireRole(req, "INSTRUCTOR");
  const input = createCurriculumSchema.parse(await req.json());

  const exists = await prisma.curriculum.findUnique({ where: { name: input.name } });
  if (exists) throw conflict("A curriculum with this name already exists");

  const curriculum = await prisma.curriculum.create({
    data: { ...input, createdById: user.id },
  });
  return NextResponse.json(curriculum, { status: 201 });
});
