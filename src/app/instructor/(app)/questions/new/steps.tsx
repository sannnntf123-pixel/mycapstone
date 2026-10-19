"use client";

import { useState } from "react";
import { useSession } from "@/lib/client/session";
import { describeError, type Curriculum } from "@/lib/client/types";
import s from "../../../instructor.module.css";

export type Draft = {
  curriculumId: string;
  chapterId: string;
  content: string;
  kind: "open" | "mcq";
  answer: string;
  options: string[];
  correctIndex: number | null;
  difficulty: number | null;
  minutes: string;
  visibility: "PRIVATE" | "SHARED" | null;
};

export const emptyDraft: Draft = {
  curriculumId: "",
  chapterId: "",
  content: "",
  kind: "open",
  answer: "",
  options: ["", ""],
  correctIndex: null,
  difficulty: null,
  minutes: "",
  visibility: null,
};

export const DIFFICULTY_LABELS = ["Very easy", "Easy", "Medium", "Hard", "Very hard"];

// Each validator mirrors the API's rules and returns the first problem, or null.
export const validators: ((d: Draft) => string | null)[] = [
  (d) => (!d.curriculumId ? "Choose a curriculum." : !d.chapterId ? "Choose a chapter." : null),
  (d) => {
    if (!d.content.trim()) return "Write the question.";
    if (d.kind === "open") return d.answer.trim() ? null : "Write the answer or model solution.";
    const opts = d.options.map((o) => o.trim());
    if (opts.length < 2) return "Add at least two options.";
    if (opts.some((o) => !o)) return "Fill in or remove the empty option.";
    if (new Set(opts.map((o) => o.toLowerCase())).size !== opts.length) return "Options must be different from each other.";
    return d.correctIndex === null ? "Mark which option is correct." : null;
  },
  (d) => {
    if (!d.difficulty) return "Choose a difficulty.";
    const m = Number(d.minutes);
    return Number.isInteger(m) && m >= 1 && m <= 600 ? null : "Solving time must be a whole number of minutes between 1 and 600.";
  },
  (d) => (d.visibility ? null : "Choose who can see this question."),
];

type StepProps = { draft: Draft; update: (patch: Partial<Draft>) => void };

/* ---------- Step 1: curriculum and chapter ---------- */
export function CurriculumStep({
  draft,
  update,
  curricula,
  reload,
}: StepProps & { curricula: Curriculum[]; reload: () => Promise<Curriculum[]> }) {
  const { api } = useSession();
  const [newCurriculum, setNewCurriculum] = useState<{ name: string; description: string } | null>(null);
  const [newChapter, setNewChapter] = useState<string | null>(null);
  const [error, setError] = useState("");
  const selected = curricula.find((c) => c.id === draft.curriculumId);

  async function createCurriculum() {
    if (!newCurriculum?.name.trim()) return setError("Give the curriculum a name.");
    const body = { name: newCurriculum.name.trim(), ...(newCurriculum.description.trim() ? { description: newCurriculum.description.trim() } : {}) };
    const res = await api<{ id: string }>("POST", "/curricula", { body });
    if (!res.ok) return setError(res.status === 409 ? "A curriculum with this name already exists." : describeError(res.data, res.status));
    await reload();
    update({ curriculumId: res.data.id, chapterId: "" });
    setNewCurriculum(null);
    setNewChapter(""); // a new curriculum has no chapters yet, so open the chapter form
    setError("");
  }

  async function createChapter() {
    if (!newChapter?.trim() || !selected) return setError("Give the chapter a title.");
    const orderIndex = Math.max(0, ...selected.chapters.map((c) => c.orderIndex)) + 1;
    const res = await api<{ id: string }>("POST", `/curricula/${selected.id}/chapters`, { body: { title: newChapter.trim(), orderIndex } });
    if (!res.ok) return setError(res.status === 409 ? "This curriculum already has a chapter with that title." : describeError(res.data, res.status));
    await reload();
    update({ chapterId: res.data.id });
    setNewChapter(null);
    setError("");
  }

  return (
    <>
      <h2 className={s.sectionTitle}>Curriculum</h2>
      <p className={s.help}>Which course does this question belong to?</p>
      {error && <div className={s.error}>{error}</div>}
      <div className={s.choices}>
        {curricula.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`${s.choice} ${draft.curriculumId === c.id ? s.choiceSelected : ""}`}
            aria-pressed={draft.curriculumId === c.id}
            onClick={() => {
              update({ curriculumId: c.id, chapterId: "" });
              setNewChapter(null);
            }}
          >
            <span className={s.choiceTitle}>{c.name}</span>
            <span className={s.choiceMeta}>
              {c.chapters.length} chapter{c.chapters.length === 1 ? "" : "s"}
              {c.description ? ` · ${c.description}` : ""}
            </span>
          </button>
        ))}
        <button type="button" className={`${s.choice} ${s.addChoice}`} onClick={() => setNewCurriculum({ name: "", description: "" })}>
          + New curriculum
        </button>
      </div>

      {newCurriculum && (
        <div className={s.inlineForm}>
          <div className={s.fieldRow}>
            <div className={s.field}>
              <label className={s.label} htmlFor="cur-name">
                Curriculum name
              </label>
              <input id="cur-name" className={s.input} value={newCurriculum.name} autoFocus
                onChange={(e) => setNewCurriculum({ ...newCurriculum, name: e.target.value })} />
            </div>
            <div className={s.field}>
              <label className={s.label} htmlFor="cur-desc">
                Description (optional)
              </label>
              <input id="cur-desc" className={s.input} value={newCurriculum.description}
                onChange={(e) => setNewCurriculum({ ...newCurriculum, description: e.target.value })} />
            </div>
          </div>
          <div className={s.center} style={{ justifyContent: "flex-start" }}>
            <button type="button" className={s.button} onClick={createCurriculum}>
              Create curriculum
            </button>
            <button type="button" className={`${s.button} ${s.quiet}`} onClick={() => setNewCurriculum(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {selected && (
        <>
          <div className={s.spacer} />
          <h2 className={s.sectionTitle}>Chapter</h2>
          <p className={s.help}>Which chapter of {selected.name}?</p>
          <div className={s.choices}>
            {selected.chapters.map((ch) => (
              <button
                key={ch.id}
                type="button"
                className={`${s.choice} ${draft.chapterId === ch.id ? s.choiceSelected : ""}`}
                aria-pressed={draft.chapterId === ch.id}
                onClick={() => update({ chapterId: ch.id })}
              >
                <span className={s.choiceMeta}>Chapter {ch.orderIndex}</span>
                <span className={s.choiceTitle}>{ch.title}</span>
              </button>
            ))}
            <button type="button" className={`${s.choice} ${s.addChoice}`} onClick={() => setNewChapter("")}>
              + New chapter
            </button>
          </div>
          {newChapter !== null && (
            <div className={s.inlineForm}>
              <div className={s.field}>
                <label className={s.label} htmlFor="ch-title">
                  Chapter title (added as chapter {Math.max(0, ...selected.chapters.map((c) => c.orderIndex)) + 1})
                </label>
                <input id="ch-title" className={s.input} value={newChapter} autoFocus onChange={(e) => setNewChapter(e.target.value)} />
              </div>
              <div className={s.center} style={{ justifyContent: "flex-start" }}>
                <button type="button" className={s.button} onClick={createChapter}>
                  Add chapter
                </button>
                <button type="button" className={`${s.button} ${s.quiet}`} onClick={() => setNewChapter(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

/* ---------- Step 2: the problem ---------- */
export function ProblemStep({ draft, update }: StepProps) {
  const setOption = (i: number, value: string) => update({ options: draft.options.map((o, j) => (j === i ? value : o)) });
  const removeOption = (i: number) =>
    update({
      options: draft.options.filter((_, j) => j !== i),
      correctIndex: draft.correctIndex === i ? null : draft.correctIndex !== null && draft.correctIndex > i ? draft.correctIndex - 1 : draft.correctIndex,
    });

  return (
    <>
      <div className={s.field}>
        <label className={s.label} htmlFor="content">
          Question
        </label>
        <textarea id="content" className={s.textarea} value={draft.content} placeholder="Write the problem exactly as students will see it."
          onChange={(e) => update({ content: e.target.value })} />
      </div>

      <div className={s.field}>
        <span className={s.label}>Answer type</span>
        <div className={s.choices} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {([
            ["open", "Written answer", "Students write the solution"],
            ["mcq", "Multiple choice", "Students pick one option"],
          ] as const).map(([kind, title, meta]) => (
            <button key={kind} type="button" className={`${s.choice} ${draft.kind === kind ? s.choiceSelected : ""}`}
              aria-pressed={draft.kind === kind} onClick={() => update({ kind })}>
              <span className={s.choiceTitle}>{title}</span>
              <span className={s.choiceMeta}>{meta}</span>
            </button>
          ))}
        </div>
      </div>

      {draft.kind === "open" ? (
        <div className={s.field}>
          <label className={s.label} htmlFor="answer">
            Answer / model solution
          </label>
          <textarea id="answer" className={s.textarea} value={draft.answer} onChange={(e) => update({ answer: e.target.value })} />
        </div>
      ) : (
        <div className={s.field}>
          <span className={s.label}>Options</span>
          <p className={s.help} style={{ marginBottom: 10 }}>
            Mark the correct option.
          </p>
          {draft.options.map((opt, i) => (
            <div key={i} className={s.optionRow}>
              <label className={`${s.correctToggle} ${draft.correctIndex === i ? s.correctOn : ""}`}>
                <input type="radio" name="correct" checked={draft.correctIndex === i} onChange={() => update({ correctIndex: i })} />
                {draft.correctIndex === i ? "Correct" : "Mark correct"}
              </label>
              <input className={s.input} value={opt} placeholder={`Option ${i + 1}`} aria-label={`Option ${i + 1}`}
                onChange={(e) => setOption(i, e.target.value)} />
              <button type="button" className={s.removeButton} aria-label={`Remove option ${i + 1}`}
                onClick={() => removeOption(i)} disabled={draft.options.length <= 2}>
                ×
              </button>
            </div>
          ))}
          {draft.options.length < 8 && (
            <button type="button" className={s.linkButton} onClick={() => update({ options: [...draft.options, ""] })}>
              + Add option
            </button>
          )}
        </div>
      )}
    </>
  );
}

/* ---------- Step 3: difficulty and time ---------- */
export function DifficultyStep({ draft, update }: StepProps) {
  return (
    <>
      <div className={s.field}>
        <span className={s.label}>Difficulty</span>
        <div className={s.segments}>
          {DIFFICULTY_LABELS.map((label, i) => (
            <button key={label} type="button" className={`${s.segment} ${draft.difficulty === i + 1 ? s.choiceSelected : ""}`}
              aria-pressed={draft.difficulty === i + 1} onClick={() => update({ difficulty: i + 1 })}>
              <span className={s.segmentNumber}>{i + 1}</span>
              <span className={s.segmentLabel}>{label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className={s.spacer} />
      <div className={s.field}>
        <label className={s.label} htmlFor="minutes">
          Estimated solving time (minutes)
        </label>
        <input id="minutes" className={s.input} style={{ maxWidth: 160 }} type="number" min={1} max={600} inputMode="numeric"
          value={draft.minutes} onChange={(e) => update({ minutes: e.target.value })} />
        <div className={s.chips}>
          {[2, 5, 10, 15, 20, 30].map((m) => (
            <button key={m} type="button" className={`${s.chip} ${draft.minutes === String(m) ? s.choiceSelected : ""}`}
              onClick={() => update({ minutes: String(m) })}>
              {m} min
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/* ---------- Step 4: privacy ---------- */
export function PrivacyStep({ draft, update }: StepProps) {
  const options = [
    ["PRIVATE", "Private", "Only you can see and use this question."],
    ["SHARED", "Shared", "All instructors can see it, review it and use it in their exams."],
  ] as const;
  return (
    <>
      <h2 className={s.sectionTitle}>Who can see this question?</h2>
      <p className={s.help}>Either way, it enters the question bank only after it is approved.</p>
      <div className={s.choices}>
        {options.map(([value, title, meta]) => (
          <button key={value} type="button" className={`${s.choice} ${draft.visibility === value ? s.choiceSelected : ""}`}
            aria-pressed={draft.visibility === value} onClick={() => update({ visibility: value })}>
            <span className={s.choiceTitle}>{title}</span>
            <span className={s.choiceMeta}>{meta}</span>
          </button>
        ))}
      </div>
    </>
  );
}
