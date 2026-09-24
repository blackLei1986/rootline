import { describe, expect, it, vi } from "vitest";
import { createDailyReadingRecommendationsService } from "@/lib/reading/daily-reading-recommendations-service";
import type { DailyReadingRecommendationsServiceDependencies } from "@/lib/reading/daily-reading-recommendations-service";
import type { DailyReadingCandidate, DailyReadingRecommendationResult } from "@/types/reading-recommendations";

const now = new Date("2026-09-24T16:30:00.000Z");
const candidate: DailyReadingCandidate = {
  articleId: "article-1", title: "A science story", canonicalUrl: "https://www.nasa.gov/story",
  publisherUrl: "https://www.nasa.gov/story", sourceKey: "nasa-recently-published",
  publishedAt: "2026-09-24T12:00:00.000Z", ingestedAt: "2026-09-24T13:00:00.000Z",
  contentFingerprint: "story-1", summary: "Summary", language: "en", contentWordCount: 200,
  lexicalMatches: [{ wordId: "today-word", lemma: "adapt", occurrences: 2 }], sourceReliability: 1
};
const frozen: DailyReadingRecommendationResult = {
  algorithmVersion: "prior-v0", generatedAt: "2026-09-23T12:00:00.000Z", recommendations: [{
    articleId: "prior-article", title: "Previously frozen", canonicalUrl: "https://www.nasa.gov/prior",
    publisherUrl: "https://www.nasa.gov/prior", sourceKey: "nasa-recently-published", sourceTitle: "NASA News Releases",
    attribution: "NASA", publishedAt: null, summary: null,
    scores: { todayMatches: 0, recentMatches: 0, difficultyFit: 0, freshness: 0, sourceQuality: 0, total: 0 },
    matchedTodayWordIds: [], matchedRecentWordIds: [],
    estimatedUnknownCoverage: { percent: 0, approximate: true, basis: "tracked-vocabulary-match-occurrences" }, reasonCodes: []
  }]
};

function makeHarness(overrides: Partial<DailyReadingRecommendationsServiceDependencies> = {}) {
  const snapshots = {
    getSet: vi.fn(async (): Promise<DailyReadingRecommendationResult | null> => null),
    saveFirstSet: vi.fn(async (_userId: string, _date: string, result: DailyReadingRecommendationResult) => result)
  };
  const dependencies: DailyReadingRecommendationsServiceDependencies = {
    getTimeZone: vi.fn(async () => "Asia/Shanghai"),
    getTodayPlan: vi.fn(async () => ({ dailyTargets: [{ wordId: "today-word", lemma: "adapt" }] })),
    getLearnerVocabularyState: vi.fn(async () => ({ recentWords: [{ wordId: "learned", lemma: "learn", learnedAt: "2026-09-10T00:00:00.000Z" }], knownWordIds: ["learned"] })),
    getDifficultyPreference: vi.fn(async () => "balanced" as const),
    getCandidates: vi.fn(async () => [candidate]),
    snapshots,
    ...overrides
  };
  return { service: createDailyReadingRecommendationsService(dependencies), dependencies, snapshots };
}

describe("daily reading recommendation service", () => {
  it("derives the profile-timezone date and freezes the first non-empty curated set", async () => {
    const harness = makeHarness();
    const result = await harness.service.getForToday("owner-1", now);
    expect(result.learningDate).toBe("2026-09-25");
    expect(harness.dependencies.getTodayPlan).toHaveBeenCalledWith("owner-1", "2026-09-25", now);
    expect(harness.snapshots.saveFirstSet).toHaveBeenCalledWith("owner-1", "2026-09-25", {
      algorithmVersion: result.algorithmVersion, generatedAt: result.generatedAt, recommendations: result.recommendations
    });
    expect(result.recommendations[0]?.matchedTodayWordIds).toEqual(["today-word"]);
  });

  it("returns a same-day snapshot unchanged without rescoring after a version change", async () => {
    const harness = makeHarness();
    harness.snapshots.getSet.mockResolvedValue(frozen);
    const result = await harness.service.getForToday("owner-1", now);
    expect(result).toEqual({ learningDate: "2026-09-25", ...frozen });
    expect(harness.dependencies.getCandidates).not.toHaveBeenCalled();
    expect(harness.snapshots.saveFirstSet).not.toHaveBeenCalled();
  });

  it("does not freeze an empty eligible corpus and can populate it on a later request", async () => {
    const harness = makeHarness({ getCandidates: vi.fn(async () => []) });
    const empty = await harness.service.getForToday("owner-1", now);
    expect(empty.recommendations).toEqual([]);
    expect(harness.snapshots.saveFirstSet).not.toHaveBeenCalled();
    (harness.dependencies.getCandidates as ReturnType<typeof vi.fn>).mockResolvedValue([candidate]);
    const later = await harness.service.getForToday("owner-1", now);
    expect(later.recommendations).toHaveLength(1);
    expect(harness.snapshots.saveFirstSet).toHaveBeenCalledTimes(1);
  });

  it("uses a new snapshot key when the profile-local learning date rolls over", async () => {
    const harness = makeHarness();
    await harness.service.getForToday("owner-1", new Date("2026-09-24T16:30:00.000Z"));
    await harness.service.getForToday("owner-1", new Date("2026-09-25T16:30:00.000Z"));
    expect(harness.snapshots.saveFirstSet.mock.calls.map((call) => call[1])).toEqual(["2026-09-25", "2026-09-26"]);
  });

  it("does not read or freeze a date-keyed set when profile timezone lookup fails", async () => {
    const harness = makeHarness({ getTimeZone: vi.fn(async () => { throw new Error("profile lookup failed"); }) });
    await expect(harness.service.getForToday("owner-1", now)).rejects.toThrow("profile lookup failed");
    expect(harness.snapshots.getSet).not.toHaveBeenCalled();
    expect(harness.snapshots.saveFirstSet).not.toHaveBeenCalled();
  });
});
