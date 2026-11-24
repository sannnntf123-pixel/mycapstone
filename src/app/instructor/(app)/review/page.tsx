"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { notifyReviewChanged } from "@/lib/client/events";
import { useSession } from "@/lib/client/session";
import { describeError, DIFFICULTY_LABELS, type Question, type QuestionPage } from "@/lib/client/types";
import s from "../../instructor.module.css";

const PAGE_SIZE = 10;
const QUICK_REASONS = [
  "The wording is ambiguous.",
  "The answer is incorrect.",
  "Too easy for this course.",
  "Needs more detail or context.",
  "Duplicate of an existing question.",
];

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(iso: string) {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
  if (days === 0) return "today";
  if (Math.abs(days) < 30) return rtf.format(days, "day");
  return new Date(iso).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
}

export default function ReviewPage() {
  const { api, user } = useSession();
  const [page, setPage] = useState(1);
  const [queue, setQueue] = useState<QuestionPage | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    const res = await api<QuestionPage>("GET", `/questions/review?pageSize=${PAGE_SIZE}&page=${page}`);
    if (res.ok) {
      // A page emptied by reviewing: step back so the list isn't blank.
      if (res.data.items.length === 0 && page > 1) setPage(page - 1);
      else setQueue(res.data);
    } else setError(describeError(res.data, res.status));
  }, [api, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  function done(q: Question, message: string) {
    setQueue((cur) => (cur ? { ...cur, items: cur.items.filter((x) => x.id !== q.id), total: cur.total - 1 } : cur));
    setToast(message);
    notifyReviewChanged();
    // Refill the page from the server once the card has gone.
    setTimeout(load, 400);
  }

  const pages = queue ? Math.max(1, Math.ceil(queue.total / PAGE_SIZE)) : 1;

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>Review questions</h1>
          <p className={s.subtitle}>
            Nothing enters the question bank until it&apos;s approved. Shared questions are reviewed by another instructor; your private
            questions are reviewed by you.
          </p>
        </div>
      </div>

      {error && (
        <div className={s.error} role="alert">
          <Icon name="alert" size={18} />
          {error}
        </div>
      )}

      {!queue && !error && (
        <div className={s.reviewList}>
          {[0, 1].map((i) => (
            <div key={i} className={s.skeleton} style={{ height: 180, borderRadius: 16 }} />
          ))}
        </div>
      )}

      {queue && queue.items.length === 0 && (
        <div className={s.panel}>
          <div className={s.empty}>
            <div className={s.emptyIcon} style={{ background: "var(--ok-soft)", color: "var(--ok)" }}>
              <Icon name="checkCircle" size={24} />
            </div>
            <h3>You&apos;re all caught up</h3>
            <p>No questions are waiting for your review. New shared questions from colleagues will appear here.</p>
          </div>
        </div>
      )}

      {queue && queue.items.length > 0 && (
        <>
          <p className={s.help}>
            {queue.total} question{queue.total === 1 ? "" : "s"} waiting, oldest first.
          </p>
          <ul className={s.reviewList}>
            {queue.items.map((q) => (
              <ReviewCard key={q.id} q={q} mine={q.createdBy.id === user?.id} onDone={done} />
            ))}
          </ul>
          {queue.total > PAGE_SIZE && (
            <div className={s.pager} style={{ borderTop: "none", padding: "16px 0" }}>
              <span>
                Page {page} of {pages}
              </span>
              <div className={s.pagerButtons}>
                <button className={`${s.button} ${s.quiet} ${s.small}`} onClick={() => setPage(page - 1)} disabled={page <= 1}>
                  <Icon name="chevronLeft" size={16} />
                  Previous
                </button>
                <button className={`${s.button} ${s.quiet} ${s.small}`} onClick={() => setPage(page + 1)} disabled={page >= pages}>
                  Next
                  <Icon name="chevronRight" size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {toast && (
        <div className={s.toast} role="status">
          <Icon name="checkCircle" size={18} />
          {toast}
        </div>
      )}
    </>
  );
}

function ReviewCard({ q, mine, onDone }: { q: Question; mine: boolean; onDone: (q: Question, message: string) => void }) {
  const { api } = useSession();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function decide(action: "approve" | "reject") {
    if (action === "reject" && !reason.trim()) return setError("Tell the author why, so they can fix it.");
    setBusy(true);
    setError("");
    const res = await api<Question>("POST", `/questions/${q.id}/${action}`, action === "reject" ? { body: { reason: reason.trim() } } : undefined);
    setBusy(false);
    if (res.ok) {
      onDone(q, action === "approve" ? "Approved. It's now in the question bank." : "Rejected. The author will see your reason.");
    } else if (res.status === 409) {
      onDone(q, "Someone else already reviewed this question.");
    } else setError(describeError(res.data, res.status));
  }

  return (
    <li className={s.reviewCard}>
      <div className={s.reviewBody}>
        <div className={s.reviewTop}>
          <div className={s.questionPath} style={{ margin: 0 }}>
            <span>{q.curriculum.name}</span>
            <Icon name="chevronRight" size={12} />
            <span>
              Chapter {q.chapter.orderIndex}: {q.chapter.title}
            </span>
          </div>
          <div className={s.reviewTags}>
            {q.source === "AI" && (
              <span className={`${s.badge} ${s.plain} ${s.aiBadge}`}>
                <Icon name="sparkles" size={12} />
                AI-generated
              </span>
            )}
            <span className={`${s.badge} ${s.plain}`}>
              <Icon name={q.visibility === "SHARED" ? "users" : "lock"} size={12} />
              {q.visibility === "SHARED" ? "Shared" : "Private"}
            </span>
          </div>
        </div>

        <p className={s.reviewText}>{q.content}</p>

        {q.options ? (
          <ol className={s.qOptions}>
            {q.options.map((o, j) => (
              <li key={j} className={o === q.answer ? s.correct : ""}>
                <b>{String.fromCharCode(65 + j)}.</b> {o}
                {o === q.answer && <Icon name="check" size={14} label="Marked correct" />}
              </li>
            ))}
          </ol>
        ) : (
          <div className={s.qAnswer}>
            <strong>Answer:</strong> {q.answer}
          </div>
        )}

        <div className={s.questionMeta}>
          <span className={s.metaItem} title={`Difficulty ${q.difficulty} of 5`}>
            <span className={s.dots} aria-hidden>
              {[1, 2, 3, 4, 5].map((n) => (
                <i key={n} data-on={n <= q.difficulty ? "" : undefined} />
              ))}
            </span>
            {DIFFICULTY_LABELS[q.difficulty - 1]}
          </span>
          <span className={s.metaItem}>
            <Icon name="clock" size={14} />
            {q.estimatedTimeMinutes} min
          </span>
        </div>
      </div>

      {rejecting && (
        <div className={s.rejectForm}>
          <label className={s.label} htmlFor={`reason-${q.id}`}>
            Why are you rejecting it?
          </label>
          <div className={s.reasonChips}>
            {QUICK_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                className={`${s.chip} ${reason === r ? s.choiceSelected : ""}`}
                onClick={() => {
                  setReason(r);
                  setError("");
                }}
                aria-pressed={reason === r}
              >
                {r.replace(/\.$/, "")}
              </button>
            ))}
          </div>
          <textarea
            id={`reason-${q.id}`}
            className={s.textarea}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setError("");
            }}
            placeholder="Be specific: what should the author change?"
            autoFocus
          />
        </div>
      )}

      <div className={s.reviewFoot}>
        <span className={s.actionsMeta}>
          {mine ? (
            <>
              <Icon name="lock" size={14} />
              Your private question · posted {ago(q.createdAt)}
            </>
          ) : (
            <>
              By {q.createdBy.name} · posted {ago(q.createdAt)}
            </>
          )}
        </span>
        <div className={s.reviewActions}>
          {error && (
            <span className={s.fieldError} role="alert" style={{ margin: 0, alignSelf: "center" }}>
              {error}
            </span>
          )}
          {rejecting ? (
            <>
              <button
                className={`${s.button} ${s.quiet}`}
                onClick={() => {
                  setRejecting(false);
                  setError("");
                }}
                disabled={busy}
              >
                Cancel
              </button>
              <button className={`${s.button} ${s.danger}`} onClick={() => decide("reject")} disabled={busy}>
                <Icon name="x" size={16} />
                {busy ? "Rejecting…" : "Reject with reason"}
              </button>
            </>
          ) : (
            <>
              <button className={`${s.button} ${s.danger}`} onClick={() => setRejecting(true)} disabled={busy}>
                <Icon name="x" size={16} />
                Reject
              </button>
              <button className={s.button} onClick={() => decide("approve")} disabled={busy}>
                <Icon name="check" size={16} />
                {busy ? "Approving…" : "Approve"}
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
