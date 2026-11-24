"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { MAJORS } from "@/lib/majors";
import { useSession, type User } from "@/lib/client/session";
import { describeError } from "@/lib/client/types";
import { AuthShell, FormError, PasswordInput } from "../_components/AuthShell";
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

// A rough 0–4 guide for the meter; the server only enforces 8–72 bytes.
function passwordLevel(p: string): number {
  if (!p) return 0;
  if (p.length < 8) return 1;
  let score = 1;
  if (p.length >= 12) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;
  else if (/\d|[^A-Za-z0-9]/.test(p)) score += 0.5;
  return Math.min(4, Math.floor(score));
}
const LEVEL_TEXT = ["At least 8 characters.", "Too short.", "Okay. Longer is stronger.", "Good password.", "Strong password."];

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
  const level = passwordLevel(form.password);

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
      document.getElementById("course")?.focus();
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
      return;
    }
    if (res.status === 403) setError("That invite code is not valid. Ask your administrator for the instructor invite code.");
    else if (res.status === 409) setError("An account with this email already exists. Sign in instead.");
    else setError(describeError(res.data, res.status));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <AuthShell wide>
      <h1 className={s.pageTitle}>Create your instructor account</h1>
      <p className={s.subtitle}>It takes about a minute. Your teaching profile helps colleagues know who wrote a question.</p>
      {error && <FormError>{error}</FormError>}

      <form onSubmit={submit}>
        <h2 className={s.formSection}>
          <span className={s.formSectionNum}>1</span>
          Account
        </h2>
        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label} htmlFor="name">
              Full name
            </label>
            <input
              id="name"
              className={s.input}
              autoComplete="name"
              placeholder="Dr. Jane Doe"
              maxLength={100}
              value={form.name}
              onChange={set("name")}
              required
            />
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="email">
              Work email
            </label>
            <input
              id="email"
              className={s.input}
              type="email"
              autoComplete="email"
              placeholder="you@university.edu"
              value={form.email}
              onChange={set("email")}
              required
            />
          </div>
        </div>
        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label} htmlFor="password">
              Password
            </label>
            <PasswordInput
              id="password"
              autoComplete="new-password"
              minLength={8}
              value={form.password}
              onChange={set("password")}
              aria-describedby="password-help"
              required
            />
            <div className={s.strength} data-level={level} aria-hidden>
              <span />
              <span />
              <span />
              <span />
            </div>
            <div id="password-help" className={s.hint} aria-live="polite">
              {LEVEL_TEXT[level]}
            </div>
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="confirm">
              Confirm password
            </label>
            <PasswordInput
              id="confirm"
              autoComplete="new-password"
              value={form.confirm}
              onChange={set("confirm")}
              aria-invalid={mismatch}
              aria-describedby="confirm-help"
              required
            />
            <div id="confirm-help" aria-live="polite">
              {mismatch ? (
                <div className={s.fieldError}>Passwords do not match.</div>
              ) : form.confirm && form.confirm === form.password ? (
                <div className={s.hint} style={{ color: "var(--ok)", display: "flex", gap: 4, alignItems: "center" }}>
                  <Icon name="check" size={14} /> Passwords match.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <h2 className={s.formSection}>
          <span className={s.formSectionNum}>2</span>
          Teaching profile
        </h2>
        <div className={s.fieldRow}>
          <div className={s.field}>
            <label className={s.label} htmlFor="major">
              Major
            </label>
            <select id="major" className={s.select} value={form.major} onChange={set("major")} aria-describedby="major-help" required>
              <option value="" disabled>
                Choose your major
              </option>
              {MAJORS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <div id="major-help" className={s.hint}>
              You&apos;ll review shared questions from instructors in the same major.
            </div>
          </div>
          <div className={s.field}>
            <label className={s.label} htmlFor="degree">
              Highest degree
            </label>
            <select id="degree" className={s.select} value={form.degree} onChange={set("degree")} required>
              <option value="" disabled>
                Choose a degree
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
            placeholder="e.g. American University of Beirut"
            maxLength={150}
            value={form.university}
            onChange={set("university")}
            required
          />
        </div>
        <div className={s.field}>
          <div className={s.labelRow}>
            <label className={s.label} htmlFor="course">
              Courses you teach
            </label>
            {courses.length > 0 && (
              <span className={s.optional}>
                {courses.length} / {MAX_COURSES}
              </span>
            )}
          </div>
          <div className={s.courseInput}>
            <input
              id="course"
              className={s.input}
              placeholder="Type a course and press Enter"
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
              <Icon name="plus" size={16} />
              Add
            </button>
          </div>
          {courses.length > 0 ? (
            <ul className={s.courseChips} aria-label="Courses added">
              {courses.map((c) => (
                <li key={c} className={s.courseChip}>
                  {c}
                  <button type="button" aria-label={`Remove ${c}`} onClick={() => setCourses(courses.filter((x) => x !== c))}>
                    <Icon name="x" size={14} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div id="course-help" className={s.hint}>
              Add at least one, for example &ldquo;Calculus I&rdquo;.
            </div>
          )}
        </div>

        <h2 className={s.formSection}>
          <span className={s.formSectionNum}>3</span>
          Access
        </h2>
        <div className={s.field}>
          <label className={s.label} htmlFor="inviteCode">
            Invite code
          </label>
          <input
            id="inviteCode"
            className={s.input}
            autoComplete="off"
            spellCheck={false}
            value={form.inviteCode}
            onChange={set("inviteCode")}
            aria-describedby="invite-help"
            required
          />
          <div id="invite-help" className={s.hint}>
            Accounts are for instructors only. Your administrator gives you this code.
          </div>
        </div>

        <button className={`${s.button} ${s.block}`} disabled={busy} style={{ marginTop: 12 }}>
          {busy ? "Creating your account…" : "Create account"}
        </button>
      </form>
      <p className={s.switchAuth}>
        Already have an account? <Link href="/instructor/login">Sign in</Link>
      </p>
    </AuthShell>
  );
}
