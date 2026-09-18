import type {
  LearningStatus,
  ReviewRating,
  WordProgress
} from "@/types/progress";

const MINUTES_PER_DAY = 24 * 60;
const MAX_INTERVAL_MINUTES = 180 * MINUTES_PER_DAY;

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
}

const initialIntervals: Record<ReviewRating, number> = {
  again: 10,
  hard: 8 * 60,
  good: MINUTES_PER_DAY,
  easy: 3 * MINUTES_PER_DAY
};

const strengthDelta: Record<ReviewRating, number> = {
  again: -15,
  hard: 3,
  good: 8,
  easy: 15
};

const difficultyDelta: Record<ReviewRating, number> = {
  again: 10,
  hard: 5,
  good: -2,
  easy: -5
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function nextInterval(progress: WordProgress, rating: ReviewRating): number {
  if (progress.reviewCount === 0 || progress.intervalMinutes <= 0) {
    return initialIntervals[rating];
  }

  const previous = progress.intervalMinutes;
  const intervals: Record<ReviewRating, number> = {
    again: clamp(Math.round(previous * 0.15), 10, MINUTES_PER_DAY),
    hard: Math.max(30, Math.round(previous * 1.2)),
    good: Math.max(MINUTES_PER_DAY, Math.round(previous * 2.2)),
    easy: Math.max(3 * MINUTES_PER_DAY, Math.round(previous * 3.5))
  };
  return clamp(intervals[rating], 10, MAX_INTERVAL_MINUTES);
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
  const intervalMinutes = nextInterval(progress, rating);
  const initialStrength = progress.reviewCount === 0 ? 20 : progress.memoryStrength;
  const memoryStrength = clamp(initialStrength + strengthDelta[rating], 0, 100);
  const difficulty = clamp(progress.difficulty + difficultyDelta[rating], 0, 100);
  const reviewCount = progress.reviewCount + 1;

  let status: LearningStatus = reviewCount >= 2 ? "review" : "learning";
  if (rating === "again") status = "learning";
  if (memoryStrength >= 80 && reviewCount >= 5 && rating !== "again") {
    status = "mastered";
  }

  return {
    nextReviewAt: new Date(now.getTime() + intervalMinutes * 60_000).toISOString(),
    memoryStrength,
    difficulty,
    status,
    intervalMinutes
  };
}

export function isDueForReview(
  progress: WordProgress,
  now: Date = new Date()
): boolean {
  if (!progress.nextReviewAt) return false;
  return new Date(progress.nextReviewAt).getTime() <= now.getTime();
}
