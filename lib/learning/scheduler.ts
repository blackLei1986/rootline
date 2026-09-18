/**
 * Adaptive spaced-repetition scheduler (v1).
 *
 * A simplified FSRS-style model. Unlike fixed Ebbinghaus dates, the next
 * review interval is recomputed from the learner's rating together with two
 * per-word state variables:
 *
 *   - `stability`  (S): how long a memory trace survives, in days.
 *   - `difficulty` (D): intrinsic difficulty of the word (1..10).
 *
 * Four-grade rating: Again(0) / Hard(1) / Good(2) / Easy(3).
 *
 * The module is pure (no I/O, no React) so it is trivially unit-testable and
 * can be swapped for a full FSRS implementation later.
 */

export const MINUTES_PER_DAY = 24 * 60;

/** Four-grade review rating. */
export const RATING = {
  AGAIN: 0,
  HARD: 1,
  GOOD: 2,
  EASY: 3,
} as const;
export type Rating = (typeof RATING)[keyof typeof RATING];

export type WordState = "new" | "learning" | "review" | "mastered";

/** Question types supported by review_logs.question_type. */
export const QUESTION_TYPES = [
  "meaning_recall",
  "spelling",
  "listening",
  "sentence_cloze",
  "root_recognition",
  "english_definition",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** Learner's per-word SRS state (mirrors user_word_progress columns). */
export interface WordProgress {
  state: WordState;
  stability: number;
  difficulty: number;
  reviewCount: number;
  lapseCount: number;
  streak: number;
  lastRating: Rating | null;
  intervalDays: number;
}

/** Result of scheduling one review. */
export interface ScheduleResult {
  state: WordState;
  stability: number;
  difficulty: number;
  familiarity: number;
  reviewCount: number;
  lapseCount: number;
  streak: number;
  lastRating: Rating;
  intervalDays: number;
  nextReviewAt: string; // ISO 8601
  mastered: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Interval (days) after the FIRST feedback on a brand-new word. */
export const NEW_INTERVAL_DAYS: Record<Rating, number> = {
  [RATING.AGAIN]: 10 / MINUTES_PER_DAY, // ~10 minutes
  [RATING.HARD]: 1,
  [RATING.GOOD]: 2,
  [RATING.EASY]: 4,
};

/** Difficulty shift per rating. */
export const DIFFICULTY_DELTA: Record<Rating, number> = {
  [RATING.AGAIN]: +1.0,
  [RATING.HARD]: +0.5,
  [RATING.GOOD]: -0.3,
  [RATING.EASY]: -0.8,
};

/** Stability multiplier per rating (review phase). */
export const STABILITY_GROWTH: Record<Rating, number> = {
  [RATING.AGAIN]: 0.5, // recall failure -> stability decays
  [RATING.HARD]: 1.2,
  [RATING.GOOD]: 1.8,
  [RATING.EASY]: 2.5,
};

export const INITIAL_DIFFICULTY = 5;
export const DIFFICULTY_MIN = 1;
export const DIFFICULTY_MAX = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Difficulty dampens stability growth: a hard word (D high) grows slower than
 * an easy one (D low). At D=5 the factor is 1.0.
 */
function difficultyFactor(difficulty: number): number {
  return round(1 + (INITIAL_DIFFICULTY - difficulty) * 0.1, 4);
}

function errorRate(progress: Pick<WordProgress, "lapseCount" | "reviewCount">): number {
  if (progress.reviewCount <= 0) return 0;
  return progress.lapseCount / progress.reviewCount;
}

// ---------------------------------------------------------------------------
// Familiarity
// ---------------------------------------------------------------------------

/**
 * Familiarity (0..100): stability (50%) + streak (30%) + accuracy (20%).
 */
export function calculateFamiliarity(progress: WordProgress): number {
  const stabilityScore = clamp(progress.stability / 30, 0, 1) * 50;
  const streakScore = clamp(progress.streak / 4, 0, 1) * 30;
  const accuracyScore = (1 - errorRate(progress)) * 20;
  return Math.round(clamp(stabilityScore + streakScore + accuracyScore, 0, 100));
}

// ---------------------------------------------------------------------------
// Mastery
// ---------------------------------------------------------------------------

/**
 * Mastered requires: streak >= 4, stability >= 30 days, interval >= 21 days,
 * and a low error rate (lapse / review <= 0.2). One correct answer is NOT
 * enough. Mastered words still come back for long-term review.
 */
export function isMastered(progress: WordProgress): boolean {
  return (
    progress.streak >= 4 &&
    progress.stability >= 30 &&
    progress.intervalDays >= 21 &&
    errorRate(progress) <= 0.2
  );
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

export interface ScheduleInput {
  progress: WordProgress;
  rating: Rating;
  now?: Date;
}

/**
 * Compute the next review schedule from a rating.
 *
 * New word (reviewCount === 0):
 *   interval = NEW_INTERVAL_DAYS[rating] (Again 10min / Hard 1d / Good 2d / Easy 4d).
 *
 * Review phase:
 *   - difficulty is nudged by DIFFICULTY_DELTA.
 *   - Again: stability decays, lapse_count++, streak resets, interval -> 10min.
 *   - Hard/Good/Easy: stability grows by STABILITY_GROWTH * difficultyFactor,
 *     streak++, interval -> new stability.
 */
export function scheduleReview({ progress, rating, now = new Date() }: ScheduleInput): ScheduleResult {
  const isNew = progress.reviewCount === 0;

  let stability = progress.stability;
  let difficulty = progress.difficulty;
  let streak = progress.streak;
  let lapseCount = progress.lapseCount;
  let state: WordState = progress.state;
  let intervalDays: number;

  if (isNew) {
    intervalDays = NEW_INTERVAL_DAYS[rating];
    stability = intervalDays;
    difficulty = clamp(INITIAL_DIFFICULTY + DIFFICULTY_DELTA[rating], DIFFICULTY_MIN, DIFFICULTY_MAX);
    streak = rating >= RATING.GOOD ? 1 : 0;
    lapseCount = rating === RATING.AGAIN ? 1 : 0;
    state = rating === RATING.AGAIN ? "learning" : "review";
  } else {
    difficulty = clamp(difficulty + DIFFICULTY_DELTA[rating], DIFFICULTY_MIN, DIFFICULTY_MAX);
    if (rating === RATING.AGAIN) {
      stability = Math.max(stability * STABILITY_GROWTH[RATING.AGAIN], NEW_INTERVAL_DAYS[RATING.AGAIN]);
      lapseCount += 1;
      streak = 0;
      intervalDays = NEW_INTERVAL_DAYS[RATING.AGAIN];
      state = "learning";
    } else {
      stability = stability * STABILITY_GROWTH[rating] * difficultyFactor(difficulty);
      streak += 1;
      intervalDays = stability;
      state = "review";
    }
  }

  const reviewCount = progress.reviewCount + 1;
  const next: WordProgress = {
    state,
    stability: round(stability),
    difficulty: round(difficulty),
    reviewCount,
    lapseCount,
    streak,
    lastRating: rating,
    intervalDays: round(intervalDays),
  };

  const mastered = isMastered(next);
  if (mastered) next.state = "mastered";

  return {
    state: next.state,
    stability: next.stability,
    difficulty: next.difficulty,
    familiarity: calculateFamiliarity(next),
    reviewCount: next.reviewCount,
    lapseCount: next.lapseCount,
    streak: next.streak,
    lastRating: rating,
    intervalDays: next.intervalDays,
    nextReviewAt: new Date(now.getTime() + next.intervalDays * MINUTES_PER_DAY * 60_000).toISOString(),
    mastered,
  };
}

// ---------------------------------------------------------------------------
// Priority
// ---------------------------------------------------------------------------

export interface PriorityInput {
  /** Days overdue (0 if not overdue). */
  overdueDays: number;
  stability: number;
  /** Frequency rank (smaller = more frequent). */
  frequencyRank: number;
  /** Number of exam tags (IELTS/TOEFL/CET/GRE). */
  examTagCount: number;
  /** Reading exposure count. */
  readingExposure: number;
  /** Accumulated lapses (error history). */
  lapseCount: number;
}

/**
 * Priority score (0..1) combining overdue, memory risk, frequency, exam tags,
 * reading exposure and error history. Higher = review sooner.
 * High-frequency words outrank low-frequency ones (frequencyScore).
 */
export function calculatePriority(input: PriorityInput): number {
  const overdueScore = clamp(input.overdueDays / 30, 0, 1);
  const memoryRisk = 1 - clamp(input.stability / 30, 0, 1);
  const frequencyScore = 1 / (1 + Math.max(0, input.frequencyRank) / 1000);
  const examScore = clamp(input.examTagCount / 3, 0, 1);
  const readingScore = clamp(input.readingExposure / 10, 0, 1);
  const errorScore = clamp(input.lapseCount / 10, 0, 1);

  const score =
    0.3 * overdueScore +
    0.25 * memoryRisk +
    0.2 * frequencyScore +
    0.1 * examScore +
    0.05 * readingScore +
    0.1 * errorScore;

  return round(clamp(score, 0, 1));
}

// ---------------------------------------------------------------------------
// Daily queue
// ---------------------------------------------------------------------------

export interface QueueItem {
  wordId: string;
  priorityScore: number;
  frequencyRank: number;
  overdueDays: number;
}

export interface QueueInput {
  overdue: QueueItem[];
  weak: QueueItem[];
  newWords: QueueItem[];
  targetCount: number;
}

export interface QueueResult {
  overdue: QueueItem[];
  weak: QueueItem[];
  newWords: QueueItem[];
}

/**
 * Compose the daily queue. Default split is 60% overdue / 20% weak / 20% new.
 * When overdue backlog is severe (more overdue items than the target), the
 * new-word share is automatically reduced (85% / 10% / 5%).
 *
 * Input lists are sorted deterministically inside:
 *   - overdue   by overdueDays desc
 *   - weak      by priorityScore desc
 *   - newWords  by frequencyRank asc (high-frequency first)
 */
export function selectDailyQueue(input: QueueInput): QueueResult {
  const { overdue, weak, newWords, targetCount } = input;

  const backlogSevere = overdue.length > targetCount;
  const ratio = backlogSevere
    ? { overdue: 0.85, weak: 0.1, new: 0.05 }
    : { overdue: 0.6, weak: 0.2, new: 0.2 };

  const overdueSorted = [...overdue].sort((a, b) => b.overdueDays - a.overdueDays);
  const weakSorted = [...weak].sort((a, b) => b.priorityScore - a.priorityScore);
  const newSorted = [...newWords].sort((a, b) => a.frequencyRank - b.frequencyRank);

  let overdueQuota = Math.round(targetCount * ratio.overdue);
  let weakQuota = Math.round(targetCount * ratio.weak);
  let newQuota = targetCount - overdueQuota - weakQuota;

  const take = (list: QueueItem[], count: number) => list.slice(0, Math.max(0, count));

  let overduePick = take(overdueSorted, overdueQuota);
  let weakPick = take(weakSorted, weakQuota);
  let newPick = take(newSorted, newQuota);

  // Backfill unused quota: overdue gap -> weak -> new.
  let gap = overdueQuota - overduePick.length;
  if (gap > 0) {
    const add = take(weakSorted.slice(weakPick.length), gap);
    weakPick = weakPick.concat(add);
    gap -= add.length;
  }
  if (gap > 0) {
    const add = take(newSorted.slice(newPick.length), gap);
    newPick = newPick.concat(add);
    gap -= add.length;
  }

  // weak gap -> new
  gap = weakQuota - weakPick.length;
  if (gap > 0) {
    newPick = newPick.concat(take(newSorted.slice(newPick.length), gap));
  }

  return { overdue: overduePick, weak: weakPick, newWords: newPick };
}
