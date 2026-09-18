import { describe, expect, it } from "vitest";
import { createWordProgress } from "../lib/storage";
import { normalizeRating, scheduleNextReview } from "../lib/spaced-repetition";

const now = new Date("2026-09-17T00:00:00.000Z");

describe("scheduleNextReview", () => {
  it.each([
    ["again", 10],
    ["hard", 480],
    ["good", 1440],
    ["easy", 4320]
  ] as const)("schedules a first %s review", (rating, intervalMinutes) => {
    const result = scheduleNextReview({ progress: createWordProgress("inspect"), rating, now });
    expect(result.intervalMinutes).toBe(intervalMinutes);
    expect(new Date(result.nextReviewAt).getTime()).toBe(now.getTime() + intervalMinutes * 60_000);
  });

  it("expands the interval after repeated good ratings", () => {
    const first = scheduleNextReview({ progress: createWordProgress("inspect"), rating: "good", now });
    const second = scheduleNextReview({
      progress: {
        ...createWordProgress("inspect"),
        reviewCount: 1,
        intervalMinutes: first.intervalMinutes,
        memoryStrength: first.memoryStrength,
        difficulty: first.difficulty
      },
      rating: "good",
      now
    });
    expect(second.intervalMinutes).toBeGreaterThan(first.intervalMinutes);
  });

  it("compresses the interval and strength after again", () => {
    const progress = {
      ...createWordProgress("inspect"),
      reviewCount: 4,
      intervalMinutes: 10_000,
      memoryStrength: 70,
      difficulty: 40
    };
    const result = scheduleNextReview({ progress, rating: "again", now });
    expect(result.intervalMinutes).toBeLessThan(progress.intervalMinutes);
    expect(result.memoryStrength).toBe(55);
    expect(result.difficulty).toBe(50);
    expect(result.status).toBe("learning");
  });

  it("clamps memory strength and difficulty", () => {
    const high = scheduleNextReview({
      progress: { ...createWordProgress("inspect"), reviewCount: 4, memoryStrength: 98, difficulty: 2, intervalMinutes: 1000 },
      rating: "easy",
      now
    });
    expect(high.memoryStrength).toBe(100);
    expect(high.difficulty).toBe(0);

    const low = scheduleNextReview({
      progress: { ...createWordProgress("inspect"), reviewCount: 4, memoryStrength: 2, difficulty: 98, intervalMinutes: 1000 },
      rating: "again",
      now
    });
    expect(low.memoryStrength).toBe(0);
    expect(low.difficulty).toBe(100);
  });

  it("only marks a word mastered after stable repetition", () => {
    const result = scheduleNextReview({
      progress: { ...createWordProgress("inspect"), reviewCount: 4, memoryStrength: 78, difficulty: 30, intervalMinutes: 5000 },
      rating: "good",
      now
    });
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
