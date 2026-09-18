import { describe, expect, it } from "vitest";
import { selectTodayArticle } from "@/lib/today/article-selection";
import type { ArticleCandidate } from "@/types/articles";

describe("Today article selection", () => {
  it("selects the highest eligible candidate within the reading budget", () => {
    const selected = selectTodayArticle([
      candidate("best", 92, 6, 96),
      candidate("lower", 80, 6, 95),
      candidate("too-long", 99, 12, 96),
      candidate("too-hard", 98, 6, 78)
    ], [], 6);
    expect(selected?.articleId).toBe("best");
  });

  it("excludes completed, hidden, and recently repeated sources", () => {
    const candidates = [candidate("done", 99, 6, 96), candidate("hidden", 98, 6, 96), candidate("repeat", 97, 6, 96)];
    expect(selectTodayArticle(candidates, [
      { articleId: "done", sourceTitle: "Source done", completed: true },
      { articleId: "hidden", sourceTitle: "Source hidden", hidden: true },
      { articleId: "old-1", sourceTitle: "Source repeat" },
      { articleId: "old-2", sourceTitle: "Source repeat" }
    ], 6)).toBeNull();
  });
});

function candidate(id: string, score: number, minutes: number, coverage: number): ArticleCandidate {
  return {
    articleId: id,
    title: id,
    sourceTitle: `Source ${id}`,
    canonicalUrl: `https://example.com/${id}`,
    estimatedMinutes: minutes,
    contentWordCoverage: coverage,
    valuableUnknownWordIds: ["one", "two", "three", "four", "five"],
    score,
    explanationCodes: ["coverage-fit"]
  };
}
