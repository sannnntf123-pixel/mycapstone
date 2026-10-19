"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, type User } from "@/lib/client/session";
import { describeError } from "@/lib/client/types";
import s from "../instructor.module.css";

export default function LoginPage() {
  const router = useRouter();
  const { api, setSession, ready, user } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace("/instructor");
  }, [ready, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await api<{ user: User; token: string }>("POST", "/auth/login", { body: { email, password } });
    setBusy(false);
    if (res.ok) {
      setSession(res.data.token, res.data.user);
      router.replace("/instructor");
    } else {
      setError(res.status === 401 ? "Incorrect email or password." : describeError(res.data, res.status));
    }
  }

  return (
    <div className={s.loginWrap}>
      <div className={`${s.card} ${s.loginCard}`}>
        <h1 className={s.pageTitle}>Instructor sign in</h1>
        <p className={s.subtitle}>Exam Question Bank</p>
        {error && (
          <div className={s.error} role="alert">
            {error}
          </div>
        )}
        <form onSubmit={submit}>
          <div className={s.field}>
            <label className={s.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              className={s.input}
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className={s.input}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button className={s.button} style={{ width: "100%" }} disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
