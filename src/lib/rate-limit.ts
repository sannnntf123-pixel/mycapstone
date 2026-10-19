import { getEnv } from "./env";
import { tooManyRequests } from "./errors";

// Fixed-window counter of failed attempts per key.
// The store is in-process memory: correct for a single server instance. When the app
// runs on several instances, swap in a shared store (e.g. Redis) behind this interface.
export interface AttemptStore {
  get(key: string): { count: number; resetAt: number } | undefined;
  set(key: string, value: { count: number; resetAt: number }): void;
  delete(key: string): void;
}

class MemoryStore implements AttemptStore {
  private map = new Map<string, { count: number; resetAt: number }>();
  get(key: string) {
    const entry = this.map.get(key);
    if (entry && entry.resetAt <= Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return entry;
  }
  set(key: string, value: { count: number; resetAt: number }) {
    this.map.set(key, value);
  }
  delete(key: string) {
    this.map.delete(key);
  }
}

const globalForStore = globalThis as unknown as { attemptStore?: AttemptStore };
const store: AttemptStore = (globalForStore.attemptStore ??= new MemoryStore());

// Throws 429 if this key has used up its failed attempts in the current window.
export function assertNotLimited(key: string) {
  const entry = store.get(key);
  if (entry && entry.count >= getEnv().RATE_LIMIT_MAX_ATTEMPTS) {
    throw tooManyRequests(Math.ceil((entry.resetAt - Date.now()) / 1000));
  }
}

export function recordFailure(key: string) {
  const entry = store.get(key);
  if (entry) {
    entry.count += 1;
    store.set(key, entry);
  } else {
    store.set(key, { count: 1, resetAt: Date.now() + getEnv().RATE_LIMIT_WINDOW_MINUTES * 60_000 });
  }
}

export function clearFailures(key: string) {
  store.delete(key);
}

// X-Forwarded-For is client-controlled unless a trusted proxy in front of the app sets it,
// so without TRUST_PROXY every caller shares one bucket rather than letting attackers
// pick a fresh "IP" per request. Behind a proxy, its appended (last) hop is the real client.
export function clientIp(req: Request): string {
  if (!getEnv().TRUST_PROXY) return "untrusted";
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",").at(-1)?.trim() || "unknown";
}
