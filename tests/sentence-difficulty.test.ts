import { describe, expect, test } from "vitest";
import { calculateSentenceKnownWordRatio, estimateSentenceDifficulty } from "@/lib/sentence-difficulty";
import { words } from "@/data/words";

describe("sentence difficulty", () => {
  test("known-word ratio is deterministic", () => {
    expect(calculateSentenceKnownWordRatio("The new policy had a significant impact.", new Set(["the", "new", "policy", "had", "a", "impact"]))).toBe(0.86);
  });
  test("longer academic context ranks above a simple sentence", () => {
    expect(estimateSentenceDifficulty("The study found a significant relationship between sleep duration and academic performance.", words)).toBeGreaterThan(estimateSentenceDifficulty("There was a significant change.", words));
  });
});
