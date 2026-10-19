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
  createdAt: string;
  curriculum: { id: string; name: string };
  chapter: { id: string; title: string; orderIndex: number };
  createdBy: { id: string; name: string };
  approvedBy: { id: string; name: string } | null;
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
