import { describe, expect, it } from "vitest";
import { categorizeTodayReadingDegradation, getReadingDegradationCopy, type ReadingAvailability } from "@/lib/today/degradation";

describe("Today Reading degradation", () => {
  it.each([
    [{ subscriptionCount: 0, freshArticleCount: 0, extractedArticleCount: 0, analyzedArticleCount: 0, eligibleArticleCount: 0 }, "NO_SUBSCRIPTIONS"],
    [{ subscriptionCount: 2, freshArticleCount: 0, extractedArticleCount: 0, analyzedArticleCount: 0, eligibleArticleCount: 0 }, "NO_FRESH_ARTICLES"],
    [{ subscriptionCount: 2, freshArticleCount: 4, extractedArticleCount: 0, analyzedArticleCount: 0, eligibleArticleCount: 0 }, "EXTRACTION_UNAVAILABLE"],
    [{ subscriptionCount: 2, freshArticleCount: 4, extractedArticleCount: 4, analyzedArticleCount: 0, eligibleArticleCount: 0 }, "ANALYSIS_STALE"],
    [{ subscriptionCount: 2, freshArticleCount: 4, extractedArticleCount: 4, analyzedArticleCount: 4, eligibleArticleCount: 0 }, "NO_LEVEL_MATCH"]
  ] as Array<[ReadingAvailability, string]>)("returns a safe vocabulary-only reason %#", (availability, expected) => {
    const reason = categorizeTodayReadingDegradation(availability);
    expect(reason).toBe(expected);
    const copy = getReadingDegradationCopy(reason!);
    expect(copy.title.length).toBeGreaterThan(0);
    expect(copy.actionLabel.length).toBeGreaterThan(0);
    expect(copy.actionHref).toMatch(/^\//);
  });

  it("returns no degradation when at least one article is eligible", () => {
    expect(categorizeTodayReadingDegradation({ subscriptionCount: 1, freshArticleCount: 3, extractedArticleCount: 3, analyzedArticleCount: 2, eligibleArticleCount: 1 })).toBeNull();
  });
});
