"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/client/session";
import { describeError, type QuestionPage } from "@/lib/client/types";
import s from "../instructor.module.css";

const STATUS_LABEL: Record<string, string> = { PENDING: "Pending review", APPROVED: "Approved", REJECTED: "Rejected" };

export default function DashboardPage() {
  const { api, user } = useSession();
  const [mine, setMine] = useState<QuestionPage | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<QuestionPage>("GET", "/questions?mine=true&pageSize=10").then((res) => {
      if (res.ok) setMine(res.data);
      else setError(describeError(res.data, res.status));
    });
  }, [api]);

  return (
    <>
      <h1 className={s.pageTitle}>Welcome, {user?.name}</h1>
      <p className={s.subtitle}>Post questions to the bank. Every new question waits for an instructor&apos;s approval.</p>

      <div className={s.card}>
        <div className={s.summaryHead} style={{ alignItems: "center", marginBottom: 12 }}>
          <div>
            <h2 className={s.sectionTitle}>Your recent questions</h2>
            <p className={s.help} style={{ margin: 0 }}>
              {mine ? `${mine.total} question${mine.total === 1 ? "" : "s"} in total` : "Loading…"}
            </p>
          </div>
          <Link href="/instructor/questions/new" className={s.button}>
            + Post a question
          </Link>
        </div>

        {error && <div className={s.error}>{error}</div>}
        {mine && mine.items.length === 0 && <p className={s.empty}>You haven&apos;t posted any questions yet.</p>}

        <ul className={s.questionList}>
          {mine?.items.map((q) => (
            <li key={q.id} className={s.questionItem}>
              <p className={s.questionText}>{q.content}</p>
              <div className={s.questionMeta}>
                <span className={`${s.badge} ${s[q.status]}`}>{STATUS_LABEL[q.status] ?? q.status}</span>
                <span>
                  {q.curriculum.name} › {q.chapter.title}
                </span>
                <span>Difficulty {q.difficulty}/5</span>
                <span>{q.estimatedTimeMinutes} min</span>
                <span>{q.visibility === "SHARED" ? "Shared" : "Private"}</span>
                {q.source === "AI" && <span className={s.badge}>AI-generated</span>}
              </div>
              {q.status === "REJECTED" && q.rejectionReason && (
                <div className={s.rejection}>Reason: {q.rejectionReason}</div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
