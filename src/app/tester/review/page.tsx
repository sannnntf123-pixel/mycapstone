"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Page, SignInNotice } from "../components";
import type { QuestionPage } from "@/lib/client/types";
import { useSession } from "@/lib/client/session";
import s from "../tester.module.css";

export default function ReviewPage() {
  const { api, token, user } = useSession();
  const [queue, setQueue] = useState<QuestionPage | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [done, setDone] = useState<string[]>([]);

  const load = useCallback(async () => {
    const res = await api<QuestionPage>("GET", "/questions?status=PENDING&pageSize=100");
    if (res.ok) setQueue(res.data);
  }, [api]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  async function review(id: string, action: "approve" | "reject") {
    const reason = reasons[id];
    const res = await api("POST", `/questions/${id}/${action}`, {
      body: action === "reject" && reason ? { reason } : undefined,
    });
    if (res.ok) {
      setDone((d) => [`${action === "approve" ? "Approved" : "Rejected"}: ${queue?.items.find((q) => q.id === id)?.content}`, ...d]);
      load();
    }
  }

  return (
    <Page>
      <SignInNotice />
      <section className={s.card}>
        <div className={s.row}>
          <h2 style={{ flex: 1 }}>Pending review queue</h2>
          <button className={`${s.button} ${s.secondary} ${s.small}`} onClick={load}>
            Reload
          </button>
        </div>
        <p className={s.hint}>
          GET /api/questions?status=PENDING: pending questions you can see (your own + shared). Approving records you as the
          approver with the current time.
        </p>
        {queue && queue.items.length === 0 && <p className={s.muted}>Nothing waiting for review.</p>}
        {queue?.items.map((q) => (
          <div key={q.id} className={s.logEntry}>
            <div className={s.row} style={{ marginBottom: 4 }}>
              <Badge value={q.visibility} />
              {q.source === "AI" && <Badge value="AI" />}
              <span className={s.muted}>
                {q.curriculum.name} / {q.chapter.title} · difficulty {q.difficulty} · {q.estimatedTimeMinutes} min · by{" "}
                {q.createdBy.name}
                {q.createdBy.id === user?.id ? " (you)" : ""}
              </span>
            </div>
            <div style={{ marginBottom: 4 }}>{q.content}</div>
            {q.options && <div className={s.muted}>Options: {q.options.join("  |  ")}</div>}
            <div className={s.muted} style={{ marginBottom: 8 }}>
              Answer: {q.answer}
            </div>
            <div className={s.row}>
              <input
                className={s.inlineInput}
                placeholder="Rejection reason (optional)"
                value={reasons[q.id] ?? ""}
                onChange={(e) => setReasons({ ...reasons, [q.id]: e.target.value })}
              />
              <button className={`${s.button} ${s.small}`} onClick={() => review(q.id, "approve")}>
                Approve
              </button>
              <button className={`${s.button} ${s.danger} ${s.small}`} onClick={() => review(q.id, "reject")}>
                Reject
              </button>
            </div>
          </div>
        ))}
      </section>

      {done.length > 0 && (
        <section className={s.card}>
          <h2>Reviewed this session</h2>
          {done.map((d, i) => (
            <div key={i} className={s.muted}>
              {d}
            </div>
          ))}
        </section>
      )}
    </Page>
  );
}
