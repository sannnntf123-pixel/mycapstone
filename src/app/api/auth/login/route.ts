import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken, verifyPassword } from "@/lib/auth";
import { handle, readJson, unauthorized } from "@/lib/errors";
import { assertNotLimited, clearFailures, recordFailure } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation";

export const POST = handle(async (req: Request) => {
  const input = loginSchema.parse(await readJson(req));

  // Keyed per account, not per IP: an attacker can't escape the limit by changing address.
  const limitKey = `login:${input.email}`;
  assertNotLimited(limitKey);

  const record = await prisma.user.findUnique({ where: { email: input.email } });
  // Same message for unknown email and wrong password, so attackers can't probe which emails exist.
  if (!(await verifyPassword(input.password, record?.passwordHash)) || !record) {
    recordFailure(limitKey);
    throw unauthorized("Invalid email or password");
  }
  clearFailures(limitKey);

  const user = { id: record.id, email: record.email, name: record.name, role: record.role };
  return NextResponse.json({ user, token: await signToken(user) });
});
