"use client";

import { useState } from "react";
import { Page } from "./components";
import { useSession, type User } from "./session";
import s from "./tester.module.css";

const DEMO_EMAILS = ["lina.nasser@example.com", "omar.khalil@example.com", "sara.haddad@example.com"];

type AuthResponse = { user: User; token: string };

export default function SignInPage() {
  const { api, setSession, user, token } = useSession();
  const [email, setEmail] = useState(DEMO_EMAILS[0]);
  const [password, setPassword] = useState("");
  const [reg, setReg] = useState({ name: "", email: "", password: "", inviteCode: "" });
  const [message, setMessage] = useState("");

  async function login(e: React.FormEvent) {
    e.preventDefault();
    const res = await api<AuthResponse>("POST", "/auth/login", { body: { email, password } });
    if (res.ok) {
      setSession(res.data.token, res.data.user);
      setMessage(`Signed in as ${res.data.user.name}.`);
    } else {
      setMessage(`Login failed (HTTP ${res.status}). See the request log.`);
    }
  }

  async function register(e: React.FormEvent) {
    e.preventDefault();
    const res = await api<AuthResponse>("POST", "/auth/register", { body: reg });
    if (res.ok) {
      setSession(res.data.token, res.data.user);
      setMessage(`Registered and signed in as ${res.data.user.name}.`);
    } else {
      setMessage(`Registration failed (HTTP ${res.status}). See the request log.`);
    }
  }

  return (
    <Page>
      <section className={s.card}>
        <h2>Log in</h2>
        <p className={s.hint}>
          Demo instructors come from <code>npm run db:seed</code>; their password is <code>SEED_PASSWORD</code> in your
          <code> .env</code>. Five wrong passwords lock an account for 15 minutes (HTTP 429).
        </p>
        <div className={s.row} style={{ marginBottom: 10 }}>
          {DEMO_EMAILS.map((d) => (
            <button key={d} type="button" className={`${s.button} ${s.secondary} ${s.small}`} onClick={() => setEmail(d)}>
              {d.split(".")[0]}
            </button>
          ))}
        </div>
        <form className={s.form} onSubmit={login}>
          <label className={s.field}>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className={s.field}>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className={s.button}>Log in</button>
        </form>
        {message && <p style={{ marginBottom: 0 }}>{message}</p>}
      </section>

      <section className={s.card}>
        <h2>Register an instructor</h2>
        <p className={s.hint}>
          Needs the invite code (<code>INSTRUCTOR_INVITE_CODE</code>). Five wrong codes block registration for 15 minutes.
        </p>
        <form className={s.form} onSubmit={register}>
          {(["name", "email", "password", "inviteCode"] as const).map((k) => (
            <label key={k} className={s.field}>
              {k === "inviteCode" ? "Invite code" : k[0].toUpperCase() + k.slice(1)}
              <input
                type={k === "password" ? "password" : "text"}
                value={reg[k]}
                onChange={(e) => setReg({ ...reg, [k]: e.target.value })}
              />
            </label>
          ))}
          <button className={s.button}>Register</button>
        </form>
      </section>

      <section className={s.card}>
        <h2>Current session</h2>
        <p className={s.hint}>Calls GET /api/auth/me with the stored token.</p>
        <div className={s.row}>
          <button className={s.button} onClick={() => api("GET", "/auth/me")}>
            Who am I?
          </button>
          <span className={s.muted}>{user ? `${user.name} (${user.email})` : "No token stored"}</span>
        </div>
        {token && <pre className={s.pre}>{token}</pre>}
      </section>
    </Page>
  );
}
