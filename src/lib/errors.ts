import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public headers?: Record<string, string>,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string) => new HttpError(400, msg);
export const unauthorized = (msg = "Authentication required") => new HttpError(401, msg);
export const forbidden = (msg = "You do not have permission to do this") => new HttpError(403, msg);
export const notFound = (msg = "Not found") => new HttpError(404, msg);
export const conflict = (msg: string) => new HttpError(409, msg);
export const tooManyRequests = (retryAfterSeconds: number) =>
  new HttpError(429, "Too many attempts. Try again later.", { "Retry-After": String(retryAfterSeconds) });

export function toErrorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status, headers: err.headers });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", details: err.flatten().fieldErrors },
      { status: 400 },
    );
  }
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

// Wraps a route handler so thrown HttpErrors / ZodErrors become JSON responses.
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}

// Parses a JSON body, turning malformed JSON into a 400 instead of a 500.
// With `optional`, an empty body is read as {}.
export async function readJson(req: Request, { optional = false } = {}): Promise<unknown> {
  const text = await req.text();
  if (!text.trim()) {
    if (optional) return {};
    throw badRequest("Request body must be JSON");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw badRequest("Request body is not valid JSON");
  }
}
