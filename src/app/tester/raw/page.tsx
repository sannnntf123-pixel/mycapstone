"use client";

import { useState } from "react";
import { Page } from "../components";
import { useSession } from "@/lib/client/session";
import s from "../tester.module.css";

const presets = [
  { label: "Malformed JSON", method: "POST", path: "/questions", body: "{not json" },
  { label: "Difficulty out of range", method: "POST", path: "/questions", body: '{"content":"x","answer":"y","curriculumId":"x","chapterId":"x","difficulty":9,"estimatedTimeMinutes":5}' },
  { label: "Page size over 100", method: "GET", path: "/questions?pageSize=500", body: "" },
  { label: "Unknown question id", method: "GET", path: "/questions/does-not-exist", body: "" },
  { label: "Bank with status override", method: "GET", path: "/questions/bank?status=PENDING", body: "" },
  { label: "Register without invite code", method: "POST", path: "/auth/register", body: '{"email":"x@example.com","password":"password123","name":"X"}' },
];

export default function RawRequestPage() {
  const { api, user } = useSession();
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/auth/me");
  const [body, setBody] = useState("");

  return (
    <Page>
      <section className={s.card}>
        <h2>Raw request</h2>
        <p className={s.hint}>
          Sends exactly what you type to <code>/api</code> + path, with your token ({user ? user.name : "none"}). The body is
          sent as-is, so you can test malformed input. The response appears in the request log.
        </p>
        <div className={s.row} style={{ marginBottom: 12 }}>
          {presets.map((p) => (
            <button
              key={p.label}
              className={`${s.button} ${s.secondary} ${s.small}`}
              onClick={() => {
                setMethod(p.method);
                setPath(p.path);
                setBody(p.body);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <form
          className={s.form}
          onSubmit={(e) => {
            e.preventDefault();
            api(method, path.startsWith("/") ? path : `/${path}`, method === "GET" ? {} : { rawBody: body });
          }}
        >
          <label className={s.field}>
            Method
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option>GET</option>
              <option>POST</option>
              <option>PUT</option>
              <option>DELETE</option>
            </select>
          </label>
          <label className={`${s.field}`} style={{ gridColumn: "span 2" }}>
            Path (after /api)
            <input value={path} onChange={(e) => setPath(e.target.value)} />
          </label>
          <label className={`${s.field} ${s.wide}`}>
            Body
            <textarea value={body} onChange={(e) => setBody(e.target.value)} disabled={method === "GET"} />
          </label>
          <button className={s.button}>Send</button>
        </form>
      </section>
    </Page>
  );
}
