import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { conflict, handle, readJson, notFound } from "@/lib/errors";
import { createChapterSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, { params }: Ctx) => {
  await requireRole(req, "INSTRUCTOR");
  const { id } = await params;
  const curriculum = await prisma.curriculum.findUnique({
    where: { id },
    include: { chapters: { orderBy: { orderIndex: "asc" } } },
  });
  if (!curriculum) throw notFound("Curriculum not found");
  return NextResponse.json({ items: curriculum.chapters });
});

export const POST = handle(async (req: Request, { params }: Ctx) => {
  await requireRole(req, "INSTRUCTOR");
  const { id } = await params;
  const input = createChapterSchema.parse(await readJson(req));

  const curriculum = await prisma.curriculum.findUnique({ where: { id } });
  if (!curriculum) throw notFound("Curriculum not found");

  const clash = await prisma.chapter.findFirst({
    where: { curriculumId: id, OR: [{ title: input.title }, { orderIndex: input.orderIndex }] },
  });
  if (clash) throw conflict("A chapter with this title or order already exists in this curriculum");

  const chapter = await prisma.chapter.create({ data: { ...input, curriculumId: id } });
  return NextResponse.json(chapter, { status: 201 });
});
