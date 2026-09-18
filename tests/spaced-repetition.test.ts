import { describe, expect, it } from "vitest";
import { createWordProgress } from "../lib/storage";
import { normalizeRating, scheduleNextReview } from "../lib/spaced-repetition";
import type { ReviewRating, WordProgress } from "../types/progress";

const now = new Date("2026-09-17T00:00:00.000Z");

/** Feed a schedule result back into a progress record, mimicking a real review. */
function chain(progress: WordProgress, rating: ReviewRating): WordProgress {
  const result = scheduleNextReview({ progress, rating, now });
  return {
    ...progress,
    ...result,
    reviewCount: result.reviewCount,
    lapses: result.lapses,
    lastRating: rating,
    lastReviewedAt: now.toISOString()
  };
}

describe("scheduleNextReview (ts-fsrs / FSRS-6, short-term learning steps)", () => {
  it.each([
    ["again", 1],
    ["hard", 6],
    ["good", 10],
    ["easy", 11520]
  ] as const)("schedules a first %s review at the FSRS interval", (rating, intervalMinutes) => {
    const result = scheduleNextReview({ progress: createWordProgress("inspect"), rating, now });
    expect(result.intervalMinutes).toBe(intervalMinutes);
    expect(new Date(result.nextReviewAt).getTime()).toBe(now.getTime() + intervalMinutes * 60_000);
  });

  it("expands the interval after repeated good ratings (learn → graduate)", () => {
    let progress = createWordProgress("inspect");
    const intervals: number[] = [];
    for (let i = 0; i < 3; i++) {
      progress = chain(progress, "good");
      intervals.push(progress.intervalMinutes);
    }
    expect(intervals[0]).toBe(10);
    expect(intervals[1]).toBeGreaterThan(intervals[0]);
    expect(intervals[2]).toBeGreaterThan(intervals[1]);
  });

  it("compresses the interval and re-enters learning after again", () => {
    let progress = createWordProgress("inspect");
    for (let i = 0; i < 4; i++) progress = chain(progress, "good");
    expect(progress.intervalMinutes).toBeGreaterThan(1440);

    const result = scheduleNextReview({ progress, rating: "again", now });
    expect(result.intervalMinutes).toBeLessThan(progress.intervalMinutes);
    expect(result.status).toBe("learning");
    expect(result.lapses).toBeGreaterThan(progress.lapses);
  });

  it("marks a word mastered once FSRS stability passes the threshold", () => {
    const progress: WordProgress = {
      ...createWordProgress("inspect"),
      reviewCount: 10,
      lapses: 0,
      stability: 25,
      fsrsState: 2,
      learningSteps: 0,
      difficulty: 20,
      intervalMinutes: 25 * 1440,
      lastRating: "good",
      lastReviewedAt: new Date("2026-09-01T00:00:00.000Z").toISOString(),
      nextReviewAt: now.toISOString()
    };
    const result = scheduleNextReview({ progress, rating: "good", now });
    expect(result.status).toBe("mastered");
  });
});

describe("normalizeRating", () => {
  it("caps an incorrect easy rating at hard", () => {
    expect(normalizeRating("easy", false)).toBe("hard");
    expect(normalizeRating("good", false)).toBe("hard");
    expect(normalizeRating("again", false)).toBe("again");
    expect(normalizeRating("easy", true)).toBe("easy");
  });
});
