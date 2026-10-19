"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/lib/client/session";
import s from "../instructor.module.css";

const links = [
  { href: "/instructor", label: "Dashboard" },
  { href: "/instructor/questions/new", label: "Post a question" },
];

// Client-side redirect for convenience only; the API enforces access on every request.
export default function SignedInLayout({ children }: { children: React.ReactNode }) {
  const { ready, user, logout } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !user) router.replace("/instructor/login");
  }, [ready, user, router]);

  if (!ready || !user) return null;

  return (
    <>
      <header className={s.header}>
        <div className={s.headerInner}>
          <Link href="/instructor" className={s.brand}>
            Question Bank
          </Link>
          <nav className={s.nav}>
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={`${s.navLink} ${pathname === l.href ? s.navActive : ""}`}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className={s.userBox}>
            <span>{user.name}</span>
            <button
              className={`${s.button} ${s.quiet}`}
              onClick={() => {
                logout();
                router.replace("/instructor/login");
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className={s.container}>{children}</main>
    </>
  );
}
