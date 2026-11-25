import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { conflict, forbidden, handle, readJson } from "@/lib/errors";
import { assertNotLimited, clientIp, recordFailure } from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation";

export const POST = handle(async (req: Request) => {
  const input = registerSchema.parse(await readJson(req));

  // Wrong invite codes are counted per IP so the code can't be brute-forced.
  const limitKey = `register:${clientIp(req)}`;
  assertNotLimited(limitKey);
  if (input.inviteCode !== getEnv().INSTRUCTOR_INVITE_CODE) {
    recordFailure(limitKey);
    throw forbidden("A valid instructor invite code is required");
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict("Email is already registered");

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: input.email,
        name: input.name,
        role: "INSTRUCTOR",
        passwordHash,
        major: input.major,
        degree: input.degree,
        university: input.university,
      },
      select: { id: true, email: true, name: true, role: true },
    });
    // Each course is an existing course (matched ignoring case) or a new one created now,
    // owned by this instructor. The profile stores the courses' real names.
    const names: string[] = [];
    for (const wanted of input.courses) {
      const found = await tx.curriculum.findFirst({ where: { name: { equals: wanted, mode: "insensitive" } }, select: { name: true } });
      const course = found ?? (await tx.curriculum.create({ data: { name: wanted, createdById: created.id }, select: { name: true } }));
      if (!names.includes(course.name)) names.push(course.name);
    }
    await tx.user.update({ where: { id: created.id }, data: { courses: names } });
    return created;
  });

  return NextResponse.json({ user, token: await signToken(user) }, { status: 201 });
});
