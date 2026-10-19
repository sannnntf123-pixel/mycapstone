"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type User = { id: string; email: string; name: string; role: string };

export type LogEntry = {
  id: number;
  at: string;
  method: string;
  path: string;
  requestBody?: string;
  status: number;
  ms: number;
  response: unknown;
};

export type ApiResult<T = unknown> = { status: number; ok: boolean; data: T };

type Session = {
  token: string | null;
  user: User | null;
  setSession: (token: string, user: User) => void;
  logout: () => void;
  log: LogEntry[];
  clearLog: () => void;
  /** JSON request. `body` is serialised; use `rawBody` to send text as-is (e.g. malformed JSON). */
  api: <T = unknown>(method: string, path: string, opts?: { body?: unknown; rawBody?: string }) => Promise<ApiResult<T>>;
};

const SessionContext = createContext<Session | null>(null);
const STORAGE_KEY = "capstone-tester-session";

// Dev tool convenience: the token is kept in localStorage so a page refresh keeps you logged in.
function loadStored(): { token: string; user: User } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function store(value: { token: string; user: User } | null) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable (private mode): session just won't survive a refresh
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const nextId = useRef(1);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    const stored = loadStored();
    if (stored) {
      tokenRef.current = stored.token;
      setToken(stored.token);
      setUser(stored.user);
    }
  }, []);

  const setSession = useCallback((t: string, u: User) => {
    tokenRef.current = t;
    setToken(t);
    setUser(u);
    store({ token: t, user: u });
  }, []);

  const logout = useCallback(() => {
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    store(null);
  }, []);

  const api = useCallback(
    async <T,>(method: string, path: string, opts: { body?: unknown; rawBody?: string } = {}): Promise<ApiResult<T>> => {
      const requestBody = opts.rawBody ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined);
      const started = performance.now();
      let status = 0;
      let data: unknown = null;
      try {
        const res = await fetch(`/api${path}`, {
          method,
          headers: {
            ...(requestBody !== undefined ? { "content-type": "application/json" } : {}),
            ...(tokenRef.current ? { authorization: `Bearer ${tokenRef.current}` } : {}),
          },
          body: requestBody,
        });
        status = res.status;
        const text = await res.text();
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = text;
        }
      } catch (err) {
        data = { error: `Network error: ${String(err)}` };
      }
      const entry: LogEntry = {
        id: nextId.current++,
        at: new Date().toLocaleTimeString(),
        method,
        path,
        requestBody,
        status,
        ms: Math.round(performance.now() - started),
        response: data,
      };
      setLog((prev) => [entry, ...prev].slice(0, 50));
      return { status, ok: status >= 200 && status < 300, data: data as T };
    },
    [],
  );

  const value = useMemo<Session>(
    () => ({ token, user, setSession, logout, log, clearLog: () => setLog([]), api }),
    [token, user, setSession, logout, log, api],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
