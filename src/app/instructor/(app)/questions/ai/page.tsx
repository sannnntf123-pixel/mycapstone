"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { notifyReviewChanged } from "@/lib/client/events";
import { useSession } from "@/lib/client/session";
import { describeError, DIFFICULTY_LABELS, type Curriculum } from "@/lib/client/types";
import { PostModeSwitch } from "../../../_components/PostModeSwitch";
import s from "../../../instructor.module.css";

type Status = { mode: "live" | "fake" | "off"; model: string | null; perHour: number };
type Kind = "written" | "multiple_choice" | "mixed";
type Draft = {
  content: string;
  options: string[] | null;
  answer: string;
  difficulty: number;
  estimatedTimeMinutes: number;
  explanation: string;
};
type Generation = { generationId: string; mode: string; model: string; drafts: Draft[]; notes: string[] };
type Editable = Draft & { keep: boolean; minutes: string };

const COUNTS = [1, 3, 5, 10];
const KINDS: { value: Kind; title: string; meta: string; icon: "pencil" | "checkCircle" | "layers" }[] = [
  { value: "mixed", title: "Mixed", meta: "Some written, some multiple choice", icon: "layers" },
  { value: "written", title: "Written answer", meta: "Students write the solution", icon: "pencil" },
  { value: "multiple_choice", title: "Multiple choice", meta: "Students pick one option", icon: "checkCircle" },
];

// Mirrors the API's rules so problems show before submitting.
function problemWith(d: Editable): string | null {
  if (!d.content.trim()) return "Write the question.";
  const m = Number(d.minutes);
  if (!Number.isInteger(m) || m < 1 || m > 600) return "Solving time must be 1–600 minutes.";
  if (d.options) {
    const opts = d.options.map((o) => o.trim());
    if (opts.some((o) => !o)) return "Fill in or remove the empty option.";
    if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) return "Options must be different.";
    if (!opts.includes(d.answer.trim())) return "Mark the correct option.";
  } else if (!d.answer.trim()) return "Write the answer.";
  return null;
}

export default function GenerateWithAiPage() {
  const { api } = useSession();
  const [status, setStatus] = useState<Status | null>(null);
  const [curricula, setCurricula] = useState<Curriculum[] | null>(null);
  const [query, setQuery] = useState("");
  const [curriculumId, setCurriculumId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<number | null>(3);
  const [kind, setKind] = useState<Kind>("mixed");
  const [focus, setFocus] = useState("");
  const [visibility, setVisibility] = useState<"PRIVATE" | "SHARED">("SHARED");
  const [generating, setGenerating] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [generation, setGeneration] = useState<Generation | null>(null);
  const [drafts, setDrafts] = useState<Editable[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ count: number; visibility: string } | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<Status>("GET", "/questions/generate/status").then((r) => r.ok && setStatus(r.data));
    api<{ items: Curriculum[] }>("GET", "/curricula").then((r) => setCurricula(r.ok ? r.data.items : []));
  }, [api]);

  useEffect(() => {
    if (!generating) return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [generating]);

  const course = curricula?.find((c) => c.id === curriculumId);
  const q = query.trim().toLowerCase();
  const shownCourses = (curricula ?? []).filter((c) => !q || c.id === curriculumId || c.name.toLowerCase().includes(q));

  async function generate() {
    if (!curriculumId || !chapterId) return setError("Choose a course and a chapter.");
    setGenerating(true);
    setError("");
    setSubmitted(null);
    const res = await api<Generation>("POST", "/questions/generate", {
      body: { curriculumId, chapterId, count, difficulty, kind, ...(focus.trim() ? { focus: focus.trim() } : {}) },
    });
    setGenerating(false);
    if (!res.ok) return setError(describeError(res.data, res.status));
    setGeneration(res.data);
    setDrafts(res.data.drafts.map((d) => ({ ...d, keep: true, minutes: String(d.estimatedTimeMinutes) })));
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  const update = (i: number, patch: Partial<Editable>) => setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const kept = drafts.filter((d) => d.keep);
  const firstProblem = kept.map(problemWith).find(Boolean) ?? null;

  async function submit() {
    if (!generation || kept.length === 0) return;
    if (firstProblem) return setError(`Fix the drafts first: ${firstProblem}`);
    setSubmitting(true);
    setError("");
    const res = await api("POST", "/questions/generate/submit", {
      body: {
        generationId: generation.generationId,
        visibility,
        questions: kept.map((d) => ({
          content: d.content.trim(),
          options: d.options ? d.options.map((o) => o.trim()) : null,
          answer: d.answer.trim(),
          difficulty: d.difficulty,
          estimatedTimeMinutes: Number(d.minutes),
        })),
      },
    });
    setSubmitting(false);
    if (!res.ok) return setError(describeError(res.data, res.status));
    setSubmitted({ count: kept.length, visibility });
    setGeneration(null);
    setDrafts([]);
    notifyReviewChanged();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const head = (
    <div className={s.pageHead}>
      <div>
        <h1 className={s.pageTitle}>Post a question</h1>
        <p className={s.subtitle}>
          Let AI draft questions for a chapter. You edit and choose what to keep; every question is still reviewed.
        </p>
      </div>
      <PostModeSwitch active="ai" />
    </div>
  );

  if (status?.mode === "off") {
    return (
      <>
        {head}
        <div className={s.panel}>
          <div className={s.empty}>
            <div className={s.emptyIcon}>
              <Icon name="sparkles" size={24} />
            </div>
            <h3>AI generation isn&apos;t set up</h3>
            <p>
              An administrator needs to add an Anthropic API key (<code>ANTHROPIC_API_KEY</code>) to the server&apos;s settings.
              You can still write questions yourself.
            </p>
            <Link href="/instructor/questions/new" className={s.button}>
              <Icon name="pencil" size={16} />
              Write a question
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {head}

      {submitted && (
        <div className={`${s.notice} ${s.noticeOk}`} role="status">
          <Icon name="checkCircle" size={18} />
          <span>
            {submitted.count} question{submitted.count === 1 ? "" : "s"} submitted for review.{" "}
            {submitted.visibility === "SHARED" ? (
              `Another instructor will review ${submitted.count === 1 ? "it" : "them"}.`
            ) : (
              <>
                {submitted.count === 1 ? "It's private, so you review it" : "They're private, so you review them"} yourself on the{" "}
                <Link href="/instructor/review" className={s.linkButton}>
                  Review page
                </Link>
                .
              </>
            )}
          </span>
        </div>
      )}

      {status?.mode === "fake" && (
        <div className={s.aiBanner}>
          <Icon name="alert" size={18} />
          <span>
            <strong>Demo mode.</strong> The server is set to <code>AI_FAKE=true</code>, so you&apos;ll get sample drafts and no AI
            call is made. Add an API key and set <code>AI_FAKE=false</code> for real questions.
          </span>
        </div>
      )}

      <div className={s.card}>
        <section className={s.formBlock}>
          <div className={s.blockHead}>
            <h2 className={s.sectionTitle}>
              <span className={s.formSectionNum}>1</span>Course &amp; chapter
            </h2>
          </div>
          {curricula && curricula.length > 6 && (
            <div className={s.searchWrap}>
              <Icon name="search" size={16} />
              <input
                className={s.input}
                type="search"
                placeholder={`Search ${curricula.length} courses`}
                aria-label="Search courses"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          )}
          {!curricula && <div className={s.skeleton} style={{ height: 72 }} />}
          <div className={s.choices}>
            {shownCourses.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`${s.choice} ${curriculumId === c.id ? s.choiceSelected : ""}`}
                aria-pressed={curriculumId === c.id}
                onClick={() => {
                  setCurriculumId(c.id);
                  setChapterId("");
                }}
              >
                <span className={s.choiceTitle}>{c.name}</span>
                <span className={s.choiceMeta}>
                  {c.chapters.length} chapter{c.chapters.length === 1 ? "" : "s"}
                </span>
              </button>
            ))}
          </div>
          {course && (
            <>
              <div className={s.spacer} style={{ height: 18 }} />
              <p className={s.label}>Chapter</p>
              {course.chapters.length === 0 ? (
                <p className={s.help}>This course has no chapters yet. Add one from the Write it yourself tab.</p>
              ) : (
                <div className={s.choices}>
                  {course.chapters.map((ch) => (
                    <button
                      key={ch.id}
                      type="button"
                      className={`${s.choice} ${chapterId === ch.id ? s.choiceSelected : ""}`}
                      aria-pressed={chapterId === ch.id}
                      onClick={() => setChapterId(ch.id)}
                    >
                      <span className={s.choiceMeta}>Chapter {ch.orderIndex}</span>
                      <span className={s.choiceTitle}>{ch.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <section className={s.formBlock}>
          <div className={s.blockHead}>
            <h2 className={s.sectionTitle}>
              <span className={s.formSectionNum}>2</span>What to write
            </h2>
          </div>
          <div className={s.field}>
            <span className={s.label}>How many questions</span>
            <div className={s.countRow}>
              {COUNTS.map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`${s.chip} ${count === n ? s.choiceSelected : ""}`}
                  aria-pressed={count === n}
                  onClick={() => setCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className={s.field}>
            <span className={s.label}>Difficulty</span>
            <div className={`${s.segments} ${s.segmentsSix}`}>
              {[
                ...DIFFICULTY_LABELS.map((label, i) => ({ value: (i + 1) as number | null, label })),
                { value: null, label: "Mixed" },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  className={`${s.segment} ${difficulty === opt.value ? s.choiceSelected : ""}`}
                  aria-pressed={difficulty === opt.value}
                  onClick={() => setDifficulty(opt.value)}
                >
                  <span className={s.segmentBars} aria-hidden>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <i
                        key={n}
                        style={{ height: 6 + n * 2.4 }}
                        data-on={opt.value === null || n <= opt.value ? "" : undefined}
                      />
                    ))}
                  </span>
                  <span className={s.segmentLabel}>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={s.field}>
            <span className={s.label}>Question type</span>
            <div className={s.choices}>
              {KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  className={`${s.choice} ${kind === k.value ? s.choiceSelected : ""}`}
                  aria-pressed={kind === k.value}
                  onClick={() => setKind(k.value)}
                >
                  <span className={s.choiceIcon}>
                    <Icon name={k.icon} size={18} />
                  </span>
                  <span className={s.choiceTitle}>{k.title}</span>
                  <span className={s.choiceMeta}>{k.meta}</span>
                </button>
              ))}
            </div>
          </div>
          <div className={s.field} style={{ marginBottom: 0 }}>
            <label className={s.label} htmlFor="focus">
              Focus <span className={s.optional}>(optional)</span>
            </label>
            <input
              id="focus"
              className={s.input}
              maxLength={300}
              placeholder="e.g. chain rule with trigonometric functions"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
            />
            <p className={s.hint}>
              Leave empty to cover the whole chapter. A few approved questions from this chapter are shown to the AI as examples
              (never other instructors&apos; private ones).
            </p>
          </div>
        </section>

        {error && !generation && (
          <div className={s.error} role="alert" style={{ marginTop: 20 }}>
            <Icon name="alert" size={18} />
            {error}
          </div>
        )}

        <div className={s.actions}>
          <span className={s.actionsMeta}>{status ? `Up to ${status.perHour} generations per hour.` : ""}</span>
          <button type="button" className={s.button} onClick={generate} disabled={generating || !chapterId}>
            <Icon name="sparkles" size={16} />
            {generating ? "Writing…" : generation ? "Generate again" : `Generate ${count} draft${count === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>

      <div ref={resultsRef} style={{ scrollMarginTop: 80 }} />

      {generating && (
        <div className={s.panel} style={{ marginTop: 24 }} role="status" aria-live="polite">
          <div className={s.writing}>
            <div className={s.writingDots} aria-hidden>
              <i />
              <i />
              <i />
            </div>
            <h3 className={s.sectionTitle}>
              Writing {count} question{count === 1 ? "" : "s"}…
            </h3>
            <p className={s.help} style={{ margin: 0 }}>
              {elapsed < 20
                ? "This usually takes under a minute."
                : `${elapsed} seconds so far. Longer batches take a bit more time.`}
            </p>
          </div>
        </div>
      )}

      {generation && !generating && (
        <section style={{ marginTop: 32 }} aria-labelledby="drafts-title">
          <div className={s.pageHead} style={{ marginBottom: 16 }}>
            <div>
              <h2 id="drafts-title" className={s.stepTitle}>
                Review the drafts
              </h2>
              <p className={s.subtitle}>
                Edit anything that needs it and untick the ones you don&apos;t want. Nothing is saved until you submit.
              </p>
            </div>
          </div>

          {generation.notes.length > 0 && (
            <div className={s.notice}>
              <Icon name="alert" size={18} />
              <ul className={s.noticeList}>
                {generation.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          )}

          {drafts.length === 0 ? (
            <div className={s.panel}>
              <div className={s.empty}>
                <h3>No usable drafts</h3>
                <p>Try again, or change the difficulty, type or focus.</p>
              </div>
            </div>
          ) : (
            <ol className={s.draftList}>
              {drafts.map((d, i) => (
                <DraftEditor key={i} index={i} draft={d} onChange={(patch) => update(i, patch)} />
              ))}
            </ol>
          )}

          {drafts.length > 0 && (
            <div className={s.submitBar}>
              <div style={{ display: "grid", gap: 6 }}>
                <span>
                  <strong>{kept.length}</strong> of {drafts.length} selected
                </span>
                <span className={s.metaItem} style={{ fontSize: 13, color: "var(--muted)" }}>
                  Save as
                  <select
                    className={s.select}
                    style={{ minHeight: 32, padding: "4px 30px 4px 10px", width: "auto", fontSize: 13 }}
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as "PRIVATE" | "SHARED")}
                    aria-label="Visibility of the submitted questions"
                  >
                    <option value="SHARED">Shared (a colleague reviews)</option>
                    <option value="PRIVATE">Private (you review)</option>
                  </select>
                </span>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                {error && (
                  <span className={s.fieldError} role="alert" style={{ margin: 0 }}>
                    {error}
                  </span>
                )}
                <button className={s.button} onClick={submit} disabled={submitting || kept.length === 0}>
                  <Icon name="check" size={16} />
                  {submitting ? "Submitting…" : `Submit ${kept.length} for review`}
                </button>
              </div>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function DraftEditor({
  index,
  draft,
  onChange,
}: {
  index: number;
  draft: Editable;
  onChange: (patch: Partial<Editable>) => void;
}) {
  const problem = draft.keep ? problemWith(draft) : null;
  const id = `draft-${index}`;
  const setOption = (j: number, value: string) => {
    const options = draft.options!.map((o, k) => (k === j ? value : o));
    // Keep the answer pointing at the same option while it's edited.
    const answer = draft.options![j] === draft.answer ? value : draft.answer;
    onChange({ options, answer });
  };

  return (
    <li className={`${s.draftCard} ${draft.keep ? "" : s.draftOff}`}>
      <div className={s.draftHead}>
        <label>
          <input
            type="checkbox"
            className={s.checkbox}
            checked={draft.keep}
            onChange={(e) => onChange({ keep: e.target.checked })}
          />
          Draft {index + 1}
          <span className={`${s.badge} ${s.plain}`}>{draft.options ? "Multiple choice" : "Written"}</span>
        </label>
        {!draft.keep && <span className={s.optional}>Won&apos;t be submitted</span>}
        {problem && (
          <span className={s.fieldError} style={{ margin: 0 }}>
            {problem}
          </span>
        )}
      </div>
      <div className={s.draftBody}>
        <div className={s.field}>
          <label className={s.label} htmlFor={`${id}-q`}>
            Question
          </label>
          <textarea
            id={`${id}-q`}
            className={s.textarea}
            style={{ minHeight: 90 }}
            value={draft.content}
            onChange={(e) => onChange({ content: e.target.value })}
          />
        </div>

        {draft.options ? (
          <div className={s.field}>
            <span className={s.label}>Options</span>
            {draft.options.map((opt, j) => {
              const letter = String.fromCharCode(65 + j);
              const correct = opt === draft.answer;
              return (
                <div key={j} className={`${s.optionRow} ${correct ? s.optionCorrect : ""}`}>
                  <span className={s.optionLetter} aria-hidden>
                    {letter}
                  </span>
                  <input
                    className={s.input}
                    value={opt}
                    aria-label={`Option ${letter}`}
                    onChange={(e) => setOption(j, e.target.value)}
                  />
                  <label className={`${s.correctToggle} ${correct ? s.correctOn : ""}`}>
                    <input
                      type="radio"
                      name={`${id}-correct`}
                      checked={correct}
                      onChange={() => onChange({ answer: opt })}
                      aria-label={`Option ${letter} is correct`}
                    />
                    <Icon name={correct ? "checkCircle" : "check"} size={14} />
                    {correct ? "Correct" : "Mark correct"}
                  </label>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={s.field}>
            <label className={s.label} htmlFor={`${id}-a`}>
              Answer / model solution
            </label>
            <textarea
              id={`${id}-a`}
              className={s.textarea}
              style={{ minHeight: 70 }}
              value={draft.answer}
              onChange={(e) => onChange({ answer: e.target.value })}
            />
          </div>
        )}

        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label} htmlFor={`${id}-d`}>
              Difficulty
            </label>
            <select
              id={`${id}-d`}
              className={s.select}
              value={draft.difficulty}
              onChange={(e) => onChange({ difficulty: Number(e.target.value) })}
            >
              {DIFFICULTY_LABELS.map((l, k) => (
                <option key={l} value={k + 1}>
                  {k + 1} · {l}
                </option>
              ))}
            </select>
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor={`${id}-m`}>
              Solving time
            </label>
            <div className={s.minutesField}>
              <input
                id={`${id}-m`}
                className={s.input}
                type="number"
                min={1}
                max={600}
                inputMode="numeric"
                value={draft.minutes}
                onChange={(e) => onChange({ minutes: e.target.value })}
              />
              <span className={s.optional}>minutes</span>
            </div>
          </div>
        </div>

        {draft.explanation && (
          <p className={s.draftWhy}>
            <Icon name="sparkles" size={14} />
            <span>
              <strong>AI note:</strong> {draft.explanation}
            </span>
          </p>
        )}
      </div>
    </li>
  );
}
