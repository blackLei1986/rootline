// @vitest-environment node

import { describe, expect, it } from "vitest";
import { EMPTY_STORAGE, createWordProgress } from "@/lib/storage";
import { analyzeArticleForLearner } from "@/lib/reading/analyze-production";

describe("production vocabulary article analysis", () => {
  it("matches inflected surface forms through the 9000-lemma index", async () => {
    const learner = structuredClone(EMPTY_STORAGE);
    learner.words.analysis = {
      ...createWordProgress("analysis"),
      recognitionState: "known",
      status: "review"
    };
    const result = await analyzeArticleForLearner(
      {
        id: "article-1",
        title: "Analysis in context",
        text: "Analyses improve understanding when readers compare evidence and inspect recurring patterns. ".repeat(20),
        wordCount: 200
      },
      learner,
      new Date("2026-09-17T00:00:00.000Z")
    );

    expect(result.vocabularyVersion).toBeTruthy();
    expect(result.lexicalMatches.find((item) => item.lemma === "analysis")?.occurrences).toBe(20);
    expect(result.contentWordCoverage).toBeGreaterThan(0);
  });
});
