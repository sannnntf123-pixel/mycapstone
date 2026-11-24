import Link from "next/link";
import { Icon, LogoMark, type IconName } from "@/components/Icon";
import s from "./page.module.css";

const features: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "layers",
    title: "Organised by course",
    body: "Every question lives under a curriculum and chapter, with difficulty and solving time, so the right one is easy to find.",
  },
  {
    icon: "shield",
    title: "Reviewed before use",
    body: "Nothing enters the bank until it's approved, and shared questions are approved by another instructor. Rejections always come with a reason.",
  },
  {
    icon: "lock",
    title: "Private or shared",
    body: "Keep a question to yourself, or share it with every instructor so the whole department can build on it.",
  },
];

const steps = [
  { title: "Write", body: "A guided five-step form walks you from course to answer." },
  { title: "Review", body: "A colleague approves a shared question, or tells you what to fix." },
  { title: "Reuse", body: "Approved questions join the bank, ready for your next exam." },
];

export default function Home() {
  return (
    <div className={s.page}>
      <header className={s.header}>
        <Link href="/" className={s.brand}>
          <LogoMark />
          Question Bank
        </Link>
        <nav className={s.headerNav}>
          <Link href="/instructor/login" className={s.headerLink}>
            Sign in
          </Link>
          <Link href="/instructor/signup" className={s.headerCta}>
            Create account
          </Link>
        </nav>
      </header>

      <main>
        <section className={s.hero}>
          <p className={s.kicker}>
            <Icon name="sparkles" size={14} />
            For university instructors
          </p>
          <h1 className={s.title}>
            Build exams from questions <em>your colleagues trust</em>.
          </h1>
          <p className={s.lede}>
            A shared bank of reviewed exam questions. Write once, get it reviewed, and reuse it across every course you teach.
          </p>
          <div className={s.ctas}>
            <Link href="/instructor/signup" className={s.primary}>
              Get started
              <Icon name="arrowRight" size={16} />
            </Link>
            <Link href="/instructor/login" className={s.secondary}>
              I already have an account
            </Link>
          </div>
          <p className={s.note}>Instructor accounts need an invite code from your administrator.</p>

          <HeroPreview />
        </section>

        <section className={s.features} aria-label="Features">
          {features.map((f) => (
            <article key={f.title} className={s.feature}>
              <span className={s.featureIcon}>
                <Icon name={f.icon} size={20} />
              </span>
              <h2>{f.title}</h2>
              <p>{f.body}</p>
            </article>
          ))}
        </section>

        <section className={s.how}>
          <h2 className={s.howTitle}>How it works</h2>
          <ol className={s.steps}>
            {steps.map((st, i) => (
              <li key={st.title}>
                <span className={s.stepNum}>{i + 1}</span>
                <div>
                  <h3>{st.title}</h3>
                  <p>{st.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className={s.footer}>
        <span>Exam Question Bank</span>
        <Link href="/tester">Developer API tester</Link>
      </footer>
    </div>
  );
}

// A static, illustrative card stack that shows what the product looks like.
function HeroPreview() {
  const rows = [
    { status: "APPROVED", label: "Approved", path: "Mathematics 101 › Derivatives", text: "Find the derivative of f(x) = 3x² − 5x + 2.", d: 2 },
    { status: "PENDING", label: "Pending review", path: "Intro to Programming › Loops", text: "What does the loop print when n = 4?", d: 3 },
    { status: "REJECTED", label: "Rejected", path: "Mathematics 101 › Limits", text: "Evaluate the limit of sin(x)/x as x → 0.", d: 4 },
  ];
  return (
    <div className={s.preview} aria-hidden>
      <div className={s.previewBar}>
        <span />
        <span />
        <span />
      </div>
      <div className={s.previewBody}>
        {rows.map((r) => (
          <div key={r.text} className={s.previewRow}>
            <div>
              <div className={s.previewPath}>{r.path}</div>
              <div className={s.previewText}>{r.text}</div>
              <div className={s.previewDots}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <i key={n} data-on={n <= r.d ? "" : undefined} />
                ))}
              </div>
            </div>
            <span className={s.previewBadge} data-status={r.status}>
              {r.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
