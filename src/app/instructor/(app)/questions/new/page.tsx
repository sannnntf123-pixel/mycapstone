"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { PostModeSwitch } from "../../../_components/PostModeSwitch";
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

const STEPS = ["Course & chapter", "The question", "Difficulty & time", "Visibility", "Review"];
const STEP_INTRO = [
  { title: "Where does it belong?", help: "Choose the course and chapter this question is for." },
  { title: "Write the question", help: "Write it exactly as students will see it, then give the answer." },
  { title: "How hard is it?", help: "This helps colleagues balance an exam." },
  { title: "Who can see it?", help: "Shared questions are approved by another instructor in your major. Private ones you approve yourself, from the Review page." },
  { title: "Review and submit", help: "Check everything. You can jump back to any step." },
];
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
            <Icon name="check" size={30} />
          </div>
          <h1 className={s.pageTitle}>Question submitted</h1>
          <p className={s.subtitle}>
            It&apos;s now <span className={`${s.badge} ${s.PENDING}`}>Pending review</span>. {created.visibility === "SHARED"
              ? "It joins the question bank once another instructor in your major approves it."
              : "It's private, so you review it yourself: approve it from the Review page to add it to your bank."} We kept your course and chapter in case you&apos;re adding more.
          </p>
          <div className={s.center}>
            <button className={s.button} onClick={postAnother}>
              <Icon name="plus" size={16} />
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
      <div className={s.pageHead}>
        <div>
          <h1 className={s.pageTitle}>Post a question</h1>
          <p className={s.subtitle}>Every new question is reviewed before it enters the question bank.</p>
        </div>
        <PostModeSwitch active="manual" />
      </div>

      <div className={s.wizard}>
        <ol className={s.stepper} aria-label="Steps">
          {STEPS.map((label, i) => {
            const clickable = i !== step && i <= maxReachable;
            return (
              <li key={label}>
                <button
                  type="button"
                  className={`${s.step} ${i === step ? s.stepCurrent : ""} ${i < step ? s.stepDone : ""} ${clickable ? s.stepClickable : ""}`}
                  onClick={() => clickable && setStep(i)}
                  aria-current={i === step ? "step" : undefined}
                  disabled={!clickable && i !== step}
                >
                  <span className={s.stepDot}>{i < step ? <Icon name="check" size={14} /> : i + 1}</span>
                  {label}
                </button>
              </li>
            );
          })}
        </ol>

        <div className={s.card}>
          <div className={s.progressBar} aria-hidden>
            <div className={s.progressLabel}>
              <strong>{STEPS[step]}</strong>
              <span>
                Step {step + 1} of {STEPS.length}
              </span>
            </div>
            <div className={s.progressTrack}>
              <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
            </div>
            <div className={s.spacer} style={{ height: 20 }} />
          </div>

          <div className={s.stepHead}>
            <p className={s.stepKicker}>
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 className={s.stepTitle}>{STEP_INTRO[step].title}</h2>
            <p className={s.help} style={{ margin: 0 }}>
              {STEP_INTRO[step].help}
            </p>
          </div>

          {stepError && (
            <div className={s.error} role="alert">
              <Icon name="alert" size={18} />
              {stepError}
            </div>
          )}

          {step === 0 && <CurriculumStep draft={draft} update={update} curricula={curricula} reload={reload} />}
          {step === 1 && <ProblemStep draft={draft} update={update} />}
          {step === 2 && <DifficultyStep draft={draft} update={update} />}
          {step === 3 && <PrivacyStep draft={draft} update={update} />}
          {step === REVIEW && (
            <>
              {submitError && (
                <div className={s.error} role="alert">
                  <Icon name="alert" size={18} />
                  {submitError}
                </div>
              )}
              <div className={s.summary}>
                <Summary label="Course & chapter" onEdit={() => setStep(0)}>
                  {curriculum?.name} › Chapter {chapter?.orderIndex}: {chapter?.title}
                </Summary>
                <Summary label="The question" onEdit={() => setStep(1)}>
                  <div style={{ whiteSpace: "pre-wrap" }}>{draft.content.trim()}</div>
                  {draft.kind === "mcq" ? (
                    <ol className={s.optionList}>
                      {draft.options.map((o, i) => (
                        <li key={i} className={i === draft.correctIndex ? `${s.correct} ${s.optionCorrect}` : ""}>
                          <span className={s.optionLetter}>{String.fromCharCode(65 + i)}</span>
                          {o.trim()}
                          {i === draft.correctIndex && <Icon name="check" size={16} label="Correct answer" />}
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
                <Summary label="Visibility" onEdit={() => setStep(3)}>
                  {draft.visibility === "SHARED" ? "Shared with all instructors" : "Private (only you)"}
                </Summary>
              </div>
            </>
          )}

          <div className={s.actions}>
            {step > 0 ? (
              <button type="button" className={`${s.button} ${s.quiet}`} onClick={() => setStep(step - 1)}>
                <Icon name="arrowLeft" size={16} />
                Back
              </button>
            ) : (
              <Link href="/instructor" className={`${s.button} ${s.quiet}`}>
                Cancel
              </Link>
            )}
            {step < REVIEW ? (
              <button type="button" className={s.button} onClick={next}>
                {step === REVIEW - 1 ? "Review" : "Continue"}
                <Icon name="arrowRight" size={16} />
              </button>
            ) : (
              <button type="button" className={s.button} onClick={submit} disabled={submitting}>
                <Icon name="check" size={16} />
                {submitting ? "Submitting…" : "Submit for review"}
              </button>
            )}
          </div>
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
        <button type="button" className={s.linkButton} onClick={onEdit} aria-label={`Edit ${label.toLowerCase()}`}>
          <Icon name="pencil" size={14} />
          Edit
        </button>
      </div>
      {children}
    </div>
  );
}
