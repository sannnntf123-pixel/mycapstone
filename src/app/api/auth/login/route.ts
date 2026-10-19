import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, verifyPassword } from "@/lib/auth";
import { handle, unauthorized } from "@/lib/errors";
import { loginSchema } from "@/lib/validation";

export const POST = handle(async (req: Request) => {
  const input = loginSchema.parse(await req.json());

  const record = await prisma.user.findUnique({ where: { email: input.email } });
  // Same message for unknown email and wrong password, so attackers can't probe which emails exist.
  if (!record || !(await verifyPassword(input.password, record.passwordHash))) {
    throw unauthorized("Invalid email or password");
  }

  const user = { id: record.id, email: record.email, name: record.name, role: record.role };
  return NextResponse.json({ user, token: await signToken(user) });
});
