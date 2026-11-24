import Link from "next/link";
import { Icon } from "@/components/Icon";
import s from "../instructor.module.css";

// Switches between writing a question by hand and generating drafts with AI.
export function PostModeSwitch({ active }: { active: "manual" | "ai" }) {
  const items = [
    { key: "manual", href: "/instructor/questions/new", label: "Write it yourself", icon: "pencil" },
    { key: "ai", href: "/instructor/questions/ai", label: "Generate with AI", icon: "sparkles" },
  ] as const;
  return (
    <nav className={s.modeSwitch} aria-label="How to add questions">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          className={`${s.modeTab} ${active === i.key ? s.modeTabActive : ""}`}
          aria-current={active === i.key ? "page" : undefined}
        >
          <Icon name={i.icon} size={16} />
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
