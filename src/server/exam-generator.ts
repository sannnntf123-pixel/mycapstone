// Exam assembly: picks a set of bank questions that fills the requested time as
// closely as possible without going over, matches the requested difficulty,
// covers every chosen chapter and prefers questions used less (and less recently).
//
// Pure functions only (no database), so the rules are easy to read and test.

export type Candidate = {
  id: string;
  chapterId: string;
  difficulty: number; // 1..5
  minutes: number;
  timesUsed: number;
  lastUsedAt: Date | null;
};

export type ChapterRef = { id: string; title: string; orderIndex: number };

export type GenerateInput = {
  pool: Candidate[]; // approved, visible questions from the exam's course and chapters
  chapters: ChapterRef[]; // the chapters the instructor chose
  targetDifficulty: number | null; // null = mixed
  durationMinutes: number;
  random?: () => number; // injectable for deterministic tests
};

export type GenerateResult = { questionIds: string[]; totalMinutes: number; warnings: string[] };

export const DIFFICULTY_LABELS = ["Very easy", "Easy", "Medium", "Hard", "Very hard"];
/** A target accepts questions within one level of it (e.g. Medium = 2..4). */
export const DIFFICULTY_BAND = 1;
/** An exam is "full enough" at this share of the requested time. */
export const FILL_TARGET = 0.9;
const ATTEMPTS = 300;

export function inBand(difficulty: number, target: number | null) {
  return target === null || Math.abs(difficulty - target) <= DIFFICULTY_BAND;
}

const DAY = 86_400_000;

// Higher = more attractive. Fresh questions and on-target difficulty win.
function weight(q: Candidate, target: number | null, now: number) {
  const fit = target === null ? 1 : Math.exp(-1.2 * Math.abs(q.difficulty - target));
  const usage = 1 / (1 + 0.35 * q.timesUsed);
  const daysSince = q.lastUsedAt ? (now - q.lastUsedAt.getTime()) / DAY : Infinity;
  const recency = daysSince < 30 ? 0.4 : daysSince < 120 ? 0.75 : 1;
  return fit * usage * recency;
}

type Scored = { ids: string[]; minutes: number; score: number };

function score(picked: Candidate[], input: GenerateInput, coverableChapters: number, now: number): number {
  const minutes = picked.reduce((s, q) => s + q.minutes, 0);
  const timeGap = (input.durationMinutes - minutes) / input.durationMinutes; // 0 is perfect

  let difficultyPenalty: number;
  if (input.targetDifficulty === null) {
    // Mixed: reward using many levels and an average near the middle.
    const levels = new Set(picked.map((q) => q.difficulty)).size;
    const avg = picked.reduce((s, q) => s + q.difficulty, 0) / Math.max(1, picked.length);
    difficultyPenalty = (5 - levels) / 10 + Math.abs(avg - 3) / 4;
  } else {
    const avg = picked.reduce((s, q) => s + q.difficulty, 0) / Math.max(1, picked.length);
    difficultyPenalty = Math.abs(avg - input.targetDifficulty) / 2;
  }

  const covered = new Set(picked.map((q) => q.chapterId)).size;
  const coveragePenalty = coverableChapters ? (coverableChapters - covered) / coverableChapters : 0;

  const staleness = picked.reduce((s, q) => s + (1 - weight({ ...q, difficulty: 3 }, null, now)), 0) / Math.max(1, picked.length);

  // Time matters most, then coverage, then difficulty, then freshness.
  return 4 * timeGap + 2 * coveragePenalty + 1.5 * difficultyPenalty + 0.5 * staleness;
}

// One randomized greedy attempt: seed each chapter with one question, then fill.
function attempt(pool: Candidate[], input: GenerateInput, rand: () => number, now: number): Candidate[] {
  // Weighted random order (Efraimidis–Spirakis keys): heavier questions tend to come first.
  const ordered = pool
    .map((q) => ({ q, key: Math.pow(rand(), 1 / Math.max(1e-6, weight(q, input.targetDifficulty, now))) }))
    .sort((a, b) => b.key - a.key)
    .map((x) => x.q);

  const picked: Candidate[] = [];
  let used = 0;
  const take = (q: Candidate) => {
    picked.push(q);
    used += q.minutes;
  };

  // Mixed: walk difficulty levels round-robin so the spread stays even.
  if (input.targetDifficulty === null) {
    for (const ch of shuffle(input.chapters, rand)) {
      const q = ordered.find((c) => c.chapterId === ch.id && used + c.minutes <= input.durationMinutes && !picked.includes(c));
      if (q) take(q);
    }
    const byLevel = new Map<number, Candidate[]>();
    for (const q of ordered) if (!picked.includes(q)) byLevel.set(q.difficulty, [...(byLevel.get(q.difficulty) ?? []), q]);
    let progress = true;
    while (progress) {
      progress = false;
      for (const level of shuffle([1, 2, 3, 4, 5], rand)) {
        const list = byLevel.get(level);
        const i = list?.findIndex((c) => used + c.minutes <= input.durationMinutes) ?? -1;
        if (list && i >= 0) {
          take(list.splice(i, 1)[0]);
          progress = true;
        }
      }
    }
    return picked;
  }

  for (const ch of shuffle(input.chapters, rand)) {
    const q = ordered.find((c) => c.chapterId === ch.id && used + c.minutes <= input.durationMinutes);
    if (q) take(q);
  }
  for (const q of ordered) {
    if (!picked.includes(q) && used + q.minutes <= input.durationMinutes) take(q);
  }
  return picked;
}

function shuffle<T>(list: T[], rand: () => number): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function generateExam(input: GenerateInput): GenerateResult {
  const rand = input.random ?? Math.random;
  const now = Date.now();
  const warnings: string[] = [];
  const target = input.targetDifficulty;
  const chapterName = (c: ChapterRef) => `Chapter ${c.orderIndex} (${c.title})`;

  // Only questions inside the difficulty band are ever used; we warn rather than pad off-target.
  const eligible = input.pool.filter((q) => inBand(q.difficulty, target) && q.minutes <= input.durationMinutes);

  for (const ch of input.chapters) {
    const all = input.pool.filter((q) => q.chapterId === ch.id);
    if (all.length === 0) warnings.push(`${chapterName(ch)} has no approved questions yet.`);
    else if (!eligible.some((q) => q.chapterId === ch.id) && target !== null)
      warnings.push(`${chapterName(ch)} has no ${DIFFICULTY_LABELS[target - 1].toLowerCase()}-level questions (within one level).`);
  }

  if (eligible.length === 0) {
    warnings.unshift(
      target === null
        ? "No approved questions match these chapters."
        : `No approved questions match these chapters at ${DIFFICULTY_LABELS[target - 1].toLowerCase()} difficulty. Try Mixed or another level.`,
    );
    return { questionIds: [], totalMinutes: 0, warnings };
  }

  const coverable = new Set(eligible.map((q) => q.chapterId)).size;
  let best: Scored | null = null;
  for (let i = 0; i < ATTEMPTS; i++) {
    const picked = attempt(eligible, input, rand, now);
    if (picked.length === 0) continue;
    const s = score(picked, input, coverable, now);
    if (!best || s < best.score) {
      best = { ids: picked.map((q) => q.id), minutes: picked.reduce((t, q) => t + q.minutes, 0), score: s };
    }
  }
  if (!best) {
    warnings.unshift("Every matching question is longer than the exam duration.");
    return { questionIds: [], totalMinutes: 0, warnings };
  }

  // Present questions grouped by chapter order, easier first within a chapter.
  const byId = new Map(eligible.map((q) => [q.id, q]));
  const order = new Map(input.chapters.map((c) => [c.id, c.orderIndex]));
  const ids = [...best.ids].sort((a, b) => {
    const qa = byId.get(a)!;
    const qb = byId.get(b)!;
    return (order.get(qa.chapterId) ?? 0) - (order.get(qb.chapterId) ?? 0) || qa.difficulty - qb.difficulty;
  });

  if (best.minutes < FILL_TARGET * input.durationMinutes) {
    const available = eligible.reduce((s, q) => s + q.minutes, 0);
    warnings.unshift(
      available < FILL_TARGET * input.durationMinutes
        ? `Only ${best.minutes} of ${input.durationMinutes} minutes could be filled: the matching questions add up to ${available} minutes. Add chapters, choose Mixed difficulty, or shorten the exam.`
        : `Only ${best.minutes} of ${input.durationMinutes} minutes could be filled without going over. Question lengths don't add up exactly; try regenerating or adjusting the duration.`,
    );
  }

  return { questionIds: ids, totalMinutes: best.minutes, warnings };
}
