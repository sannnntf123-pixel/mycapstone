"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, LogoMark, type IconName } from "@/components/Icon";
import { REVIEW_CHANGED } from "@/lib/client/events";
import { useSession } from "@/lib/client/session";
import s from "../instructor.module.css";

const links: { href: string; label: string; icon: IconName }[] = [
  { href: "/instructor", label: "Dashboard", icon: "grid" },
  { href: "/instructor/questions/new", label: "Post a question", icon: "pencil" },
  { href: "/instructor/review", label: "Review", icon: "shield" },
  { href: "/instructor/exams", label: "Exams", icon: "file" },
];

function initials(name: string) {
  const parts = name.replace(/^(dr|prof|mr|mrs|ms)\.?\s+/i, "").trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

// Client-side redirect for convenience only; the API enforces access on every request.
export default function SignedInLayout({ children }: { children: React.ReactNode }) {
  const { ready, user, logout, api } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    const refresh = () =>
      api<{ total: number }>("GET", "/questions/review?pageSize=1").then((r) => r.ok && setPending(r.data.total));
    refresh();
    window.addEventListener(REVIEW_CHANGED, refresh);
    return () => window.removeEventListener(REVIEW_CHANGED, refresh);
  }, [api, user, pathname]);

  useEffect(() => {
    if (ready && !user) router.replace("/instructor/login");
  }, [ready, user, router]);

  if (!ready || !user) return null;

  return (
    <>
      <header className={s.header}>
        <div className={s.headerInner}>
          <Link href="/instructor" className={s.brand}>
            <LogoMark />
            Question Bank
          </Link>
          <nav className={s.nav} aria-label="Main">
            {links.map((l) => {
              const active =
                l.href === "/instructor"
                  ? pathname === l.href
                  : l.href === "/instructor/questions/new"
                    ? pathname.startsWith("/instructor/questions")
                    : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`${s.navLink} ${active ? s.navActive : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon name={l.icon} size={16} />
                  {l.label}
                  {l.href === "/instructor/review" && !!pending && (
                    <span className={s.navBadge} aria-label={`${pending} waiting`}>
                      {pending > 99 ? "99+" : pending}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className={s.userBox}>
            <span className={s.avatar} aria-hidden>
              {initials(user.name)}
            </span>
            <span className={s.userName}>
              <span>{user.name}</span>
              <span>{user.email}</span>
            </span>
            <button
              className={`${s.button} ${s.quiet} ${s.small}`}
              aria-label="Sign out"
              onClick={() => {
                logout();
                router.replace("/instructor/login");
              }}
            >
              <Icon name="logout" size={16} />
              <span className={s.signOutText}>Sign out</span>
            </button>
          </div>
        </div>
      </header>
      <main className={s.container}>{children}</main>
    </>
  );
}
