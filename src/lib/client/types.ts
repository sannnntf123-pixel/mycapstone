export type Chapter = { id: string; title: string; orderIndex: number };
export type Curriculum = { id: string; name: string; description: string | null; chapters: Chapter[] };

export type Question = {
  id: string;
  content: string;
  options: string[] | null;
  answer: string;
  difficulty: number;
  estimatedTimeMinutes: number;
  source: string;
  status: string;
  visibility: string;
  rejectionReason: string | null;
  timesUsed: number;
  lastUsedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  createdAt: string;
  curriculum: { id: string; name: string };
  chapter: { id: string; title: string; orderIndex: number };
  createdBy: { id: string; name: string };
  approvedBy: { id: string; name: string } | null;
  rejectedBy: { id: string; name: string } | null;
};

export type QuestionPage = { items: Question[]; total: number; page: number; pageSize: number };

export type ApiError = { error?: string; details?: Record<string, string[] | undefined> };

// Turns an API error body into one readable sentence.
export function describeError(data: unknown, status: number): string {
  const err = (data ?? {}) as ApiError;
  if (status === 429) return "Too many attempts. Please wait a few minutes and try again.";
  if (err.details) {
    const first = Object.entries(err.details).find(([, msgs]) => msgs?.length);
    if (first) return `${first[0]}: ${first[1]![0]}`;
  }
  return err.error ?? `Request failed (HTTP ${status})`;
}

// ---------- exams ----------
export type ExamQuestion = {
  position: number;
  id: string;
  content: string;
  options: string[] | null;
  answer: string;
  difficulty: number;
  estimatedTimeMinutes: number;
  source: string;
  visibility: string;
  timesUsed: number;
  chapter: { id: string; title: string; orderIndex: number };
  createdBy: { id: string; name: string };
  approvedBy: { id: string; name: string } | null;
};

export type Exam = {
  id: string;
  title: string;
  status: "DRAFT" | "FINAL";
  curriculum: { id: string; name: string };
  chapters: { id: string; title: string; orderIndex: number }[];
  targetDifficulty: number | null;
  durationMinutes: number;
  totalMinutes: number;
  warnings: string[];
  finalizedAt: string | null;
  createdAt: string;
  updatedAt: string;
  questions: ExamQuestion[];
};

export type ExamSummary = {
  id: string;
  title: string;
  status: "DRAFT" | "FINAL";
  curriculum: { id: string; name: string };
  chapterCount: number;
  targetDifficulty: number | null;
  durationMinutes: number;
  questionCount: number;
  totalMinutes: number;
  finalizedAt: string | null;
  createdAt: string;
};

export type Availability = {
  curriculumId: string;
  targetDifficulty: number | null;
  chapters: { id: string; title: string; orderIndex: number; approved: number; matching: number; matchingMinutes: number }[];
};

export const DIFFICULTY_LABELS = ["Very easy", "Easy", "Medium", "Hard", "Very hard"];
export const difficultyLabel = (d: number | null) => (d === null ? "Mixed" : DIFFICULTY_LABELS[d - 1]);
