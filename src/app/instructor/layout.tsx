import type { Metadata } from "next";
import { SessionProvider } from "@/lib/client/session";
import s from "./instructor.module.css";

export const metadata: Metadata = {
  title: { default: "Question Bank", template: "%s · Question Bank" },
};

export default function InstructorRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className={s.root}>{children}</div>
    </SessionProvider>
  );
}
