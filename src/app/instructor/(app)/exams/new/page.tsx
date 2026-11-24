"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useSession } from "@/lib/client/session";
import { describeError, DIFFICULTY_LABELS, difficultyLabel, type Availability, type Curriculum, type Exam } from "@/lib/client/types";
import s from "../../../instructor.module.css";

const DURATIONS = [30, 45, 60, 90, 120];
const FILL_TARGET = 0.9; // mirrors the generator: an exam is "full enough" at 90%

export default function GenerateExamPage() {
  const { api } = useSession();
  const router = useRouter();
  const [curricula, setCurricula] = useState<Curriculum[] | null>(null);
  const [query, setQuery] = useState("");
  const [curriculumId, setCurriculumId] = useState("");
  const [chapterIds, setChapterIds] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<number | null>(3);
  const [minutes, setMinutes] = useState("60");
  const [title, setTitle] = useState("");
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ items: Curriculum[] }>("GET", "/curricula").then((r) => setCurricula(r.ok ? r.data.items : []));
  }, [api]);

  // Availability depends on the course and the difficulty band.
  useEffect(() => {
    if (!curriculumId) return setAvailability(null);
    let cancelled = false;
    const d = difficulty === null ? "mixed" : String(difficulty);
    api<Availability>("GET", `/exams/availability?curriculumId=${curriculumId}&difficulty=${d}`).then((r) => {
      if (!cancelled && r.ok) setAvailability(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [api, curriculumId, difficulty]);

  const course = curricula?.find((c) => c.id === curriculumId);
  const q = query.trim().toLowerCase();
  const shownCourses = (curricula ?? []).filter((c) => !q || c.id === curriculumId || c.name.toLowerCase().includes(q));

  function chooseCourse(id: string) {
    setCurriculumId(id);
    // Default to every chapter; instructors usually narrow down from there.
    setChapterIds(curricula?.find((c) => c.id === id)?.chapters.map((ch) => ch.id) ?? []);
    setError("");
  }

  const toggleChapter = (id: string) =>
    setChapterIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const duration = Number(minutes);
  const durationValid = Number.isInteger(duration) && duration >= 5 && duration <= 600;

  const supply = useMemo(() => {
    if (!availability) return null;
    const chosen = availability.chapters.filter((c) => chapterIds.includes(c.id));
    return {
      questions: chosen.reduce((n, c) => n + c.matching, 0),
      minutes: chosen.reduce((n, c) => n + c.matchingMinutes, 0),
      emptyChapters: chosen.filter((c) => c.matching === 0),
    };
  }, [availability, chapterIds]);

  const ratio = supply && durationValid ? supply.minutes / duration : 0;
  const tone = !supply ? undefined : ratio >= 1 ? "ok" : ratio >= FILL_TARGET ? "warn" : "bad";

  const problem = !curriculumId
    ? "Choose a course."
    : chapterIds.length === 0
      ? "Choose at least one chapter."
      : !durationValid
        ? "Exam duration must be a whole number of minutes between 5 and 600."
        : supply && supply.questions === 0
          ? "No approved questions match these chapters and difficulty."
          : null;

  async function generate() {
    if (problem) return setError(problem);
    setBusy(true);
    setError("");
    const res = await api<Exam>("POST", "/exams", {
      body: { curriculumId, chapterIds, difficulty, durationMinutes: duration, ...(title.trim() ? { title: title.trim() } : {}) },
    });
    if (res.ok) router.push(`/instructor/exams/${res.data.id}`);
    else {
      setBusy(false);
      setError(describeError(res.data, res.status));
    }
  }

  return (
    <>
      <div className={s.pageHead}>
        <div>
          <p className={s.eyebrow}>
            <Link href="/instructor/exams" className={s.linkButton} style={{ fontWeight: 500 }}>
              <Icon name="arrowLeft" size={14} />
              Exams
            </Link>
          </p>
          <h1 className={s.pageTitle}>Generate an exam</h1>
          <p className={s.subtitle}>
            Pick a course, chapters, difficulty and length. We&apos;ll assemble it from approved questions in the bank, and you can
            adjust it before finalizing.
          </p>
        </div>
      </div>

      <div className={s.examLayout}>
        <div className={s.card}>
          {/* 1. course */}
          <section className={s.formBlock}>
            <div className={s.blockHead}>
              <h2 className={s.sectionTitle}>
                <span className={s.formSectionNum}>1</span>Course
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
                  onClick={() => chooseCourse(c.id)}
                >
                  <span className={s.choiceTitle}>{c.name}</span>
                  <span className={s.choiceMeta}>
                    {c.chapters.length} chapter{c.chapters.length === 1 ? "" : "s"}
                  </span>
                </button>
              ))}
            </div>
            {curricula && q && shownCourses.length === 0 && <p className={s.hint}>No course matches &ldquo;{query.trim()}&rdquo;.</p>}
          </section>

          {/* 2. chapters */}
          <section className={s.formBlock}>
            <div className={s.blockHead}>
              <h2 className={s.sectionTitle}>
                <span className={s.formSectionNum}>2</span>Chapters
              </h2>
              {course && course.chapters.length > 1 && (
                <button
                  type="button"
                  className={s.linkButton}
                  onClick={() => setChapterIds(chapterIds.length === course.chapters.length ? [] : course.chapters.map((c) => c.id))}
                >
                  {chapterIds.length === course.chapters.length ? "Clear all" : "Select all"}
                </button>
              )}
            </div>
            {!course ? (
              <p className={s.help} style={{ margin: 0 }}>
                Choose a course first.
              </p>
            ) : course.chapters.length === 0 ? (
              <p className={s.help} style={{ margin: 0 }}>
                This course has no chapters yet.
              </p>
            ) : (
              <ul className={s.checkList}>
                {course.chapters.map((ch) => {
                  const a = availability?.chapters.find((x) => x.id === ch.id);
                  const on = chapterIds.includes(ch.id);
                  return (
                    <li key={ch.id}>
                      <label className={`${s.checkRow} ${on ? s.checkRowOn : ""} ${a && a.matching === 0 ? s.checkRowEmpty : ""}`}>
                        <input type="checkbox" className={s.checkbox} checked={on} onChange={() => toggleChapter(ch.id)} />
                        <span className={s.checkMain}>
                          <span className={s.checkTitle}>{ch.title}</span>
                          <span className={s.checkMeta}>Chapter {ch.orderIndex}</span>
                        </span>
                        <span className={s.checkCount}>
                          {!a ? "…" : a.matching === 0 ? "No matching questions" : `${a.matching} q · ${a.matchingMinutes} min`}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* 3. difficulty */}
          <section className={s.formBlock}>
            <div className={s.blockHead}>
              <h2 className={s.sectionTitle}>
                <span className={s.formSectionNum}>3</span>Difficulty
              </h2>
            </div>
            <div className={`${s.segments} ${s.segmentsSix}`}>
              {[...DIFFICULTY_LABELS.map((label, i) => ({ value: i + 1 as number | null, label })), { value: null, label: "Mixed" }].map(
                (opt) => (
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
                ),
              )}
            </div>
            <p className={s.hint}>
              {difficulty === null
                ? "A balanced spread across all levels."
                : `Uses questions within one level of ${DIFFICULTY_LABELS[difficulty - 1].toLowerCase()} (${Math.max(1, difficulty - 1)}–${Math.min(5, difficulty + 1)} of 5).`}
            </p>
          </section>

          {/* 4. duration & title */}
          <section className={s.formBlock}>
            <div className={s.blockHead}>
              <h2 className={s.sectionTitle}>
                <span className={s.formSectionNum}>4</span>Length &amp; title
              </h2>
            </div>
            <div className={s.fieldRow}>
              <div className={s.field}>
                <label className={s.label} htmlFor="duration">
                  Exam duration
                </label>
                <div className={s.minutesField}>
                  <input
                    id="duration"
                    className={s.input}
                    type="number"
                    min={5}
                    max={600}
                    inputMode="numeric"
                    value={minutes}
                    onChange={(e) => setMinutes(e.target.value)}
                    aria-invalid={minutes !== "" && !durationValid}
                  />
                  <span className={s.optional}>minutes</span>
                </div>
                <div className={s.chips}>
                  {DURATIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={`${s.chip} ${minutes === String(m) ? s.choiceSelected : ""}`}
                      aria-pressed={minutes === String(m)}
                      onClick={() => setMinutes(String(m))}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </div>
              <div className={s.field}>
                <label className={s.label} htmlFor="title">
                  Title <span className={s.optional}>(optional)</span>
                </label>
                <input
                  id="title"
                  className={s.input}
                  maxLength={150}
                  placeholder={course ? `${course.name} exam` : "e.g. Midterm exam"}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            </div>
          </section>
        </div>

        <aside className={s.examAside}>
          <div className={s.summaryCard}>
            <h2>Your exam</h2>
            <dl className={s.facts}>
              <div>
                <dt>Course</dt>
                <dd>{course?.name ?? "—"}</dd>
              </div>
              <div>
                <dt>Chapters</dt>
                <dd>{course ? `${chapterIds.length} of ${course.chapters.length}` : "—"}</dd>
              </div>
              <div>
                <dt>Difficulty</dt>
                <dd>{difficultyLabel(difficulty)}</dd>
              </div>
              <div>
                <dt>Duration</dt>
                <dd>{durationValid ? `${duration} min` : "—"}</dd>
              </div>
            </dl>

            {supply && durationValid && chapterIds.length > 0 && (
              <div className={s.meter}>
                <div className={s.meterLabel}>
                  <span>Matching questions</span>
                  <strong>
                    {supply.minutes} / {duration} min
                  </strong>
                </div>
                <div className={s.meterTrack}>
                  <div className={s.meterFill} data-tone={tone} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
                </div>
                <p className={s.hint}>
                  {supply.questions} question{supply.questions === 1 ? "" : "s"} available.{" "}
                  {ratio >= 1
                    ? "Enough to fill the exam."
                    : ratio >= FILL_TARGET
                      ? "Just enough; there will be little choice."
                      : `Not enough to fill it: the exam will be shorter. ${[
                          course && chapterIds.length < course.chapters.length ? "add chapters" : null,
                          difficulty !== null ? "choose Mixed" : null,
                          "shorten the exam",
                        ]
                          .filter(Boolean)
                          .join(", ")
                          .replace(/^./, (c) => c.toUpperCase())
                          .replace(/, ([^,]*)$/, " or $1")}.`}
                </p>
              </div>
            )}

            {supply && supply.emptyChapters.length > 0 && (
              <div className={s.notice} style={{ marginTop: 14, marginBottom: 0 }}>
                <Icon name="alert" size={16} />
                <span>
                  No matching questions in {supply.emptyChapters.map((c) => c.title).join(", ")}.
                </span>
              </div>
            )}

            {error && (
              <div className={s.error} role="alert" style={{ marginTop: 14, marginBottom: 0 }}>
                <Icon name="alert" size={16} />
                {error}
              </div>
            )}

            <button className={`${s.button} ${s.block}`} style={{ marginTop: 18 }} onClick={generate} disabled={busy}>
              <Icon name="sparkles" size={16} />
              {busy ? "Generating…" : "Generate exam"}
            </button>
            <p className={s.hint} style={{ textAlign: "center" }}>
              Saved as a draft. Nothing is final until you say so.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
