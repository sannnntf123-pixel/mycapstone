import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken } from "@/lib/auth";
import { conflict, forbidden, handle } from "@/lib/errors";
import { registerSchema } from "@/lib/validation";

export const POST = handle(async (req: Request) => {
  const input = registerSchema.parse(await req.json());

  // Fails closed: if INSTRUCTOR_INVITE_CODE is unset, nobody can register.
  const expected = process.env.INSTRUCTOR_INVITE_CODE;
  if (!expected || input.inviteCode !== expected) {
    throw forbidden("A valid instructor invite code is required");
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw conflict("Email is already registered");

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      role: "INSTRUCTOR",
      passwordHash: await hashPassword(input.password),
    },
    select: { id: true, email: true, name: true, role: true },
  });

  return NextResponse.json({ user, token: await signToken(user) }, { status: 201 });
});
