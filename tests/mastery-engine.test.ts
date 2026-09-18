import { describe, expect, it } from "vitest";
import { calculateMasterySummary, calculateRetention, calculateWordMastery } from "@/lib/mastery-engine";
import { createWordProgress, migrateStorage } from "@/lib/storage";

describe("mastery engine", () => {
  it("does not turn a one-time known signal into stable mastery", () => {
    const progress = { ...createWordProgress("alpha"), knownCount: 1, recognitionState: "known" as const, firstLearnedAt: "2026-09-17T00:00:00Z" };
    const mastery = calculateWordMastery("alpha", progress, [], new Date("2026-09-17T12:00:00Z"));
    expect(mastery.recognized).toBe(true);
    expect(mastery.stable).toBe(false);
    expect(mastery.level).toBe("recognized");
  });

  it("requires delayed evidence for stable and active recall evidence for active", () => {
    const progress = { ...createWordProgress("alpha"), knownCount: 1, correctCount: 3, reviewCount: 3, memoryStrength: 70, firstLearnedAt: "2026-09-15T00:00:00Z", lastReviewedAt: "2026-09-17T00:00:00Z", nextReviewAt: "2026-09-20T00:00:00Z", averageResponseTime: 2500, lastRating: "good" as const };
    const events = [{ id: "1", type: "quiz_correct" as const, timestamp: "2026-09-17T00:00:00Z", wordId: "alpha", metadata: { activeRecall: true } }];
    const mastery = calculateWordMastery("alpha", progress, events, new Date("2026-09-17T12:00:00Z"));
    expect(mastery.stable).toBe(true);
    expect(mastery.active).toBe(true);
    expect(mastery.fluent).toBe(false);
  });

  it("lets stable vocabulary decline when review is badly overdue", () => {
    const progress = { ...createWordProgress("alpha"), knownCount: 1, correctCount: 4, memoryStrength: 80, firstLearnedAt: "2026-07-01T00:00:00Z", lastReviewedAt: "2026-07-10T00:00:00Z", nextReviewAt: "2026-08-01T00:00:00Z", lastRating: "good" as const };
    expect(calculateWordMastery("alpha", progress, [], new Date("2026-09-17T00:00:00Z")).stable).toBe(false);
  });

  it("calculates retention from review outcomes inside the requested window", () => {
    const storage = migrateStorage({ events: [
      { id: "1", type: "review_completed", timestamp: "2026-09-16T00:00:00Z", metadata: { correct: true } },
      { id: "2", type: "review_completed", timestamp: "2026-09-15T00:00:00Z", metadata: { correct: false } },
      { id: "3", type: "review_completed", timestamp: "2026-08-01T00:00:00Z", metadata: { correct: true } }
    ] });
    expect(calculateRetention(storage, 7, new Date("2026-09-17T00:00:00Z"))).toEqual({ percent: 50, attempts: 2 });
    expect(calculateMasterySummary(storage).recognized).toBe(0);
  });
});
