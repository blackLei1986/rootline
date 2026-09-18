import { describe, expect, it } from "vitest";
import { getRecommendedRoots, getRecommendedWords, getStageProgress } from "@/lib/course-engine";
import { generalEnglishCore } from "@/data/course";
import { createRootProgress, createWordProgress, EMPTY_STORAGE } from "@/lib/storage";

describe("course engine", () => {
  it("recommends spect first for a new learner", () => {
    const recommendations = getRecommendedRoots(structuredClone(EMPTY_STORAGE));
    expect(recommendations[0]?.id).toBe("spect");
  });

  it("selects core words before advanced words", () => {
    const words = getRecommendedWords("spect", structuredClone(EMPTY_STORAGE), 5);
    expect(words).toHaveLength(5);
    expect(words.every((word) => word.rootTier === "core")).toBe(true);
    expect(words.some((word) => word.id === "retrospect")).toBe(false);
  });

  it("keeps stage progress sensitive to coverage", () => {
    const storage = structuredClone(EMPTY_STORAGE);
    storage.roots.spect = { ...createRootProgress("spect"), mastery: 80, learnedWordIds: ["inspect"] };
    const progress = getStageProgress(generalEnglishCore.stages[0], storage);
    expect(progress.learnedRoots).toBe(1);
    expect(progress.percent).toBeLessThan(10);
  });

  it("does not select two forms from the same lemma family", () => {
    const storage = structuredClone(EMPTY_STORAGE);
    storage.words.predict = { ...createWordProgress("predict"), firstLearnedAt: "2026-01-01T00:00:00.000Z" };
    const words = getRecommendedWords("dict", storage, 8);
    const lemmas = words.map((word) => word.lemma);
    expect(new Set(lemmas).size).toBe(lemmas.length);
  });
});
