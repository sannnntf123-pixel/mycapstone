import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters (use: openssl rand -base64 32)"),
  JWT_EXPIRES_IN: z.string().default("8h"),
  INSTRUCTOR_INVITE_CODE: z.string().min(8, "INSTRUCTOR_INVITE_CODE must be at least 8 characters"),
  RATE_LIMIT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),
  // Set to "true" only when running behind a proxy that sets X-Forwarded-For itself (Vercel, nginx).
  TRUST_PROXY: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

// Validated once; called at server start (src/instrumentation.ts) so bad config fails fast.
export function getEnv(): Env {
  if (cached) return cached;
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const problems = Object.entries(result.error.flatten().fieldErrors)
      .map(([key, msgs]) => `  - ${key}: ${msgs?.join(", ")}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  cached = result.data;
  return cached;
}
