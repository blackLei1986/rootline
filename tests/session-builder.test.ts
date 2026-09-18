import { describe, expect, it } from "vitest";
import { buildTodaySession } from "../lib/session-builder";
import { createWordProgress, EMPTY_STORAGE } from "../lib/storage";

describe("buildTodaySession", () => {
  it("starts a new learner with a small spect group", () => {
    const session = buildTodaySession({
      storage: structuredClone(EMPTY_STORAGE),
      now: new Date("2026-09-17T00:00:00.000Z"),
      random: () => 0.5
    });
    expect(session.rootIds).toEqual(["spect"]);
    expect(session.newWordIds).toHaveLength(5);
    expect(session.newWordIds.every((id) => ["inspect", "respect", "expect", "suspect", "prospect"].includes(id))).toBe(true);
    expect(session.items[0].stage).toBe("root-intro");
  });

  it("puts overdue reviews into the session before adding unlimited new work", () => {
    const inspect = {
      ...createWordProgress("inspect"),
      status: "review" as const,
      nextReviewAt: "2026-09-16T00:00:00.000Z",
      firstLearnedAt: "2026-09-10T00:00:00.000Z"
    };
    const storage = structuredClone(EMPTY_STORAGE);
    storage.words.inspect = inspect;
    const session = buildTodaySession({
      storage,
      now: new Date("2026-09-17T00:00:00.000Z"),
      maxReviewWords: 1,
      random: () => 0.5
    });
    expect(session.reviewWordIds).toEqual(["inspect"]);
    expect(session.newWordIds).not.toContain("inspect");
  });

  it("keeps due reviews ahead of recent mistakes", () => {
    const storage = structuredClone(EMPTY_STORAGE);
    storage.words.inspect = {
      ...createWordProgress("inspect"),
      status: "review",
      firstLearnedAt: "2026-09-10T00:00:00.000Z",
      nextReviewAt: "2026-09-16T23:00:00.000Z",
      memoryStrength: 90,
      difficulty: 10
    };
    storage.words.suspect = {
      ...createWordProgress("suspect"),
      status: "learning",
      firstLearnedAt: "2026-09-10T00:00:00.000Z",
      nextReviewAt: "2026-09-20T00:00:00.000Z",
      lastRating: "again",
      lapses: 8,
      difficulty: 100
    };
    const session = buildTodaySession({
      storage,
      now: new Date("2026-09-17T00:00:00.000Z"),
      maxReviewWords: 2,
      random: () => 0.5
    });
    expect(session.reviewWordIds).toEqual(["inspect", "suspect"]);
  });
});
