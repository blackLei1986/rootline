import { describe, expect, it, vi } from "vitest";
import { createDailyReadingArticleService } from "@/lib/reading/daily-reading-article-service";
import type { DailyReadingRecommendation } from "@/types/reading-recommendations";

const recommendation: DailyReadingRecommendation = {
  articleId: "article-1", title: "Frozen title", canonicalUrl: "https://example.test/story",
  publisherUrl: "https://publisher.test/story", sourceKey: "curated", sourceTitle: "Publisher",
  attribution: "Publisher attribution", publishedAt: "2026-09-24T10:00:00.000Z", summary: "Frozen summary.",
  scores: { todayMatches: 50, recentMatches: 25, difficultyFit: 80, freshness: 90, sourceQuality: 85, total: 62.75 },
  matchedTodayWordIds: ["today-word"], matchedRecentWordIds: ["recent-word"],
  matchedRecent7DayWordIds: ["recent-word"],
  estimatedUnknownCoverage: { percent: 12, approximate: true, basis: "tracked-vocabulary-match-occurrences" },
  reasonCodes: ["today-target-match"]
};
const readState = { openedAt: "2026-09-24T11:00:00.000Z", completedAt: null };

function makeService(recommendationsList = [recommendation], storedState: typeof readState | null = readState) {
  const recommendations = { getForToday: vi.fn(async () => ({
    learningDate: "2026-09-24", algorithmVersion: "daily-3-v1", generatedAt: "2026-09-24T09:00:00.000Z",
    recommendations: recommendationsList
  })) };
  const states = {
    getState: vi.fn(async () => storedState),
    updateState: vi.fn(async () => ({ openedAt: readState.openedAt, completedAt: "2026-09-24T12:00:00.000Z" }))
  };
  return { service: createDailyReadingArticleService({ recommendations, states }), recommendations, states };
}

describe("Daily-3 article authorization service", () => {
  it("returns the frozen recommendation for an article in the viewer's current set", async () => {
    const { service, recommendations } = makeService();

    await expect(service.getArticle("viewer-1", "article-1")).resolves.toEqual(recommendation);
    expect(recommendations.getForToday).toHaveBeenCalledWith("viewer-1");
  });

  it("returns no article for a non-member and does not query article storage", async () => {
    const { service, recommendations, states } = makeService([]);

    await expect(service.getArticle("viewer-1", "another-article")).resolves.toBeNull();
    expect(recommendations.getForToday).toHaveBeenCalledWith("viewer-1");
    expect(states.getState).not.toHaveBeenCalled();
  });

  it("uses the first matching item from a malformed duplicate-ID snapshot", async () => {
    const second = { ...recommendation, title: "Later duplicate" };
    const { service } = makeService([recommendation, second]);

    await expect(service.getArticle("viewer-1", "article-1")).resolves.toEqual(recommendation);
  });

  it("returns persisted read state for a current-set member", async () => {
    const { service, states } = makeService();

    await expect(service.getState("viewer-1", "article-1")).resolves.toEqual(readState);
    expect(states.getState).toHaveBeenCalledWith("viewer-1", "article-1");
  });

  it("returns empty state for a member without a stored state row", async () => {
    const { service } = makeService([recommendation], null);

    await expect(service.getState("viewer-1", "article-1")).resolves.toEqual({ openedAt: null, completedAt: null });
  });

  it("never reads or writes state for an article outside the current set", async () => {
    const { service, states } = makeService([]);

    await expect(service.getState("viewer-1", "another-article")).resolves.toBeNull();
    await expect(service.updateState("viewer-1", "another-article", { completed: true })).resolves.toBeNull();
    expect(states.getState).not.toHaveBeenCalled();
    expect(states.updateState).not.toHaveBeenCalled();
  });

  it("persists read-state updates only after current-set membership succeeds", async () => {
    const { service, states } = makeService();

    await expect(service.updateState("viewer-1", "article-1", { completed: true })).resolves.toEqual({
      openedAt: readState.openedAt, completedAt: "2026-09-24T12:00:00.000Z"
    });
    expect(states.updateState).toHaveBeenCalledWith("viewer-1", "article-1", { completed: true });
  });
});
