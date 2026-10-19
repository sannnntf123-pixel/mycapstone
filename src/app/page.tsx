import Link from "next/link";

export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "80px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif", lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 24 }}>Exam Question Bank</h1>
      <p>
        <Link href="/instructor">Instructor sign in</Link>: post questions and manage your question bank.
      </p>
      <p style={{ color: "#6b7280", fontSize: 14 }}>
        Developers: the <Link href="/tester">API tester pages</Link> exercise every endpoint directly.
      </p>
    </main>
  );
}
