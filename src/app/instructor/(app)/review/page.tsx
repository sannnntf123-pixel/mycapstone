"use client";

import { useCallback, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { notifyReviewChanged } from "@/lib/client/events";
import { majorLabel } from "@/lib/majors";
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
  const [queue, setQueue] = useState<(QuestionPage & { major: string | null }) | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    const res = await api<QuestionPage & { major: string | null }>("GET", `/questions/review?pageSize=${PAGE_SIZE}&page=${page}`);
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
            Nothing enters the question bank until it&apos;s approved. You review shared questions from other instructors in your
            major
            {queue?.major ? ` (${majorLabel(queue.major)})` : ""}, your own private questions, and the AI questions you generated.
          </p>
        </div>
      </div>

      {queue && !queue.major && (
        <div className={s.notice}>
          <Icon name="alert" size={18} />
          <span>
            Your account has no major, so you can only review your own private questions. Shared questions are reviewed by
            instructors in the author&apos;s major.
          </span>
        </div>
      )}

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
            <p>No questions are waiting for your review. New shared questions from colleagues in your major will appear here.</p>
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
                <button
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
  // The reviewer can correct difficulty and solving time before approving.
  const [difficulty, setDifficulty] = useState(q.difficulty);
  const [minutes, setMinutes] = useState(String(q.estimatedTimeMinutes));
  const minutesNum = Number(minutes);
  const minutesValid = Number.isInteger(minutesNum) && minutesNum >= 1 && minutesNum <= 600;
  const changes = {
    ...(difficulty !== q.difficulty ? { difficulty } : {}),
    ...(minutesValid && minutesNum !== q.estimatedTimeMinutes ? { estimatedTimeMinutes: minutesNum } : {}),
  };
  const changed = Object.keys(changes).length > 0;

  async function decide(action: "approve" | "reject") {
    if (action === "reject" && !reason.trim()) return setError("Tell the author why, so they can fix it.");
    if (action === "approve" && !minutesValid) return setError("Solving time must be 1–600 minutes.");
    setBusy(true);
    setError("");
    const body = action === "reject" ? { reason: reason.trim() } : changed ? changes : undefined;
    const res = await api<Question>("POST", `/questions/${q.id}/${action}`, body ? { body } : undefined);
    setBusy(false);
    if (res.ok) {
      onDone(
        q,
        action === "reject"
          ? "Rejected. The author will see your reason."
          : changed
            ? "Approved with your changes. It's now in the question bank."
            : "Approved. It's now in the question bank.",
      );
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

        <div className={s.adjustRow}>
          <label className={s.adjustField}>
            <span>Difficulty</span>
            <select
              className={s.select}
              value={difficulty}
              onChange={(e) => setDifficulty(Number(e.target.value))}
              aria-label="Difficulty"
              disabled={busy}
            >
              {DIFFICULTY_LABELS.map((l, k) => (
                <option key={l} value={k + 1}>
                  {k + 1} · {l}
                </option>
              ))}
            </select>
          </label>
          <label className={s.adjustField}>
            <span>Solving time</span>
            <span className={s.minutesField}>
              <input
                className={s.input}
                type="number"
                min={1}
                max={600}
                inputMode="numeric"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                aria-label="Solving time in minutes"
                aria-invalid={!minutesValid}
                disabled={busy}
              />
              <span className={s.optional}>min</span>
            </span>
          </label>
          {changed ? (
            <span className={s.adjustNote}>
              <Icon name="pencil" size={14} />
              Changed from {DIFFICULTY_LABELS[q.difficulty - 1]}, {q.estimatedTimeMinutes} min.{" "}
              <button
                type="button"
                className={s.linkButton}
                onClick={() => {
                  setDifficulty(q.difficulty);
                  setMinutes(String(q.estimatedTimeMinutes));
                }}
              >
                Undo
              </button>
            </span>
          ) : (
            <span className={s.adjustNote} style={{ color: "var(--muted)" }}>
              Adjust these before approving if needed.
            </span>
          )}
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
                {busy ? "Approving…" : changed ? "Approve with changes" : "Approve"}
              </button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}
