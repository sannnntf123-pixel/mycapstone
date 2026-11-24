"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/Icon";
import { useSession } from "@/lib/client/session";
import { describeError, type QuestionPage } from "@/lib/client/types";
import s from "../instructor.module.css";

type Filter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

const FILTERS: { key: Filter; label: string; icon: IconName }[] = [
  { key: "ALL", label: "All questions", icon: "inbox" },
  { key: "PENDING", label: "Pending review", icon: "hourglass" },
  { key: "APPROVED", label: "Approved", icon: "checkCircle" },
  { key: "REJECTED", label: "Rejected", icon: "xCircle" },
];

const STATUS_LABEL: Record<string, string> = { PENDING: "Pending review", APPROVED: "Approved", REJECTED: "Rejected" };
const DIFFICULTY = ["Very easy", "Easy", "Medium", "Hard", "Very hard"];
const PAGE_SIZE = 10;

const EMPTY: Record<Filter, { title: string; body: string }> = {
  ALL: { title: "No questions yet", body: "Post your first question. It will appear here while it waits for review." },
  PENDING: { title: "Nothing waiting for review", body: "Questions you post appear here until another instructor reviews them." },
  APPROVED: { title: "No approved questions yet", body: "Once a colleague approves one of your questions, it shows up here and in the bank." },
  REJECTED: { title: "No rejected questions", body: "Nice. When a question is rejected, the reviewer's reason will be shown here." },
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(iso: string) {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days === 0) return "today";
  if (Math.abs(days) < 30) return rtf.format(days, "day");
  return new Date(iso).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
}

export default function DashboardPage() {
  const { api, user } = useSession();
  const [counts, setCounts] = useState<Record<Filter, number> | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<QuestionPage | null>(null);
  const [error, setError] = useState("");

  // Totals per status for the summary cards (pageSize=1: only the totals are needed).
  useEffect(() => {
    Promise.all(
      FILTERS.map((f) =>
        api<QuestionPage>("GET", `/questions?mine=true&pageSize=1${f.key === "ALL" ? "" : `&status=${f.key}`}`).then((r) =>
          r.ok ? r.data.total : 0,
        ),
      ),
    ).then(([ALL, PENDING, APPROVED, REJECTED]) => setCounts({ ALL, PENDING, APPROVED, REJECTED }));
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    setList(null);
    const status = filter === "ALL" ? "" : `&status=${filter}`;
    api<QuestionPage>("GET", `/questions?mine=true&pageSize=${PAGE_SIZE}&page=${page}${status}`).then((res) => {
      if (cancelled) return;
      if (res.ok) {
        setList(res.data);
        setError("");
      } else setError(describeError(res.data, res.status));
    });
    return () => {
      cancelled = true;
    };
  }, [api, filter, page]);

  const choose = (f: Filter) => {
    setFilter(f);
    setPage(1);
  };

  const pages = list ? Math.max(1, Math.ceil(list.total / PAGE_SIZE)) : 1;
  const firstName = user?.name.replace(/^(dr|prof)\.?\s+/i, "").split(" ")[0];

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <p className={s.eyebrow}>{greeting()},</p>
          <h1 className={s.pageTitle}>{user?.name.match(/^(dr|prof)\.?\s/i) ? user.name : firstName}</h1>
          <p className={s.subtitle}>Here&apos;s where your questions stand. New questions wait for a colleague&apos;s approval.</p>
        </div>
        <Link href="/instructor/questions/new" className={s.button}>
          <Icon name="plus" size={16} />
          Post a question
        </Link>
      </div>

      <div className={s.stats}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`${s.stat} ${filter === f.key ? s.statActive : ""}`}
            onClick={() => choose(f.key)}
            aria-pressed={filter === f.key}
          >
            <span className={s.statTop}>
              {f.label}
              <span className={s.statIcon} data-tone={f.key}>
                <Icon name={f.icon} size={16} />
              </span>
            </span>
            {counts ? (
              <span className={s.statValue}>{counts[f.key]}</span>
            ) : (
              <span className={`${s.skeleton} ${s.statValue}`} style={{ width: 40, height: 30 }} />
            )}
          </button>
        ))}
      </div>

      <section className={s.panel} aria-labelledby="list-title">
        <div className={s.panelHead}>
          <h2 id="list-title" className={s.sectionTitle} style={{ margin: 0 }}>
            {filter === "ALL" ? "Your questions" : FILTERS.find((f) => f.key === filter)!.label}
            {list && <span className={s.tabCount}> · {list.total}</span>}
          </h2>
          {filter !== "ALL" && (
            <button type="button" className={`${s.button} ${s.quiet} ${s.small}`} onClick={() => choose("ALL")}>
              <Icon name="x" size={14} />
              Show all
            </button>
          )}
        </div>

        {error && (
          <div style={{ padding: "16px 20px 0" }}>
            <div className={s.error} role="alert">
              <Icon name="alert" size={18} />
              {error}
            </div>
          </div>
        )}

        {!list && !error && <ListSkeleton />}

        {list && list.items.length === 0 && (
          <div className={s.empty}>
            <div className={s.emptyIcon}>
              <Icon name={FILTERS.find((f) => f.key === filter)!.icon} size={24} />
            </div>
            <h3>{EMPTY[filter].title}</h3>
            <p>{EMPTY[filter].body}</p>
            {(filter === "ALL" || filter === "PENDING") && (
              <Link href="/instructor/questions/new" className={s.button}>
                <Icon name="plus" size={16} />
                Post a question
              </Link>
            )}
          </div>
        )}

        {list && list.items.length > 0 && (
          <ul className={s.questionList}>
            {list.items.map((q) => (
              <li key={q.id} className={s.questionItem}>
                <div style={{ minWidth: 0 }}>
                  <div className={s.questionPath}>
                    <span>{q.curriculum.name}</span>
                    <Icon name="chevronRight" size={12} />
                    <span>{q.chapter.title}</span>
                  </div>
                  <p className={s.questionText}>{q.content}</p>
                </div>
                <span className={`${s.badge} ${s[q.status]}`}>{STATUS_LABEL[q.status] ?? q.status}</span>
                <div className={s.questionMeta}>
                  <span className={s.metaItem} title={`Difficulty ${q.difficulty} of 5`}>
                    <span className={s.dots} aria-hidden>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <i key={n} data-on={n <= q.difficulty ? "" : undefined} />
                      ))}
                    </span>
                    {DIFFICULTY[q.difficulty - 1]}
                  </span>
                  <span className={s.metaItem}>
                    <Icon name="clock" size={14} />
                    {q.estimatedTimeMinutes} min
                  </span>
                  <span className={s.metaItem}>
                    <Icon name={q.visibility === "SHARED" ? "users" : "lock"} size={14} />
                    {q.visibility === "SHARED" ? "Shared" : "Private"}
                  </span>
                  {q.source === "AI" && (
                    <span className={`${s.badge} ${s.plain} ${s.aiBadge}`}>
                      <Icon name="sparkles" size={12} />
                      AI-generated
                    </span>
                  )}
                  <span style={{ marginLeft: "auto" }}>Posted {ago(q.createdAt)}</span>
                </div>
                {q.status === "REJECTED" && q.rejectionReason && (
                  <div className={s.rejection}>
                    <Icon name="alert" size={16} />
                    <div>
                      <strong>
                        Rejected{q.rejectedBy ? ` by ${q.rejectedBy.name}` : ""}
                        {q.rejectedAt ? ` ${ago(q.rejectedAt)}` : ""}:
                      </strong>{" "}
                      {q.rejectionReason}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {list && list.total > PAGE_SIZE && (
          <div className={s.pager}>
            <span>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, list.total)} of {list.total}
            </span>
            <div className={s.pagerButtons}>
              <button
                type="button"
                className={`${s.button} ${s.quiet} ${s.small}`}
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
              >
                <Icon name="chevronLeft" size={16} />
                Previous
              </button>
              <button
                type="button"
                className={`${s.button} ${s.quiet} ${s.small}`}
                onClick={() => setPage(page + 1)}
                disabled={page >= pages}
              >
                Next
                <Icon name="chevronRight" size={16} />
              </button>
            </div>
          </div>
        )}
      </section>
    </>
  );
}

function ListSkeleton() {
  return (
    <ul className={s.questionList} aria-busy="true" aria-label="Loading questions">
      {[0, 1, 2].map((i) => (
        <li key={i} className={s.questionItem}>
          <div>
            <div className={s.skeleton} style={{ width: 160, height: 12, marginBottom: 10 }} />
            <div className={s.skeleton} style={{ width: "80%", height: 16 }} />
          </div>
          <div className={s.skeleton} style={{ width: 90, height: 22, borderRadius: 999 }} />
          <div className={s.questionMeta}>
            <div className={s.skeleton} style={{ width: 220, height: 12 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
