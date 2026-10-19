"use client";

import { useCallback, useEffect, useState } from "react";
import { Page, SignInNotice } from "../components";
import type { Curriculum } from "@/lib/client/types";
import { useSession } from "@/lib/client/session";
import s from "../tester.module.css";

export default function CurriculaPage() {
  const { api, token } = useSession();
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [newCurriculum, setNewCurriculum] = useState({ name: "", description: "" });
  const [newChapter, setNewChapter] = useState({ curriculumId: "", title: "", orderIndex: "1" });

  const load = useCallback(async () => {
    const res = await api<{ items: Curriculum[] }>("GET", "/curricula");
    if (res.ok) setCurricula(res.data.items);
  }, [api]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  async function createCurriculum(e: React.FormEvent) {
    e.preventDefault();
    const body = { name: newCurriculum.name, ...(newCurriculum.description ? { description: newCurriculum.description } : {}) };
    if ((await api("POST", "/curricula", { body })).ok) {
      setNewCurriculum({ name: "", description: "" });
      load();
    }
  }

  async function createChapter(e: React.FormEvent) {
    e.preventDefault();
    const body = { title: newChapter.title, orderIndex: Number(newChapter.orderIndex) };
    if ((await api("POST", `/curricula/${newChapter.curriculumId}/chapters`, { body })).ok) {
      setNewChapter({ ...newChapter, title: "" });
      load();
    }
  }

  return (
    <Page>
      <SignInNotice />
      <section className={s.card}>
        <div className={s.row}>
          <h2 style={{ flex: 1 }}>Curricula and chapters</h2>
          <button className={`${s.button} ${s.secondary} ${s.small}`} onClick={load}>
            Reload
          </button>
        </div>
        <p className={s.hint}>GET /api/curricula</p>
        {curricula.length === 0 && <p className={s.muted}>Nothing loaded.</p>}
        <div className={s.tableWrap}>
          <table className={s.table}>
            <tbody>
              {curricula.map((c) => (
                <tr key={c.id}>
                  <td style={{ width: "35%" }}>
                    <b>{c.name}</b>
                    <div className={s.muted}>{c.description}</div>
                  </td>
                  <td>
                    {c.chapters.length === 0 ? (
                      <span className={s.muted}>no chapters</span>
                    ) : (
                      c.chapters.map((ch) => (
                        <div key={ch.id}>
                          {ch.orderIndex}. {ch.title}
                        </div>
                      ))
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={s.card}>
        <h2>New curriculum</h2>
        <p className={s.hint}>POST /api/curricula. Names must be unique (409 otherwise).</p>
        <form className={s.form} onSubmit={createCurriculum}>
          <label className={s.field}>
            Name
            <input value={newCurriculum.name} onChange={(e) => setNewCurriculum({ ...newCurriculum, name: e.target.value })} />
          </label>
          <label className={s.field}>
            Description (optional)
            <input
              value={newCurriculum.description}
              onChange={(e) => setNewCurriculum({ ...newCurriculum, description: e.target.value })}
            />
          </label>
          <button className={s.button}>Create</button>
        </form>
      </section>

      <section className={s.card}>
        <h2>New chapter</h2>
        <p className={s.hint}>
          POST /api/curricula/:id/chapters. Title and order number must be unique within the curriculum; order must be at least 1.
        </p>
        <form className={s.form} onSubmit={createChapter}>
          <label className={s.field}>
            Curriculum
            <select value={newChapter.curriculumId} onChange={(e) => setNewChapter({ ...newChapter, curriculumId: e.target.value })}>
              <option value="">Choose…</option>
              {curricula.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className={s.field}>
            Title
            <input value={newChapter.title} onChange={(e) => setNewChapter({ ...newChapter, title: e.target.value })} />
          </label>
          <label className={s.field}>
            Order
            <input type="number" value={newChapter.orderIndex} onChange={(e) => setNewChapter({ ...newChapter, orderIndex: e.target.value })} />
          </label>
          <button className={s.button} disabled={!newChapter.curriculumId}>
            Create
          </button>
        </form>
      </section>
    </Page>
  );
}
