"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "@/lib/client/session";
import { describeError, type Curriculum, type Question } from "@/lib/client/types";
import {
  CurriculumStep,
  DIFFICULTY_LABELS,
  DifficultyStep,
  PrivacyStep,
  ProblemStep,
  emptyDraft,
  validators,
  type Draft,
} from "./steps";
import s from "../../../instructor.module.css";

const STEPS = ["Curriculum & chapter", "Problem", "Difficulty & time", "Privacy", "Review"];
const REVIEW = STEPS.length - 1;

export default function NewQuestionPage() {
  const { api } = useSession();
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Question | null>(null);

  const reload = useCallback(async () => {
    const res = await api<{ items: Curriculum[] }>("GET", "/curricula");
    const items = res.ok ? res.data.items : [];
    setCurricula(items);
    return items;
  }, [api]);

  useEffect(() => {
    reload();
  }, [reload]);

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setStepError("");
  };

  // The furthest step the user may jump to: every earlier step must be valid.
  const firstInvalid = validators.findIndex((v) => v(draft) !== null);
  const maxReachable = firstInvalid === -1 ? REVIEW : firstInvalid;

  function next() {
    const problem = validators[step]?.(draft);
    if (problem) return setStepError(problem);
    setStep(step + 1);
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError("");
    const options = draft.options.map((o) => o.trim());
    const body = {
      curriculumId: draft.curriculumId,
      chapterId: draft.chapterId,
      content: draft.content.trim(),
      answer: draft.kind === "mcq" ? options[draft.correctIndex!] : draft.answer.trim(),
      ...(draft.kind === "mcq" ? { options } : {}),
      difficulty: draft.difficulty,
      estimatedTimeMinutes: Number(draft.minutes),
      visibility: draft.visibility,
    };
    const res = await api<Question>("POST", "/questions", { body });
    setSubmitting(false);
    if (res.ok) setCreated(res.data);
    else setSubmitError(describeError(res.data, res.status));
  }

  function postAnother() {
    // Keep the course and chapter: instructors usually add several questions to the same chapter.
    setDraft({ ...emptyDraft, curriculumId: draft.curriculumId, chapterId: draft.chapterId });
    setCreated(null);
    setStep(1);
  }

  if (created) {
    return (
      <div className={s.card}>
        <div className={s.success}>
          <div className={s.successIcon} aria-hidden>
            ✓
          </div>
          <h1 className={s.pageTitle}>Question submitted</h1>
          <p className={s.subtitle}>
            It is now <span className={`${s.badge} ${s.PENDING}`}>Pending review</span> and will join the question bank once an
            instructor approves it.
          </p>
          <div className={s.center}>
            <button className={s.button} onClick={postAnother}>
              Post another question
            </button>
            <Link href="/instructor" className={`${s.button} ${s.quiet}`}>
              Back to dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const curriculum = curricula.find((c) => c.id === draft.curriculumId);
  const chapter = curriculum?.chapters.find((c) => c.id === draft.chapterId);

  return (
    <>
      <h1 className={s.pageTitle}>Post a question</h1>
      <p className={s.subtitle}>New questions are reviewed by an instructor before they enter the question bank.</p>

      <nav className={s.stepper} aria-label="Steps">
        {STEPS.map((label, i) => {
          const clickable = i !== step && i <= maxReachable;
          return (
            <button
              key={label}
              type="button"
              className={`${s.step} ${i === step ? s.stepCurrent : ""} ${i < step ? s.stepDone : ""} ${clickable ? s.stepClickable : ""}`}
              onClick={() => clickable && setStep(i)}
              aria-current={i === step ? "step" : undefined}
              disabled={!clickable && i !== step}
            >
              <span className={s.stepDot}>{i < step ? "✓" : i + 1}</span>
              {label}
            </button>
          );
        })}
      </nav>

      <div className={s.card}>
        {stepError && (
          <div className={s.error} role="alert">
            {stepError}
          </div>
        )}

        {step === 0 && <CurriculumStep draft={draft} update={update} curricula={curricula} reload={reload} />}
        {step === 1 && <ProblemStep draft={draft} update={update} />}
        {step === 2 && <DifficultyStep draft={draft} update={update} />}
        {step === 3 && <PrivacyStep draft={draft} update={update} />}
        {step === REVIEW && (
          <>
            <h2 className={s.sectionTitle}>Review and submit</h2>
            <p className={s.help}>Check everything before submitting. You can jump back to any step.</p>
            {submitError && (
              <div className={s.error} role="alert">
                {submitError}
              </div>
            )}
            <div className={s.summary}>
              <Summary label="Curriculum & chapter" onEdit={() => setStep(0)}>
                {curriculum?.name} › Chapter {chapter?.orderIndex}: {chapter?.title}
              </Summary>
              <Summary label="Problem" onEdit={() => setStep(1)}>
                <div style={{ whiteSpace: "pre-wrap" }}>{draft.content.trim()}</div>
                {draft.kind === "mcq" ? (
                  <ol className={s.optionList} type="A">
                    {draft.options.map((o, i) => (
                      <li key={i} className={i === draft.correctIndex ? s.correct : ""}>
                        {o.trim()}
                        {i === draft.correctIndex ? "  ✓ correct" : ""}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div style={{ marginTop: 8 }}>
                    <span className={s.summaryLabel}>Answer</span>
                    <div style={{ whiteSpace: "pre-wrap" }}>{draft.answer.trim()}</div>
                  </div>
                )}
              </Summary>
              <Summary label="Difficulty & time" onEdit={() => setStep(2)}>
                {draft.difficulty} / 5 ({DIFFICULTY_LABELS[(draft.difficulty ?? 1) - 1]}) · {draft.minutes} minutes
              </Summary>
              <Summary label="Privacy" onEdit={() => setStep(3)}>
                {draft.visibility === "SHARED" ? "Shared with all instructors" : "Private (only you)"}
              </Summary>
            </div>
          </>
        )}

        <div className={s.actions}>
          {step > 0 ? (
            <button type="button" className={`${s.button} ${s.quiet}`} onClick={() => setStep(step - 1)}>
              ← Back
            </button>
          ) : (
            <Link href="/instructor" className={`${s.button} ${s.quiet}`}>
              Cancel
            </Link>
          )}
          {step < REVIEW ? (
            <button type="button" className={s.button} onClick={next}>
              Next →
            </button>
          ) : (
            <button type="button" className={s.button} onClick={submit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit question"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function Summary({ label, onEdit, children }: { label: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className={s.summarySection}>
      <div className={s.summaryHead}>
        <span className={s.summaryLabel}>{label}</span>
        <button type="button" className={s.linkButton} onClick={onEdit}>
          Edit
        </button>
      </div>
      {children}
    </div>
  );
}
