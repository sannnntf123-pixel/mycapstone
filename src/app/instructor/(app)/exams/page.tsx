"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { useSession } from "@/lib/client/session";
import { describeError, difficultyLabel, type ExamSummary } from "@/lib/client/types";
import s from "../../instructor.module.css";

type Filter = "ALL" | "DRAFT" | "FINAL";

export default function ExamsPage() {
  const { api } = useSession();
  const [exams, setExams] = useState<ExamSummary[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");

  useEffect(() => {
    api<{ items: ExamSummary[] }>("GET", "/exams").then((r) => (r.ok ? setExams(r.data.items) : setError(describeError(r.data, r.status))));
  }, [api]);

  const count = (f: Filter) => exams?.filter((e) => f === "ALL" || e.status === f).length ?? 0;
  const shown = exams?.filter((e) => filter === "ALL" || e.status === filter) ?? [];

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>Exams</h1>
          <p className={s.subtitle}>Exams you&apos;ve generated from the question bank. Drafts can still be edited; final exams are locked.</p>
        </div>
        <Link href="/instructor/exams/new" className={s.button}>
          <Icon name="sparkles" size={16} />
          Generate an exam
        </Link>
      </div>

      {exams && exams.length > 0 && (
        <div className={s.stats} style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          {(
            [
              ["ALL", "All exams", "file"],
              ["DRAFT", "Drafts", "pencil"],
              ["FINAL", "Final", "checkCircle"],
            ] as const
          ).map(([key, label, icon]) => (
            <button
              key={key}
              type="button"
              className={`${s.stat} ${filter === key ? s.statActive : ""}`}
              aria-pressed={filter === key}
              onClick={() => setFilter(key)}
            >
              <span className={s.statTop}>
                {label}
                <span className={s.statIcon}>
                  <Icon name={icon} size={16} />
                </span>
              </span>
              <span className={s.statValue}>{count(key)}</span>
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className={s.error} role="alert">
          <Icon name="alert" size={18} />
          {error}
        </div>
      )}

      <section className={s.panel}>
        {!exams && !error && (
          <div style={{ padding: 20, display: "grid", gap: 12 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className={s.skeleton} style={{ height: 44 }} />
            ))}
          </div>
        )}

        {exams && shown.length === 0 && (
          <div className={s.empty}>
            <div className={s.emptyIcon}>
              <Icon name="file" size={24} />
            </div>
            <h3>{exams.length === 0 ? "No exams yet" : `No ${filter === "DRAFT" ? "drafts" : "final exams"}`}</h3>
            <p>
              {exams.length === 0
                ? "Choose a course, chapters, difficulty and length, and we'll assemble an exam from approved questions."
                : "Try another filter."}
            </p>
            {exams.length === 0 && (
              <Link href="/instructor/exams/new" className={s.button}>
                <Icon name="sparkles" size={16} />
                Generate your first exam
              </Link>
            )}
          </div>
        )}

        {shown.map((e) => {
          const short = e.totalMinutes < e.durationMinutes * 0.9;
          return (
            <Link key={e.id} href={`/instructor/exams/${e.id}`} className={s.examRow}>
              <div style={{ minWidth: 0 }}>
                <div className={s.questionPath}>
                  <span>{e.curriculum.name}</span>
                </div>
                <div className={s.examRowTitle}>{e.title}</div>
              </div>
              <span className={`${s.badge} ${s[e.status]}`}>{e.status === "DRAFT" ? "Draft" : "Final"}</span>
              <div className={s.questionMeta}>
                <span className={s.metaItem}>
                  <Icon name="file" size={14} />
                  {e.questionCount} question{e.questionCount === 1 ? "" : "s"}
                </span>
                <span className={s.metaItem} style={short ? { color: "var(--warn)" } : undefined}>
                  <Icon name="clock" size={14} />
                  {e.totalMinutes} / {e.durationMinutes} min
                </span>
                <span className={s.metaItem}>{difficultyLabel(e.targetDifficulty)}</span>
                <span className={s.metaItem}>
                  {e.chapterCount} chapter{e.chapterCount === 1 ? "" : "s"}
                </span>
                <span style={{ marginLeft: "auto" }}>
                  {e.finalizedAt ? "Finalized " : "Created "}
                  {new Date(e.finalizedAt ?? e.createdAt).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            </Link>
          );
        })}
      </section>
    </>
  );
}
