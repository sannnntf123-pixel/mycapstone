import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { forbidden, unauthorized } from "./errors";

export type SessionUser = { id: string; email: string; name: string; role: Role };

function secret() {
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(value);
}

export const hashPassword = (password: string) => bcrypt.hash(password, 10);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export function signToken(user: SessionUser) {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN ?? "8h")
    .sign(secret());
}

// Reads "Authorization: Bearer <token>" and loads the user fresh from the DB,
// so a deleted user or a changed role takes effect immediately.
export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const { payload } = await jwtVerify(header.slice(7), secret());
    if (!payload.sub) return null;
    return await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true },
    });
  } catch {
    return null;
  }
}

export async function requireUser(req: Request) {
  const user = await getSessionUser(req);
  if (!user) throw unauthorized();
  return user;
}

export async function requireRole(req: Request, ...roles: Role[]) {
  const user = await requireUser(req);
  if (!roles.includes(user.role)) throw forbidden();
  return user;
}
