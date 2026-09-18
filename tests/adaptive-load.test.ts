import { describe, expect, it } from "vitest";
import { calculateDailyLoad, calculateReviewDebt } from "@/lib/adaptive-load";
import { buildRecoveryPlan } from "@/lib/recovery-mode";
import { createWordProgress, EMPTY_STORAGE } from "@/lib/storage";
import { words } from "@/data/words";

const now = new Date("2026-09-17T12:00:00.000Z");

function withDueWords(count: number) {
  const storage = structuredClone(EMPTY_STORAGE);
  for (const word of words.slice(0, count)) {
    storage.words[word.id] = {
      ...createWordProgress(word.id),
      status: "review",
      firstLearnedAt: "2026-09-01T00:00:00.000Z",
      nextReviewAt: "2026-09-16T00:00:00.000Z"
    };
  }
  return storage;
}

describe("adaptive daily load", () => {
  it("reduces new intake when review debt grows", () => {
    const lowDebt = calculateDailyLoad(withDueWords(2), now, 20);
    const highDebt = calculateDailyLoad(withDueWords(35), now, 20);
    expect(calculateReviewDebt(withDueWords(35), now)).toBe(35);
    expect(highDebt.newWords).toBeLessThan(lowDebt.newWords);
  });

  it("increases intake for strong performance with low debt", () => {
    const storage = structuredClone(EMPTY_STORAGE);
    storage.words.inspect = {
      ...createWordProgress("inspect"),
      verificationCorrectCount: 8,
      correctCount: 8,
      memoryStrength: 90
    };
    expect(calculateDailyLoad(storage, now, 20).newWords).toBeGreaterThan(8);
  });

  it("enters recovery mode and caps the batch", () => {
    const storage = withDueWords(90);
    const plan = buildRecoveryPlan(storage, now, 80, 25);
    const load = calculateDailyLoad(storage, now, 20);
    expect(plan.active).toBe(true);
    expect(plan.wordIds).toHaveLength(25);
    expect(plan.deferredCount).toBe(65);
    expect(load.newWords).toBe(0);
    expect(load.reviewWords).toBe(25);
  });
});
