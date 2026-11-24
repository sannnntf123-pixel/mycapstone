"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, type User } from "@/lib/client/session";
import { describeError } from "@/lib/client/types";
import s from "../instructor.module.css";

const DEGREES = [
  { value: "BACHELOR", label: "Bachelor's degree" },
  { value: "MASTER", label: "Master's degree" },
  { value: "DOCTORATE", label: "Doctorate (PhD)" },
  { value: "OTHER", label: "Other" },
] as const;

const MAX_COURSES = 20;

type Form = {
  name: string;
  email: string;
  password: string;
  confirm: string;
  major: string;
  degree: string;
  university: string;
  inviteCode: string;
};

const help = { margin: "6px 0 0", fontSize: 13 } as const;

export default function SignupPage() {
  const router = useRouter();
  const { api, setSession, ready, user } = useSession();
  const [form, setForm] = useState<Form>({
    name: "",
    email: "",
    password: "",
    confirm: "",
    major: "",
    degree: "",
    university: "",
    inviteCode: "",
  });
  const [courses, setCourses] = useState<string[]>([]);
  const [courseDraft, setCourseDraft] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace("/instructor");
  }, [ready, user, router]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });
  const mismatch = form.confirm !== "" && form.confirm !== form.password;

  // Adds whatever is typed in the course box; returns the updated list.
  function addCourse(): string[] {
    const name = courseDraft.trim();
    if (!name) return courses;
    setCourseDraft("");
    if (courses.length >= MAX_COURSES || courses.some((c) => c.toLowerCase() === name.toLowerCase())) return courses;
    const next = [...courses, name];
    setCourses(next);
    return next;
  }

  function onCourseKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addCourse();
    } else if (e.key === "Backspace" && courseDraft === "" && courses.length) {
      setCourses(courses.slice(0, -1));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    // A course still sitting in the box counts, so it isn't silently lost.
    const courseList = addCourse();
    if (courseList.length === 0) {
      setError("Add at least one course you teach.");
      return;
    }
    setBusy(true);
    setError("");
    const { name, email, password, major, degree, university, inviteCode } = form;
    const res = await api<{ user: User; token: string }>("POST", "/auth/register", {
      body: { name, email, password, major, degree, university, courses: courseList, inviteCode },
    });
    setBusy(false);
    if (res.ok) {
      setSession(res.data.token, res.data.user);
      router.replace("/instructor");
    } else if (res.status === 403) {
      setError("That invite code is not valid. Ask your administrator for the instructor invite code.");
    } else if (res.status === 409) {
      setError("An account with this email already exists. Sign in instead.");
    } else {
      setError(describeError(res.data, res.status));
    }
  }

  return (
    <div className={s.loginWrap}>
      <div className={`${s.card} ${s.loginCard} ${s.signupCard}`}>
        <h1 className={s.pageTitle}>Create instructor account</h1>
        <p className={s.subtitle}>Exam Question Bank</p>
        {error && (
          <div className={s.error} role="alert">
            {error}
          </div>
        )}
        <form onSubmit={submit}>
          <h2 className={s.formSection}>Account</h2>
          <div className={s.field}>
            <label className={s.label} htmlFor="name">
              Full name
            </label>
            <input id="name" className={s.input} autoComplete="name" maxLength={100} value={form.name} onChange={set("name")} required />
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="email">
              Email
            </label>
            <input id="email" className={s.input} type="email" autoComplete="email" value={form.email} onChange={set("email")} required />
          </div>
          <div className={s.fieldRow}>
            <div className={s.field}>
              <label className={s.label} htmlFor="password">
                Password
              </label>
              <input
                id="password"
                className={s.input}
                type="password"
                autoComplete="new-password"
                minLength={8}
                value={form.password}
                onChange={set("password")}
                aria-describedby="password-help"
                required
              />
              <div id="password-help" className={s.help} style={help}>
                At least 8 characters.
              </div>
            </div>
            <div className={s.field}>
              <label className={s.label} htmlFor="confirm">
                Confirm password
              </label>
              <input
                id="confirm"
                className={s.input}
                type="password"
                autoComplete="new-password"
                value={form.confirm}
                onChange={set("confirm")}
                aria-invalid={mismatch}
                required
              />
              {mismatch && <div className={s.fieldError}>Passwords do not match.</div>}
            </div>
          </div>

          <h2 className={s.formSection}>Teaching profile</h2>
          <div className={s.fieldRow}>
            <div className={s.field}>
              <label className={s.label} htmlFor="major">
                Major
              </label>
              <input
                id="major"
                className={s.input}
                placeholder="e.g. Mathematics"
                maxLength={100}
                value={form.major}
                onChange={set("major")}
                required
              />
            </div>
            <div className={s.field}>
              <label className={s.label} htmlFor="degree">
                Highest degree
              </label>
              <select id="degree" className={s.input} value={form.degree} onChange={set("degree")} required>
                <option value="" disabled>
                  Choose…
                </option>
                {DEGREES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="university">
              University you graduated from
            </label>
            <input
              id="university"
              className={s.input}
              autoComplete="organization"
              maxLength={150}
              value={form.university}
              onChange={set("university")}
              required
            />
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="course">
              Courses you teach
            </label>
            <div className={s.courseInput}>
              <input
                id="course"
                className={s.input}
                placeholder="e.g. Calculus I"
                maxLength={100}
                value={courseDraft}
                onChange={(e) => setCourseDraft(e.target.value)}
                onKeyDown={onCourseKey}
                disabled={courses.length >= MAX_COURSES}
                aria-describedby="course-help"
              />
              <button
                type="button"
                className={`${s.button} ${s.ghost}`}
                onClick={addCourse}
                disabled={!courseDraft.trim() || courses.length >= MAX_COURSES}
              >
                Add
              </button>
            </div>
            <div id="course-help" className={s.help} style={help}>
              Press Enter after each course. Add at least one.
            </div>
            {courses.length > 0 && (
              <ul className={s.courseChips} aria-label="Courses added">
                {courses.map((c) => (
                  <li key={c} className={s.courseChip}>
                    {c}
                    <button type="button" aria-label={`Remove ${c}`} onClick={() => setCourses(courses.filter((x) => x !== c))}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <h2 className={s.formSection}>Access</h2>
          <div className={s.field}>
            <label className={s.label} htmlFor="inviteCode">
              Invite code
            </label>
            <input
              id="inviteCode"
              className={s.input}
              autoComplete="off"
              value={form.inviteCode}
              onChange={set("inviteCode")}
              aria-describedby="invite-help"
              required
            />
            <div id="invite-help" className={s.help} style={help}>
              Accounts are for instructors only. Your administrator gives you this code.
            </div>
          </div>
          <button className={s.button} style={{ width: "100%" }} disabled={busy}>
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>
        <p className={s.switchAuth}>
          Already have an account? <Link href="/instructor/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
