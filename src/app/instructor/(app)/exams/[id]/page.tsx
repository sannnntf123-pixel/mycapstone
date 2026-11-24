"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useSession } from "@/lib/client/session";
import { describeError, DIFFICULTY_LABELS, difficultyLabel, type Exam, type ExamQuestion } from "@/lib/client/types";
import s from "../../../instructor.module.css";

// Distinguishable in light and dark themes.
const CHAPTER_COLORS = ["var(--accent)", "#14b8a6", "#f59e0b", "#a855f7", "#ec4899", "#64748b", "#22c55e", "#0ea5e9"];

type Picker = { mode: "swap"; questionId: string } | { mode: "add" };
type Alternatives = { roomMinutes: number; items: (ExamQuestion & { fitsTime: boolean })[] };

export default function ExamPage() {
  const { id } = useParams<{ id: string }>();
  const { api } = useSession();
  const router = useRouter();
  const [exam, setExam] = useState<Exam | null>(null);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAnswers, setShowAnswers] = useState(true);
  const [title, setTitle] = useState("");
  const [picker, setPicker] = useState<Picker | null>(null);
  const [alts, setAlts] = useState<Alternatives | null>(null);

  const load = useCallback(async () => {
    const res = await api<Exam>("GET", `/exams/${id}`);
    if (res.ok) {
      setExam(res.data);
      setTitle(res.data.title);
    } else if (res.status === 404) setNotFound(true);
    else setError(describeError(res.data, res.status));
  }, [api, id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!picker) return setAlts(null);
    setAlts(null);
    const qs = picker.mode === "swap" ? `?replace=${picker.questionId}` : "";
    api<Alternatives>("GET", `/exams/${id}/alternatives${qs}`).then((r) => r.ok && setAlts(r.data));
  }, [api, id, picker]);

  async function run(label: string, method: string, path: string, body?: unknown) {
    setBusy(label);
    setError("");
    const res = await api<Exam>(method, path, body ? { body } : undefined);
    setBusy(null);
    if (res.ok) {
      setExam(res.data);
      setTitle(res.data.title);
      return true;
    }
    setError(describeError(res.data, res.status));
    return false;
  }

  const setQuestions = (ids: string[]) => run("edit", "PATCH", `/exams/${id}`, { questionIds: ids });

  if (notFound) {
    return (
      <div className={s.panel}>
        <div className={s.empty}>
          <div className={s.emptyIcon}>
            <Icon name="file" size={24} />
          </div>
          <h3>Exam not found</h3>
          <p>It may have been deleted, or it belongs to another instructor.</p>
          <Link href="/instructor/exams" className={s.button}>
            Back to exams
          </Link>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <>
        <div className={s.skeleton} style={{ width: 280, height: 34, marginBottom: 12 }} />
        <div className={s.skeleton} style={{ width: 420, height: 16, marginBottom: 28 }} />
        <div className={s.skeleton} style={{ height: 320, borderRadius: 16 }} />
      </>
    );
  }

  const draft = exam.status === "DRAFT";
  const ids = exam.questions.map((q) => q.id);
  const over = exam.totalMinutes - exam.durationMinutes;
  const fill = exam.totalMinutes / exam.durationMinutes;
  const avg = exam.questions.length ? exam.questions.reduce((n, q) => n + q.difficulty, 0) / exam.questions.length : 0;
  const colorOf = (chapterId: string) => CHAPTER_COLORS[exam.chapters.findIndex((c) => c.id === chapterId) % CHAPTER_COLORS.length];
  const mix = exam.chapters.map((c) => ({
    ...c,
    minutes: exam.questions.filter((q) => q.chapter.id === c.id).reduce((n, q) => n + q.estimatedTimeMinutes, 0),
    count: exam.questions.filter((q) => q.chapter.id === c.id).length,
  }));

  function move(index: number, delta: number) {
    const next = [...ids];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setQuestions(next);
  }

  async function saveTitle() {
    const t = title.trim();
    if (!t) return setTitle(exam!.title);
    if (t !== exam!.title) await run("title", "PATCH", `/exams/${id}`, { title: t });
  }

  async function finalize() {
    if (!confirm("Finalize this exam? It will be locked, and its questions will be counted as used.")) return;
    await run("finalize", "POST", `/exams/${id}/finalize`);
  }

  async function regenerate() {
    if (!confirm("Replace every question with a new selection using the same settings?")) return;
    setPicker(null);
    await run("regenerate", "POST", `/exams/${id}/regenerate`);
  }

  async function remove() {
    if (!confirm(`Delete “${exam!.title}”? This can't be undone.`)) return;
    setBusy("delete");
    const res = await api("DELETE", `/exams/${id}`);
    if (res.ok) router.replace("/instructor/exams");
    else {
      setBusy(null);
      setError(describeError(res.data, res.status));
    }
  }

  async function pick(questionId: string) {
    const next = picker?.mode === "swap" ? ids.map((x) => (x === picker.questionId ? questionId : x)) : [...ids, questionId];
    if (await setQuestions(next)) setPicker(null);
  }

  return (
    <>
      <div className={s.pageHead}>
        <div style={{ flex: "1 1 420px", minWidth: 0 }}>
          <p className={s.eyebrow}>
            <Link href="/instructor/exams" className={s.linkButton} style={{ fontWeight: 500 }}>
              <Icon name="arrowLeft" size={14} />
              Exams
            </Link>
          </p>
          {draft ? (
            <input
              className={s.titleInput}
              value={title}
              aria-label="Exam title"
              maxLength={150}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
            />
          ) : (
            <h1 className={s.pageTitle}>{exam.title}</h1>
          )}
          <p className={s.subtitle} style={{ display: "flex", flexWrap: "wrap", gap: "6px 10px", alignItems: "center", marginTop: 6 }}>
            <span className={`${s.badge} ${s[exam.status]}`}>{draft ? "Draft" : "Final"}</span>
            {exam.curriculum.name} · {exam.chapters.length} chapter{exam.chapters.length === 1 ? "" : "s"} · {difficultyLabel(exam.targetDifficulty)} ·{" "}
            {exam.durationMinutes} min
          </p>
        </div>
        <div className={s.headActions}>
          {draft && (
            <button className={`${s.button} ${s.quiet}`} onClick={regenerate} disabled={!!busy}>
              <Icon name="refresh" size={16} />
              {busy === "regenerate" ? "Regenerating…" : "Regenerate"}
            </button>
          )}
          <Link href={`/instructor/exams/${id}/print`} className={`${s.button} ${s.quiet}`}>
            <Icon name="printer" size={16} />
            Print
          </Link>
          {draft && (
            <button className={s.button} onClick={finalize} disabled={!!busy || exam.questions.length === 0}>
              <Icon name="check" size={16} />
              {busy === "finalize" ? "Finalizing…" : "Finalize"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className={s.error} role="alert">
          <Icon name="alert" size={18} />
          {error}
        </div>
      )}
      {exam.warnings.length > 0 && draft && (
        <div className={s.notice} role="status">
          <Icon name="alert" size={18} />
          <ul className={s.noticeList}>
            {exam.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {!draft && (
        <div className={`${s.notice} ${s.noticeOk}`}>
          <Icon name="checkCircle" size={18} />
          <span>
            Finalized {new Date(exam.finalizedAt!).toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" })}. This exam is
            locked and its questions were counted as used.
          </span>
        </div>
      )}

      <div className={s.examLayout}>
        <section className={s.panel} aria-labelledby="q-title">
          <div className={s.panelHead}>
            <h2 id="q-title" className={s.sectionTitle} style={{ margin: 0 }}>
              Questions <span className={s.tabCount}>· {exam.questions.length}</span>
            </h2>
            <label className={s.metaItem} style={{ fontSize: 14, cursor: "pointer" }}>
              <input type="checkbox" className={s.checkbox} checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} />
              Show answers
            </label>
          </div>

          {exam.questions.length === 0 && (
            <div className={s.empty}>
              <div className={s.emptyIcon}>
                <Icon name="inbox" size={24} />
              </div>
              <h3>No questions in this exam</h3>
              <p>{draft ? "Add questions from the bank, or regenerate with the same settings." : "This exam has no questions."}</p>
            </div>
          )}

          <ol style={{ listStyle: "none" }}>
            {exam.questions.map((q, i) => (
              <li key={q.id}>
                <div className={s.examQ}>
                  <span className={s.qNum}>{i + 1}</span>
                  <div className={s.qBody}>
                    <div className={s.questionPath}>
                      <i style={{ width: 8, height: 8, borderRadius: 2, background: colorOf(q.chapter.id), flexShrink: 0 }} />
                      <span>
                        Chapter {q.chapter.orderIndex}: {q.chapter.title}
                      </span>
                    </div>
                    <p className={s.qText}>{q.content}</p>
                    {q.options && (
                      <ol className={s.qOptions}>
                        {q.options.map((o, j) => (
                          <li key={j} className={showAnswers && o === q.answer ? s.correct : ""}>
                            <b>{String.fromCharCode(65 + j)}.</b> {o}
                            {showAnswers && o === q.answer && <Icon name="check" size={14} label="Correct answer" />}
                          </li>
                        ))}
                      </ol>
                    )}
                    {showAnswers && !q.options && (
                      <div className={s.qAnswer}>
                        <strong>Answer:</strong> {q.answer}
                      </div>
                    )}
                    <div className={s.questionMeta} style={{ marginTop: 0 }}>
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
                      <span className={s.metaItem}>By {q.createdBy.name}</span>
                      {q.approvedBy && (
                        <span className={s.approver}>
                          <Icon name="checkCircle" size={14} />
                          Approved by {q.approvedBy.name}
                        </span>
                      )}
                    </div>
                  </div>
                  {draft && (
                    <div className={s.qTools}>
                      <button className={s.iconButton} onClick={() => move(i, -1)} disabled={i === 0 || !!busy} aria-label={`Move question ${i + 1} up`}>
                        <Icon name="arrowUp" size={16} />
                      </button>
                      <button
                        className={s.iconButton}
                        onClick={() => move(i, 1)}
                        disabled={i === exam.questions.length - 1 || !!busy}
                        aria-label={`Move question ${i + 1} down`}
                      >
                        <Icon name="arrowDown" size={16} />
                      </button>
                      <button
                        className={s.iconButton}
                        onClick={() => setPicker(picker?.mode === "swap" && picker.questionId === q.id ? null : { mode: "swap", questionId: q.id })}
                        aria-label={`Swap question ${i + 1}`}
                        aria-expanded={picker?.mode === "swap" && picker.questionId === q.id}
                        disabled={!!busy}
                      >
                        <Icon name="swap" size={16} />
                      </button>
                      <button
                        className={`${s.iconButton} ${s.iconDanger}`}
                        onClick={() => setQuestions(ids.filter((x) => x !== q.id))}
                        aria-label={`Remove question ${i + 1}`}
                        disabled={!!busy}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </div>
                  )}
                </div>
                {picker?.mode === "swap" && picker.questionId === q.id && (
                  <PickerPanel alts={alts} title={`Replace question ${i + 1} with…`} onPick={pick} onClose={() => setPicker(null)} busy={!!busy} />
                )}
              </li>
            ))}
          </ol>

          {draft && (
            <>
              {picker?.mode === "add" ? (
                <PickerPanel alts={alts} title="Add a question" onPick={pick} onClose={() => setPicker(null)} busy={!!busy} />
              ) : (
                <div className={s.pager} style={{ justifyContent: "flex-start" }}>
                  <button className={s.linkButton} onClick={() => setPicker({ mode: "add" })}>
                    <Icon name="plus" size={16} />
                    Add a question from the bank
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <aside className={s.examAside}>
          <div className={s.summaryCard}>
            <h2>Summary</h2>
            <div className={s.meterLabel}>
              <span>Total time</span>
              <strong>
                {exam.totalMinutes} / {exam.durationMinutes} min
              </strong>
            </div>
            <div className={s.meterTrack}>
              <div
                className={s.meterFill}
                data-tone={over > 0 ? "bad" : fill >= 0.9 ? "ok" : "warn"}
                style={{ width: `${Math.min(100, fill * 100)}%` }}
              />
            </div>
            <p className={s.hint} style={over > 0 ? { color: "var(--bad)" } : undefined}>
              {over > 0
                ? `${over} min over the exam duration. Remove or swap a question.`
                : over === 0
                  ? "Exactly fills the exam."
                  : `${-over} min of slack.`}
            </p>

            <dl className={s.facts} style={{ marginTop: 16 }}>
              <div>
                <dt>Questions</dt>
                <dd>{exam.questions.length}</dd>
              </div>
              <div>
                <dt>Average difficulty</dt>
                <dd>{exam.questions.length ? `${avg.toFixed(1)} · ${DIFFICULTY_LABELS[Math.round(avg) - 1]}` : "—"}</dd>
              </div>
              <div>
                <dt>Multiple choice</dt>
                <dd>{exam.questions.filter((q) => q.options).length}</dd>
              </div>
            </dl>
          </div>

          <div className={s.summaryCard}>
            <h2>Chapter coverage</h2>
            <div className={s.mixBar} role="img" aria-label="Minutes per chapter">
              {mix
                .filter((c) => c.minutes > 0)
                .map((c) => (
                  <span key={c.id} style={{ width: `${(c.minutes / Math.max(1, exam.totalMinutes)) * 100}%`, background: colorOf(c.id) }} />
                ))}
            </div>
            <ul className={s.mixLegend}>
              {mix.map((c) => (
                <li key={c.id}>
                  <i style={{ background: colorOf(c.id) }} />
                  <span>{c.title}</span>
                  <span style={c.count === 0 ? { color: "var(--warn)" } : undefined}>
                    {c.count === 0 ? "none" : `${c.count} · ${c.minutes} min`}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {draft && (
            <button className={`${s.button} ${s.quiet} ${s.small}`} onClick={remove} disabled={!!busy} style={{ justifySelf: "start" }}>
              <Icon name="trash" size={14} />
              Delete draft
            </button>
          )}
        </aside>
      </div>
    </>
  );
}

function PickerPanel({
  alts,
  title,
  onPick,
  onClose,
  busy,
}: {
  alts: Alternatives | null;
  title: string;
  onPick: (id: string) => void;
  onClose: () => void;
  busy: boolean;
}) {
  return (
    <div className={s.picker}>
      <div className={s.pickerHead}>
        <strong>{title}</strong>
        <button className={s.iconButton} onClick={onClose} aria-label="Close">
          <Icon name="x" size={16} />
        </button>
      </div>
      {!alts ? (
        <div className={s.skeleton} style={{ height: 52 }} />
      ) : alts.items.length === 0 ? (
        <p className={s.help} style={{ margin: 0 }}>
          No other approved questions match this exam&apos;s chapters and difficulty.
        </p>
      ) : (
        <>
          <p className={s.hint} style={{ marginTop: 0, marginBottom: 10 }}>
            {alts.roomMinutes} min available. Best matches first.
          </p>
          <ul className={s.pickList}>
            {alts.items.map((q) => (
              <li key={q.id} className={s.pickItem}>
                <div>
                  <div className={s.pickText} title={q.content}>
                    {q.content}
                  </div>
                  <div className={s.questionMeta} style={{ marginTop: 2 }}>
                    <span>{q.chapter.title}</span>
                    <span>{DIFFICULTY_LABELS[q.difficulty - 1]}</span>
                    <span style={!q.fitsTime ? { color: "var(--bad)" } : undefined}>
                      {q.estimatedTimeMinutes} min{!q.fitsTime ? " · too long" : ""}
                    </span>
                    <span>{q.timesUsed > 0 ? `Used ${q.timesUsed}×` : "Never used"}</span>
                    {q.approvedBy && <span>Approved by {q.approvedBy.name}</span>}
                  </div>
                </div>
                <button className={`${s.button} ${s.ghost} ${s.small}`} onClick={() => onPick(q.id)} disabled={busy}>
                  Use
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
