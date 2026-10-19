import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";
import { prisma } from "./prisma";
import { getEnv } from "./env";
import { forbidden, unauthorized } from "./errors";

export type SessionUser = { id: string; email: string; name: string; role: Role };

const BCRYPT_COST = 10;

const secret = () => new TextEncoder().encode(getEnv().JWT_SECRET);

export const hashPassword = (password: string) => bcrypt.hash(password, BCRYPT_COST);

// Compared against when the email doesn't exist, so an unknown email takes as long
// as a wrong password and response timing can't reveal which emails are registered.
let dummyHash: string | undefined;
export async function verifyPassword(password: string, hash: string | undefined) {
  dummyHash ??= await bcrypt.hash("timing-equaliser", BCRYPT_COST);
  const ok = await bcrypt.compare(password, hash ?? dummyHash);
  return ok && hash !== undefined;
}

export function signToken(user: SessionUser) {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(getEnv().JWT_EXPIRES_IN)
    .sign(secret());
}

async function userIdFromToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

// Reads "Authorization: Bearer <token>" and loads the user fresh from the DB,
// so a deleted user or a changed role takes effect immediately.
export async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const userId = await userIdFromToken(header.slice(7));
  if (!userId) return null;
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true },
  });
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
