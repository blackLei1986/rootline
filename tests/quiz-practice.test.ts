import { describe, expect, it } from "vitest";
import { buildPracticeQueue, insertPracticeReinforcement } from "@/lib/quiz-practice";
import { createWordProgress, EMPTY_STORAGE } from "@/lib/storage";

describe("quiz practice", () => {
  it("builds a bounded queue using all five quiz modes", () => {
    const storage = structuredClone(EMPTY_STORAGE);
    storage.words.inspect = { ...createWordProgress("inspect"), firstLearnedAt: "2026-01-01T00:00:00.000Z" };
    const queue = buildPracticeQueue(["inspect"], storage, new Date("2026-01-02T00:00:00.000Z"));
    expect(queue).toHaveLength(5);
    expect(new Set(queue.map((item) => item.type)).size).toBe(5);
    expect(queue.every((item) => item.sourceWordId === "inspect")).toBe(true);
  });

  it("repeats a wrong item only after a two-to-five item gap", () => {
    const storage = structuredClone(EMPTY_STORAGE);
    const queue = buildPracticeQueue(["inspect", "respect", "expect", "suspect", "prospect"], storage);
    const next = insertPracticeReinforcement(queue, 0, 0, () => 0);
    expect(next[3].sourceWordId).toBe(queue[0].sourceWordId);
    expect(next[3].id).toContain("repeat-1");
  });

  it("caps quick reinforcement at three repeats", () => {
    const storage = structuredClone(EMPTY_STORAGE);
    const queue = buildPracticeQueue(["inspect"], storage);
    expect(insertPracticeReinforcement(queue, 0, 3)).toBe(queue);
  });

  it("keeps rootless high-frequency words in word-level review", () => {
    const storage = structuredClone(EMPTY_STORAGE);
    const queue = buildPracticeQueue(["significant"], storage);
    expect(queue).toHaveLength(5);
    expect(queue.every((item) => item.type !== "root-to-meaning" && item.type !== "word-to-root")).toBe(true);
  });
});
