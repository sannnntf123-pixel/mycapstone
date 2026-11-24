"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Icon } from "@/components/Icon";
import { useSession } from "@/lib/client/session";
import { describeError, type Exam } from "@/lib/client/types";
import s from "../../../../instructor.module.css";
import p from "./print.module.css";

// A paper version of the exam. The toolbar and the app header are hidden when printing.
export default function PrintExamPage() {
  const { id } = useParams<{ id: string }>();
  const { api } = useSession();
  const [exam, setExam] = useState<Exam | null>(null);
  const [error, setError] = useState("");
  const [answerKey, setAnswerKey] = useState(false);

  useEffect(() => {
    api<Exam>("GET", `/exams/${id}`).then((r) => (r.ok ? setExam(r.data) : setError(describeError(r.data, r.status))));
  }, [api, id]);

  if (error) {
    return (
      <div className={s.error} role="alert">
        <Icon name="alert" size={18} />
        {error}
      </div>
    );
  }
  if (!exam) return <div className={s.skeleton} style={{ height: 600, borderRadius: 16 }} />;

  return (
    <>
      <div className={p.toolbar}>
        <Link href={`/instructor/exams/${id}`} className={`${s.button} ${s.quiet}`}>
          <Icon name="arrowLeft" size={16} />
          Back to exam
        </Link>
        <label className={s.metaItem} style={{ fontSize: 14, cursor: "pointer", marginLeft: "auto" }}>
          <input type="checkbox" className={s.checkbox} checked={answerKey} onChange={(e) => setAnswerKey(e.target.checked)} />
          Include answer key
        </label>
        <button className={s.button} onClick={() => window.print()}>
          <Icon name="printer" size={16} />
          Print
        </button>
      </div>

      <article className={p.paper}>
        <header className={p.head}>
          <div>
            <p className={p.course}>{exam.curriculum.name}</p>
            <h1 className={p.title}>{exam.title}</h1>
          </div>
          <dl className={p.facts}>
            <div>
              <dt>Time allowed</dt>
              <dd>{exam.durationMinutes} minutes</dd>
            </div>
            <div>
              <dt>Questions</dt>
              <dd>{exam.questions.length}</dd>
            </div>
          </dl>
        </header>

        <div className={p.student}>
          <span>
            Name <i />
          </span>
          <span>
            Student ID <i />
          </span>
          <span>
            Date <i />
          </span>
        </div>

        <p className={p.instructions}>Answer all questions. For multiple-choice questions, circle one letter.</p>

        <ol className={p.questions}>
          {exam.questions.map((q, i) => (
            <li key={q.id} className={p.question}>
              <div className={p.qHead}>
                <span className={p.qNum}>{i + 1}.</span>
                <span className={p.qTime}>~{q.estimatedTimeMinutes} min</span>
              </div>
              <p className={p.qText}>{q.content}</p>
              {q.options ? (
                <ol className={p.options}>
                  {q.options.map((o, j) => (
                    <li key={j}>
                      <span className={p.letter}>{String.fromCharCode(65 + j)}</span>
                      {o}
                    </li>
                  ))}
                </ol>
              ) : (
                // Writing space grows with the expected solving time.
                <div className={p.lines} style={{ height: Math.min(14, 3 + Math.round(q.estimatedTimeMinutes / 3)) * 28 }} />
              )}
            </li>
          ))}
        </ol>

        {answerKey && (
          <section className={p.key}>
            <h2>Answer key</h2>
            <ol>
              {exam.questions.map((q, i) => {
                const letter = q.options ? String.fromCharCode(65 + q.options.indexOf(q.answer)) : null;
                return (
                  <li key={q.id}>
                    <strong>{i + 1}.</strong> {letter ? `${letter}. ${q.answer}` : q.answer}
                  </li>
                );
              })}
            </ol>
          </section>
        )}
      </article>
    </>
  );
}
