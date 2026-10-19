"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/client/session";
import s from "./tester.module.css";

const links = [
  { href: "/tester", label: "Sign in" },
  { href: "/tester/curricula", label: "Curricula" },
  { href: "/tester/questions", label: "Questions" },
  { href: "/tester/review", label: "Review" },
  { href: "/tester/raw", label: "Raw request" },
];

export function TopBar() {
  const pathname = usePathname();
  const { user, logout } = useSession();
  return (
    <header className={s.topbar}>
      <span className={s.brand}>Question Bank API tester</span>
      <nav className={s.nav}>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={`${s.navLink} ${pathname === l.href ? s.navActive : ""}`}>
            {l.label}
          </Link>
        ))}
      </nav>
      <span className={s.who}>
        {user ? (
          <>
            Signed in as <b>{user.name}</b>{" "}
            <button className={`${s.button} ${s.secondary} ${s.small}`} onClick={logout}>
              Log out
            </button>
          </>
        ) : (
          "Not signed in"
        )}
      </span>
    </header>
  );
}

export function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.main}>
      <div className={s.column}>{children}</div>
      <RequestLog />
    </div>
  );
}

function RequestLog() {
  const { log, clearLog } = useSession();
  return (
    <aside className={`${s.card} ${s.logPanel}`}>
      <div className={s.row}>
        <h2 style={{ flex: 1 }}>Request log</h2>
        <button className={`${s.button} ${s.secondary} ${s.small}`} onClick={clearLog} disabled={!log.length}>
          Clear
        </button>
      </div>
      <p className={s.hint}>Every call these pages make, newest first.</p>
      {log.length === 0 && <p className={s.muted}>No requests yet.</p>}
      {log.map((e) => (
        <div key={e.id} className={s.logEntry}>
          <div className={s.logHead}>
            <span className={s[`status${String(e.status)[0]}`]}>{e.status || "ERR"}</span>
            <b>{e.method}</b>
            <span className={s.logPath}>/api{e.path}</span>
            <span className={s.muted}>{e.ms} ms</span>
          </div>
          {e.requestBody !== undefined && (
            <details>
              <summary className={s.muted} style={{ fontSize: 12, cursor: "pointer" }}>
                request body
              </summary>
              <pre className={s.pre}>{e.requestBody}</pre>
            </details>
          )}
          <pre className={s.pre}>{JSON.stringify(e.response, null, 2)}</pre>
        </div>
      ))}
    </aside>
  );
}

export function Badge({ value }: { value: string }) {
  return <span className={`${s.badge} ${s[value] ?? ""}`}>{value}</span>;
}

export function SignInNotice() {
  const { user } = useSession();
  if (user) return null;
  return (
    <div className={s.notice}>
      You are not signed in, so protected requests will return 401. <Link href="/tester">Sign in first</Link>.
    </div>
  );
}
