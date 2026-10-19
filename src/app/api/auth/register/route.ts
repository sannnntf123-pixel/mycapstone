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
