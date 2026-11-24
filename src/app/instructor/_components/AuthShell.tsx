"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon, LogoMark } from "@/components/Icon";
import s from "../instructor.module.css";

const points = [
  { icon: "layers", text: "Questions organised by course, chapter and difficulty" },
  { icon: "shield", text: "Every question is peer-reviewed before it enters the bank" },
  { icon: "users", text: "Keep questions private, or share them with your department" },
] as const;

// Split-screen frame for sign-in and sign-up: brand panel on the left, form on the right.
export function AuthShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={s.auth}>
      <aside className={s.authAside}>
        <Link href="/" className={s.authBrand}>
          <LogoMark />
          Question Bank
        </Link>
        <div className={s.authPitch}>
          <h2>A shared bank of exam questions, reviewed by your peers.</h2>
          <p>Write a question once and reuse it in every exam you set.</p>
          <ul className={s.authPoints}>
            {points.map((p) => (
              <li key={p.text}>
                <Icon name={p.icon} />
                {p.text}
              </li>
            ))}
          </ul>
        </div>
        <p className={s.authFoot}>For instructors only. Students never see the question bank.</p>
      </aside>

      <main className={s.authMain}>
        <div className={s.authTop}>
          <Link href="/" className={s.authMobileBrand}>
            <LogoMark size={24} />
            Question Bank
          </Link>
          <Link href="/" style={{ marginLeft: "auto" }}>
            <Icon name="arrowLeft" size={16} />
            Back to home
          </Link>
        </div>
        <div className={`${s.authForm} ${wide ? s.authFormWide : ""}`}>{children}</div>
      </main>
    </div>
  );
}

export function FormError({ children }: { children: React.ReactNode }) {
  return (
    <div className={s.error} role="alert">
      <Icon name="alert" size={18} />
      <span>{children}</span>
    </div>
  );
}

type PasswordProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "className">;

export function PasswordInput(props: PasswordProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={s.inputWrap}>
      <input {...props} type={visible ? "text" : "password"} className={s.input} />
      <button
        type="button"
        className={s.inputAction}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
      >
        <Icon name={visible ? "eyeOff" : "eye"} size={18} />
      </button>
    </div>
  );
}
