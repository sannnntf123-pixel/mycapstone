import Link from "next/link";

export default function Home() {
  return (
    <main style={{ maxWidth: 640, margin: "80px auto", padding: "0 16px", fontFamily: "system-ui, sans-serif", lineHeight: 1.6 }}>
      <h1 style={{ fontSize: 24 }}>Exam Question Bank</h1>
      <p>
        The back-end API is running. There is no user interface yet; use the{" "}
        <Link href="/tester">API tester pages</Link> to try every endpoint from the browser.
      </p>
    </main>
  );
}
