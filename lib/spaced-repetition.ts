import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from "ts-fsrs";
import type {
  LearningStatus,
  ReviewRating,
  WordProgress
} from "@/types/progress";

/**
 * Standard FSRS scheduler (ts-fsrs / FSRS-6).
 *
 * This module is a thin adapter over the ts-fsrs library. It maps the app's
 * per-word `WordProgress` onto a ts-fsrs `Card`, calls the FSRS `next`
 * scheduling step, and maps the result back onto `WordProgress`.
 *
 * Four-grade rating is preserved: Again / Hard / Good / Easy.
 */

const MINUTES_PER_DAY = 24 * 60;
const MAX_INTERVAL_MINUTES = 365 * MINUTES_PER_DAY;

/** A word is considered "mastered" once its FSRS stability reaches this (days). */
const MASTERED_STABILITY_DAYS = 21;

// One shared scheduler instance — FSRS parameters are deterministic.
const scheduler = fsrs();

const RATING_TO_GRADE: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy
};

export interface ScheduleInput {
  progress: WordProgress;
  rating: ReviewRating;
  now?: Date;
}

export interface ScheduleResult {
  nextReviewAt: string;
  memoryStrength: number;
  difficulty: number;
  status: LearningStatus;
  intervalMinutes: number;
  /** FSRS stability in days. */
  stability: number;
  /** FSRS card state (0=New 1=Learning 2=Review 3=Relearning). */
  fsrsState: number;
  /** FSRS completed learning steps. */
  learningSteps: number;
  /** FSRS repetition count (mirrors WordProgress.reviewCount). */
  reviewCount: number;
  /** FSRS lapse count (mirrors WordProgress.lapses). */
  lapses: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Map FSRS stability (days) onto the app's 0..100 `memoryStrength` display scale. */
function stabilityToStrength(stability: number): number {
  return Math.round(clamp(100 * (1 - Math.exp(-stability / 13)), 0, 100));
}

/** Map FSRS card state onto the app's coarse `LearningStatus`. */
function stateToStatus(state: State, stability: number): LearningStatus {
  switch (state) {
    case State.New:
      return "new";
    case State.Learning:
    case State.Relearning:
      return "learning";
    case State.Review:
      return stability >= MASTERED_STABILITY_DAYS ? "mastered" : "review";
    default:
      return "review";
  }
}

/** Reconstruct a ts-fsrs `Card` from a persisted `WordProgress`. */
function toFsrsCard(progress: WordProgress, now: Date): Card {
  // A brand-new word has no scheduling history — let FSRS start from scratch.
  if (progress.reviewCount === 0) {
    return createEmptyCard(now);
  }

  // Legacy records predating the FSRS migration lack an explicit stability;
  // approximate it from the previous interval so old progress stays usable.
  const stability =
    progress.stability > 0
      ? progress.stability
      : Math.max(progress.intervalMinutes / MINUTES_PER_DAY, 0.01);

  const state =
    progress.fsrsState > 0
      ? (progress.fsrsState as State)
      : progress.lastRating === "again"
        ? State.Relearning
        : State.Review;

  const lastReviewedAt = progress.lastReviewedAt ? new Date(progress.lastReviewedAt) : now;
  const due = progress.nextReviewAt ? new Date(progress.nextReviewAt) : now;

  return {
    due,
    stability,
    difficulty: clamp(progress.difficulty / 10, 1, 10),
    elapsed_days: Math.max(0, (now.getTime() - lastReviewedAt.getTime()) / 86_400_000),
    scheduled_days: Math.max(progress.intervalMinutes / MINUTES_PER_DAY, 0),
    learning_steps: progress.learningSteps ?? 0,
    reps: progress.reviewCount,
    lapses: progress.lapses,
    state,
    last_review: lastReviewedAt
  };
}

export function normalizeRating(
  rating: ReviewRating,
  quizCorrect: boolean
): ReviewRating {
  if (quizCorrect) return rating;
  if (rating === "again") return "again";
  return "hard";
}

export function scheduleNextReview({
  progress,
  rating,
  now = new Date()
}: ScheduleInput): ScheduleResult {
  const card = toFsrsCard(progress, now);
  const { card: next } = scheduler.next(card, now, RATING_TO_GRADE[rating]);

  const intervalMinutes = Math.max(
    1,
    Math.round((next.due.getTime() - now.getTime()) / 60_000)
  );
  const clampedInterval = clamp(intervalMinutes, 1, MAX_INTERVAL_MINUTES);
  const stability = next.stability;
  const difficulty = clamp(Math.round(next.difficulty * 10), 0, 100);
  const memoryStrength = stabilityToStrength(stability);
  const status = stateToStatus(next.state, stability);

  return {
    nextReviewAt: new Date(now.getTime() + clampedInterval * 60_000).toISOString(),
    memoryStrength,
    difficulty,
    status,
    intervalMinutes: clampedInterval,
    stability,
    fsrsState: next.state as number,
    learningSteps: next.learning_steps,
    reviewCount: next.reps,
    lapses: next.lapses
  };
}

export function isDueForReview(
  progress: WordProgress,
  now: Date = new Date()
): boolean {
  if (!progress.nextReviewAt) return false;
  return new Date(progress.nextReviewAt).getTime() <= now.getTime();
}
