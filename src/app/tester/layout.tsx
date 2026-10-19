import type { Metadata } from "next";
import { SessionProvider } from "./session";
import { TopBar } from "./components";
import s from "./tester.module.css";

export const metadata: Metadata = {
  title: "API Tester",
  description: "Developer pages for exercising the question bank API.",
};

export default function TesterLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className={s.shell}>
        <TopBar />
        {children}
      </div>
    </SessionProvider>
  );
}
