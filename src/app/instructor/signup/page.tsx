"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, type User } from "@/lib/client/session";
import { describeError } from "@/lib/client/types";
import s from "../instructor.module.css";

type Form = { name: string; email: string; password: string; confirm: string; inviteCode: string };

export default function SignupPage() {
  const router = useRouter();
  const { api, setSession, ready, user } = useSession();
  const [form, setForm] = useState<Form>({ name: "", email: "", password: "", confirm: "", inviteCode: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace("/instructor");
  }, [ready, user, router]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const mismatch = form.confirm !== "" && form.confirm !== form.password;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    const { name, email, password, inviteCode } = form;
    const res = await api<{ user: User; token: string }>("POST", "/auth/register", {
      body: { name, email, password, inviteCode },
    });
    setBusy(false);
    if (res.ok) {
      setSession(res.data.token, res.data.user);
      router.replace("/instructor");
    } else if (res.status === 403) {
      setError("That invite code is not valid. Ask your administrator for the instructor invite code.");
    } else if (res.status === 409) {
      setError("An account with this email already exists. Sign in instead.");
    } else {
      setError(describeError(res.data, res.status));
    }
  }

  return (
    <div className={s.loginWrap}>
      <div className={`${s.card} ${s.loginCard}`}>
        <h1 className={s.pageTitle}>Create instructor account</h1>
        <p className={s.subtitle}>Exam Question Bank</p>
        {error && (
          <div className={s.error} role="alert">
            {error}
          </div>
        )}
        <form onSubmit={submit}>
          <div className={s.field}>
            <label className={s.label} htmlFor="name">
              Full name
            </label>
            <input id="name" className={s.input} autoComplete="name" maxLength={100} value={form.name} onChange={set("name")} required />
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="email">
              Email
            </label>
            <input id="email" className={s.input} type="email" autoComplete="email" value={form.email} onChange={set("email")} required />
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="password">
              Password
            </label>
            <input
              id="password"
              className={s.input}
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={form.password}
              onChange={set("password")}
              aria-describedby="password-help"
              required
            />
            <div id="password-help" className={s.help} style={{ margin: "6px 0 0", fontSize: 13 }}>
              At least 8 characters.
            </div>
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="confirm">
              Confirm password
            </label>
            <input
              id="confirm"
              className={s.input}
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={set("confirm")}
              aria-invalid={mismatch}
              required
            />
            {mismatch && <div className={s.fieldError}>Passwords do not match.</div>}
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="inviteCode">
              Invite code
            </label>
            <input
              id="inviteCode"
              className={s.input}
              autoComplete="off"
              value={form.inviteCode}
              onChange={set("inviteCode")}
              aria-describedby="invite-help"
              required
            />
            <div id="invite-help" className={s.help} style={{ margin: "6px 0 0", fontSize: 13 }}>
              Accounts are for instructors only. Your administrator gives you this code.
            </div>
          </div>
          <button className={s.button} style={{ width: "100%" }} disabled={busy}>
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className={s.switchAuth}>
          Already have an account? <Link href="/instructor/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
