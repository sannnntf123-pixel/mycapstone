"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Page, SignInNotice } from "../components";
import type { Curriculum, Question, QuestionPage } from "@/lib/client/types";
import { useSession } from "@/lib/client/session";
import s from "../tester.module.css";

const emptyFilters = { curriculumId: "", chapterId: "", difficulty: "", status: "", visibility: "", mine: false, page: "1", pageSize: "20" };
const emptyDraft = {
  curriculumId: "",
  chapterId: "",
  content: "",
  options: "",
  answer: "",
  difficulty: "3",
  estimatedTimeMinutes: "5",
  visibility: "PRIVATE",
};

export default function QuestionsPage() {
  const { api, token } = useSession();
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [bankOnly, setBankOnly] = useState(false);
  const [result, setResult] = useState<QuestionPage | null>(null);
  const [selected, setSelected] = useState<Question | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!token) return;
    api<{ items: Curriculum[] }>("GET", "/curricula").then((res) => res.ok && setCurricula(res.data.items));
  }, [token, api]);

  const chaptersOf = (curriculumId: string) => curricula.find((c) => c.id === curriculumId)?.chapters ?? [];

  const search = useCallback(async () => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (k === "mine") {
        if (v) params.set("mine", "true");
      } else if (v !== "" && !(bankOnly && k === "status")) {
        params.set(k, String(v));
      }
    }
    const res = await api<QuestionPage>("GET", `/questions${bankOnly ? "/bank" : ""}?${params}`);
    if (res.ok) setResult(res.data);
  }, [api, filters, bankOnly]);

  async function open(id: string) {
    const res = await api<Question>("GET", `/questions/${id}`);
    if (res.ok) {
      setSelected(res.data);
      setReason("");
    }
  }

  async function review(action: "approve" | "reject") {
    if (!selected) return;
    const body = action === "reject" && reason ? { reason } : undefined;
    const res = await api<Question>("POST", `/questions/${selected.id}/${action}`, { body });
    if (res.ok) {
      setSelected(res.data);
      search();
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const options = draft.options
      .split("\n")
      .map((o) => o.trim())
      .filter(Boolean);
    const body = {
      curriculumId: draft.curriculumId,
      chapterId: draft.chapterId,
      content: draft.content,
      answer: draft.answer,
      difficulty: Number(draft.difficulty),
      estimatedTimeMinutes: Number(draft.estimatedTimeMinutes),
      visibility: draft.visibility,
      ...(options.length ? { options } : {}),
    };
    const res = await api<Question>("POST", "/questions", { body });
    if (res.ok) {
      setDraft({ ...emptyDraft, curriculumId: draft.curriculumId, chapterId: draft.chapterId });
      setSelected(res.data);
      search();
    }
  }

  const set = (k: keyof typeof filters, v: string | boolean) => setFilters((f) => ({ ...f, [k]: v }));

  return (
    <Page>
      <SignInNotice />
      <section className={s.card}>
        <h2>Find questions</h2>
        <p className={s.hint}>
          GET /api/questions shows everything you may see (your own + shared). GET /api/questions/bank shows approved ones only.
        </p>
        <div className={s.form}>
          <label className={s.field}>
            Endpoint
            <select value={bankOnly ? "bank" : "all"} onChange={(e) => setBankOnly(e.target.value === "bank")}>
              <option value="all">/questions (all visible)</option>
              <option value="bank">/questions/bank (approved)</option>
            </select>
          </label>
          <label className={s.field}>
            Curriculum
            <select value={filters.curriculumId} onChange={(e) => setFilters({ ...filters, curriculumId: e.target.value, chapterId: "" })}>
              <option value="">Any</option>
              {curricula.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            Chapter
            <select value={filters.chapterId} onChange={(e) => set("chapterId", e.target.value)} disabled={!filters.curriculumId}>
              <option value="">Any</option>
              {chaptersOf(filters.curriculumId).map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.orderIndex}. {ch.title}
                </option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            Difficulty
            <select value={filters.difficulty} onChange={(e) => set("difficulty", e.target.value)}>
              <option value="">Any</option>
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            Status
            <select value={filters.status} onChange={(e) => set("status", e.target.value)} disabled={bankOnly}>
              <option value="">Any</option>
              <option>PENDING</option>
              <option>APPROVED</option>
              <option>REJECTED</option>
            </select>
          </label>
          <label className={s.field}>
            Visibility
            <select value={filters.visibility} onChange={(e) => set("visibility", e.target.value)}>
              <option value="">Any</option>
              <option>PRIVATE</option>
              <option>SHARED</option>
            </select>
          </label>
          <label className={s.field}>
            Page
            <input type="number" min={1} value={filters.page} onChange={(e) => set("page", e.target.value)} />
          </label>
          <label className={s.field}>
            Page size
            <input type="number" min={1} max={100} value={filters.pageSize} onChange={(e) => set("pageSize", e.target.value)} />
          </label>
          <label className={s.check}>
            <input type="checkbox" checked={filters.mine} onChange={(e) => set("mine", e.target.checked)} /> Only mine
          </label>
          <div className={s.row}>
            <button className={s.button} onClick={search}>
              Search
            </button>
            <button className={`${s.button} ${s.secondary}`} onClick={() => setFilters(emptyFilters)}>
              Reset
            </button>
          </div>
        </div>
      </section>

      {result && (
        <section className={s.card}>
          <h2>
            {result.total} result{result.total === 1 ? "" : "s"}
          </h2>
          <p className={s.hint}>
            Page {result.page}, showing {result.items.length}. Click a row to load it with GET /api/questions/:id.
          </p>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Question</th>
                  <th>Chapter</th>
                  <th>Diff.</th>
                  <th>Min</th>
                  <th>Status</th>
                  <th>Visibility</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((q) => (
                  <tr key={q.id} className={`${s.clickable} ${selected?.id === q.id ? s.selected : ""}`} onClick={() => open(q.id)}>
                    <td>
                      {q.content.length > 80 ? q.content.slice(0, 80) + "…" : q.content}
                      {q.source === "AI" && (
                        <>
                          {" "}
                          <Badge value="AI" />
                        </>
                      )}
                    </td>
                    <td>
                      <span className={s.muted}>{q.curriculum.name}</span>
                      <br />
                      {q.chapter.title}
                    </td>
                    <td>{q.difficulty}</td>
                    <td>{q.estimatedTimeMinutes}</td>
                    <td>
                      <Badge value={q.status} />
                    </td>
                    <td>
                      <Badge value={q.visibility} />
                    </td>
                    <td>{q.createdBy.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {selected && (
        <section className={s.card}>
          <div className={s.row}>
            <h2 style={{ flex: 1 }}>Question detail</h2>
            <button className={`${s.button} ${s.secondary} ${s.small}`} onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <dl className={s.detailGrid}>
            <dt>Question</dt>
            <dd>{selected.content}</dd>
            {selected.options && (
              <>
                <dt>Options</dt>
                <dd>{selected.options.join("  |  ")}</dd>
              </>
            )}
            <dt>Answer</dt>
            <dd>{selected.answer}</dd>
            <dt>Status</dt>
            <dd>
              <Badge value={selected.status} /> <Badge value={selected.visibility} /> <Badge value={selected.source} />
            </dd>
            <dt>Curriculum</dt>
            <dd>
              {selected.curriculum.name} / {selected.chapter.title}
            </dd>
            <dt>Difficulty / time</dt>
            <dd>
              {selected.difficulty} / {selected.estimatedTimeMinutes} min
            </dd>
            <dt>Created by</dt>
            <dd>{selected.createdBy.name}</dd>
            <dt>Approved by</dt>
            <dd>
              {selected.approvedBy
                ? `${selected.approvedBy.name} on ${new Date(selected.approvedAt!).toLocaleString()}`
                : "—"}
            </dd>
            {selected.rejectionReason && (
              <>
                <dt>Rejection reason</dt>
                <dd>{selected.rejectionReason}</dd>
              </>
            )}
            <dt>Usage</dt>
            <dd>
              {selected.timesUsed} time(s)
              {selected.lastUsedAt ? `, last ${new Date(selected.lastUsedAt).toLocaleDateString()}` : ""}
            </dd>
          </dl>
          <div className={s.form}>
            <label className={`${s.field} ${s.wide}`}>
              Rejection reason (optional)
              <input value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            <div className={s.row}>
              <button className={s.button} onClick={() => review("approve")}>
                Approve
              </button>
              <button className={`${s.button} ${s.danger}`} onClick={() => review("reject")}>
                Reject
              </button>
              <span className={s.muted}>Only PENDING questions can be reviewed; others return 409.</span>
            </div>
          </div>
        </section>
      )}

      <section className={s.card}>
        <h2>New question</h2>
        <p className={s.hint}>
          POST /api/questions. New questions always start PENDING. For multiple choice, put one option per line; the answer must
          match one of them.
        </p>
        <form className={s.form} onSubmit={create}>
          <label className={s.field}>
            Curriculum
            <select value={draft.curriculumId} onChange={(e) => setDraft({ ...draft, curriculumId: e.target.value, chapterId: "" })}>
              <option value="">Choose…</option>
              {curricula.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            Chapter
            <select value={draft.chapterId} onChange={(e) => setDraft({ ...draft, chapterId: e.target.value })}>
              <option value="">Choose…</option>
              {chaptersOf(draft.curriculumId).map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.orderIndex}. {ch.title}
                </option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            Difficulty (1–5)
            <input type="number" value={draft.difficulty} onChange={(e) => setDraft({ ...draft, difficulty: e.target.value })} />
          </label>
          <label className={s.field}>
            Minutes
            <input
              type="number"
              value={draft.estimatedTimeMinutes}
              onChange={(e) => setDraft({ ...draft, estimatedTimeMinutes: e.target.value })}
            />
          </label>
          <label className={s.field}>
            Visibility
            <select value={draft.visibility} onChange={(e) => setDraft({ ...draft, visibility: e.target.value })}>
              <option>PRIVATE</option>
              <option>SHARED</option>
            </select>
          </label>
          <label className={`${s.field} ${s.wide}`}>
            Question
            <textarea value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} />
          </label>
          <label className={`${s.field} ${s.wide}`}>
            Options (optional, one per line)
            <textarea value={draft.options} onChange={(e) => setDraft({ ...draft, options: e.target.value })} />
          </label>
          <label className={`${s.field} ${s.wide}`}>
            Answer
            <input value={draft.answer} onChange={(e) => setDraft({ ...draft, answer: e.target.value })} />
          </label>
          <button className={s.button}>Create question</button>
        </form>
      </section>
    </Page>
  );
}
