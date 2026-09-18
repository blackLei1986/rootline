import { describe, expect, it } from "vitest";
import { rankArticleCandidates, type ArticleRankingInput } from "@/lib/recommendations/article-ranking";

describe("article ranking", () => {
  it("prefers suitable coverage and a small set of valuable unknown words", () => {
    const ranked = rankArticleCandidates([
      input("ideal", 96, 7),
      input("too-hard", 75, 18),
      input("too-easy", 99.8, 0),
      input("second", 94, 5),
      input("third", 97, 4),
      input("fourth", 95, 3)
    ]);

    expect(ranked).toHaveLength(3);
    expect(ranked[0].articleId).toBe("ideal");
    expect(ranked[0].explanationCodes).toContain("coverage-fit");
    expect(ranked[0].explanationCodes).toContain("valuable-new-words");
  });

  it("uses time/path fit, penalizes repeated sources, and excludes hidden or completed items", () => {
    const ranked = rankArticleCandidates([
      { ...input("repeated", 96, 6), recentSourceCount: 4 },
      { ...input("path-fit", 95, 5), pathFit: 1, estimatedMinutes: 6, timeBudgetMinutes: 6 },
      { ...input("hidden", 96, 6), hidden: true },
      { ...input("completed", 96, 6), completed: true }
    ]);
    expect(ranked.map((item) => item.articleId)).toEqual(["path-fit", "repeated"]);
    expect(ranked[1].explanationCodes).toContain("source-diversity-penalty");
  });
});

function input(id: string, coverage: number, unknownCount: number): ArticleRankingInput {
  return {
    articleId: id,
    title: id,
    sourceTitle: "Example Source",
    canonicalUrl: `https://example.com/${id}`,
    estimatedMinutes: 6,
    timeBudgetMinutes: 8,
    contentWordCoverage: coverage,
    valuableUnknownWordIds: Array.from({ length: unknownCount }, (_, index) => `word-${index}`),
    pathFit: 0.8,
    recentSourceCount: 0,
    hidden: false,
    completed: false
  };
}
