"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, type User } from "@/lib/client/session";
import { describeError } from "@/lib/client/types";
import { AuthShell, FormError, PasswordInput } from "../_components/AuthShell";
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
      setError(res.status === 401 ? "That email and password don't match an account." : describeError(res.data, res.status));
    }
  }

  return (
    <AuthShell>
      <h1 className={s.pageTitle}>Welcome back</h1>
      <p className={s.subtitle}>Sign in to manage your questions and review your colleagues&apos;.</p>
      {error && <FormError>{error}</FormError>}
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
            placeholder="you@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
            required
          />
        </div>
        <div className={s.field}>
          <label className={s.label} htmlFor="password">
            Password
          </label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button className={`${s.button} ${s.block}`} disabled={busy} style={{ marginTop: 8 }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className={s.switchAuth}>
        New here? <Link href="/instructor/signup">Create an instructor account</Link>
      </p>
    </AuthShell>
  );
}
