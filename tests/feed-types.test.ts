import { describe, expect, it } from "vitest";
import { FEED_LIMITS } from "@/types/feeds";
import type { NormalizedFeedEntry } from "@/types/feeds";
import type { ArticleCandidate } from "@/types/articles";

describe("RSS reading domain", () => {
  it("uses one normalized entry shape across feed formats", () => {
    const entry: NormalizedFeedEntry = {
      externalId: "post-1",
      url: "https://example.com/post-1",
      title: "How memory changes",
      summary: "A short summary",
      publishedAt: "2026-09-17T00:00:00.000Z",
      author: null
    };
    expect(entry.externalId).toBe("post-1");
    expect(FEED_LIMITS.candidateCount).toBe(3);
  });

  it("keeps personalized ranking fields on the candidate DTO", () => {
    const candidate: ArticleCandidate = {
      articleId: "article-1",
      title: "Memory and language",
      sourceTitle: "Example",
      canonicalUrl: "https://example.com/article",
      estimatedMinutes: 6,
      contentWordCoverage: 96,
      valuableUnknownWordIds: ["retain"],
      score: 92,
      explanationCodes: ["coverage-fit"]
    };
    expect(candidate.valuableUnknownWordIds).toEqual(["retain"]);
  });
});
