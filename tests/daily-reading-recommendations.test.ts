import { describe, expect, it } from "vitest";
import { rankDailyReadingRecommendations, type DailyReadingCandidate } from "@/lib/reading/daily-recommendations";

const sources = [
  { key: "curated", title: "Reviewed Source", feedUrl: "https://example.com/feed.xml", siteUrl: "https://example.com/", attribution: "Example", category: "science", language: "en", qualityScore: 80, enabled: true, reviewedAt: "2026-09-23" }
];
const now = "2026-09-24T12:00:00.000Z";

function candidate(overrides: Partial<DailyReadingCandidate> = {}): DailyReadingCandidate {
  return {
    articleId: "a1", title: "A current science report", canonicalUrl: "https://example.com/story?utm_source=feed",
    publisherUrl: "https://example.com/story", sourceKey: "curated", publishedAt: "2026-09-24T08:00:00.000Z",
    ingestedAt: "2026-09-24T09:00:00.000Z", contentFingerprint: "fingerprint-a",
    summary: "A short report.", language: "en", contentWordCount: 500,
    lexicalMatches: [], sourceReliability: 1, ...overrides
  };
}

describe("Daily Reading 3 deterministic scorer", () => {
  it("matches exact stable IDs and uses exact lemma fallback, including title-only matches", () => {
    const result = rankDailyReadingRecommendations({
      candidates: [candidate({ lexicalMatches: [
        { wordId: "stable:adapt", lemma: "adapt", occurrences: 2, titleOccurrences: 0 },
        { wordId: "old-catalog-id", lemma: "analysis", occurrences: 0, titleOccurrences: 1 },
        { wordId: "unrelated", lemma: "adaptation", occurrences: 20, titleOccurrences: 0 }
      ] })],
      todayTargets: [{ wordId: "stable:adapt", lemma: "adapt" }, { wordId: "stable:analysis", lemma: "analysis" }],
      recentWords: [], knownWordIds: [], difficultyPreference: "balanced", now, sources
    });
    expect(result.recommendations[0]?.matchedTodayWordIds).toEqual(["stable:adapt", "stable:analysis"]);
    expect(result.recommendations[0]?.reasonCodes).toContain("today-target-match");
  });

  it("excludes Today IDs from recent matches and returns exact matched recent IDs", () => {
    const result = rankDailyReadingRecommendations({
      candidates: [candidate({ lexicalMatches: [
        { wordId: "today-id", lemma: "adapt", occurrences: 1 },
        { wordId: "recent-id", lemma: "evidence", occurrences: 2 }
      ] })],
      todayTargets: [{ wordId: "today-id", lemma: "adapt" }],
      recentWords: [
        { wordId: "today-id", lemma: "adapt", learnedAt: "2026-09-24T11:00:00.000Z" },
        { wordId: "recent-id", lemma: "evidence", learnedAt: "2026-09-23T11:00:00.000Z" }
      ],
      knownWordIds: [], difficultyPreference: "balanced", now, sources
    });
    expect(result.recommendations[0]?.matchedRecentWordIds).toEqual(["recent-id"]);
  });

  it("limits recent learning matches to the rolling 30-day window", () => {
    const result = rankDailyReadingRecommendations({
      candidates: [candidate({ lexicalMatches: [
        { wordId: "current", lemma: "current", occurrences: 1 },
        { wordId: "stale", lemma: "stale", occurrences: 1 }
      ] })],
      todayTargets: [],
      recentWords: [
        { wordId: "current", lemma: "current", learnedAt: "2026-09-01T00:00:00.000Z" },
        { wordId: "stale", lemma: "stale", learnedAt: "2026-08-01T00:00:00.000Z" }
      ],
      knownWordIds: [], difficultyPreference: "balanced", now, sources
    });
    expect(result.recommendations[0]?.matchedRecentWordIds).toEqual(["current"]);
  });

  it("derives an inclusive seven-day subset without changing the 30-day cohort", () => {
    const result = rankDailyReadingRecommendations({
      candidates: [candidate({ lexicalMatches: [
        { wordId: "boundary", lemma: "boundary", occurrences: 1 },
        { wordId: "older", lemma: "older", occurrences: 1 },
        { wordId: "now", lemma: "now", occurrences: 1 },
        { wordId: "future", lemma: "future", occurrences: 1 },
        { wordId: "twenty-day", lemma: "twenty", occurrences: 1 },
        { wordId: "today-id", lemma: "today", occurrences: 1 },
        { wordId: "shared-recent", lemma: "shared", occurrences: 1 }
      ] })],
      todayTargets: [{ wordId: "today-id", lemma: "today" }, { wordId: "today-lemma-id", lemma: "shared" }],
      recentWords: [
        { wordId: "boundary", lemma: "boundary", learnedAt: "2026-09-17T12:00:00.000Z" },
        { wordId: "older", lemma: "older", learnedAt: "2026-09-17T11:59:59.999Z" },
        { wordId: "now", lemma: "now", learnedAt: "2026-09-24T12:00:00.000Z" },
        { wordId: "future", lemma: "future", learnedAt: "2026-09-24T12:00:00.001Z" },
        { wordId: "twenty-day", lemma: "twenty", learnedAt: "2026-09-04T12:00:00.000Z" },
        { wordId: "today-id", lemma: "today", learnedAt: "2026-09-24T11:00:00.000Z" },
        { wordId: "shared-recent", lemma: "SHARED", learnedAt: "2026-09-24T11:00:00.000Z" }
      ],
      knownWordIds: [], difficultyPreference: "balanced", now, sources
    });

    expect(result.recommendations[0]?.matchedRecent7DayWordIds).toEqual(["boundary", "now"]);
    expect(result.recommendations[0]?.matchedRecentWordIds).toEqual(["boundary", "now", "older", "twenty-day"]);
  });

  it("scores difficulty fit from approximate tracked unknown occurrence coverage", () => {
    const candidates = [
      candidate({ articleId: "fit", contentWordCount: 100, lexicalMatches: [
        { wordId: "known", lemma: "known", occurrences: 85 }, { wordId: "new", lemma: "new", occurrences: 15 }
      ] }),
      candidate({ articleId: "hard", contentWordCount: 100, lexicalMatches: [
        { wordId: "new", lemma: "new", occurrences: 55 }
      ] })
    ];
    const result = rankDailyReadingRecommendations({ candidates, todayTargets: [{ wordId: "new", lemma: "new" }], recentWords: [], knownWordIds: ["known"], difficultyPreference: "balanced", now, sources });
    expect(result.recommendations[0]?.articleId).toBe("fit");
    expect(result.recommendations[0]?.estimatedUnknownCoverage).toMatchObject({ percent: 15, approximate: true });
  });

  it("uses publication time or ingestion fallback for freshness and scores registry quality with fetch reliability", () => {
    const result = rankDailyReadingRecommendations({
      candidates: [
        candidate({ articleId: "fresh", sourceReliability: 1, lexicalMatches: [{ wordId: "learned", lemma: "learn", occurrences: 1 }] }),
        candidate({ articleId: "old", canonicalUrl: "https://example.com/old", contentFingerprint: "old-content", publishedAt: null, ingestedAt: "2026-07-01T00:00:00.000Z", sourceReliability: 0.2, lexicalMatches: [{ wordId: "learned", lemma: "learn", occurrences: 1 }] })
      ], todayTargets: [], recentWords: [{ wordId: "learned", lemma: "learn", learnedAt: "2026-09-01T00:00:00.000Z" }], knownWordIds: [], difficultyPreference: "balanced", now, sources
    });
    expect(result.recommendations[0]?.articleId).toBe("fresh");
    expect(result.recommendations[0]?.scores.freshness).toBeGreaterThan(result.recommendations[1]!.scores.freshness);
    expect(result.recommendations[0]?.scores.sourceQuality).toBeGreaterThan(result.recommendations[1]!.scores.sourceQuality);
  });

  it("gives diminishing returns and lets multiple meaningful Today matches beat a one-off rare match", () => {
    const result = rankDailyReadingRecommendations({
      candidates: [
        candidate({ articleId: "many", lexicalMatches: [
          { wordId: "w1", lemma: "adapt", occurrences: 1 },
          { wordId: "w2", lemma: "evidence", occurrences: 1 },
          { wordId: "w3", lemma: "context", occurrences: 1 }
        ] }),
        candidate({ articleId: "one", lexicalMatches: [{ wordId: "rare", lemma: "rare", occurrences: 40 }] })
      ],
      todayTargets: [
        { wordId: "w1", lemma: "adapt" }, { wordId: "w2", lemma: "evidence" },
        { wordId: "w3", lemma: "context" }, { wordId: "rare", lemma: "rare" }
      ],
      recentWords: [], knownWordIds: [], difficultyPreference: "balanced", now, sources
    });
    expect(result.recommendations[0]?.articleId).toBe("many");
    const repeated = rankDailyReadingRecommendations({
      candidates: [candidate({ lexicalMatches: [{ wordId: "w1", lemma: "adapt", occurrences: 1 }] })],
      todayTargets: [{ wordId: "w1", lemma: "adapt" }], recentWords: [], knownWordIds: [], difficultyPreference: "balanced", now, sources
    }).recommendations[0]!;
    const manyOccurrences = rankDailyReadingRecommendations({
      candidates: [candidate({ lexicalMatches: [{ wordId: "w1", lemma: "adapt", occurrences: 50 }] })],
      todayTargets: [{ wordId: "w1", lemma: "adapt" }], recentWords: [], knownWordIds: [], difficultyPreference: "balanced", now, sources
    }).recommendations[0]!;
    expect(manyOccurrences.scores.todayMatches).toBe(repeated.scores.todayMatches);
  });

  it("returns stable ties, suppresses canonical/content/title near-duplicates, and caps at three", () => {
    const result = rankDailyReadingRecommendations({
      candidates: [
        candidate({ articleId: "z", canonicalUrl: "https://example.com/same?utm_campaign=x", title: "Stable title has four different words", lexicalMatches: [{ wordId: "stable", lemma: "stable", occurrences: 1 }] }),
        candidate({ articleId: "a", canonicalUrl: "https://example.com/same#top", title: "Stable title has four different words", lexicalMatches: [{ wordId: "stable", lemma: "stable", occurrences: 1 }] }),
        candidate({ articleId: "content-duplicate", canonicalUrl: "https://example.com/other", contentFingerprint: "fingerprint-a", title: "A separate article about recent events", lexicalMatches: [{ wordId: "stable", lemma: "stable", occurrences: 1 }] }),
        candidate({ articleId: "near-copy", canonicalUrl: "https://example.com/update", contentFingerprint: "different", title: "Stable title has four different words update", lexicalMatches: [{ wordId: "stable", lemma: "stable", occurrences: 1 }] }),
        ...["c", "b", "d"].map((articleId) => candidate({ articleId, canonicalUrl: `https://example.com/${articleId}`, contentFingerprint: articleId, title: `Story ${articleId}`, lexicalMatches: [{ wordId: "stable", lemma: "stable", occurrences: 1 }] }))
      ],
      todayTargets: [{ wordId: "stable", lemma: "stable" }], recentWords: [], knownWordIds: [], difficultyPreference: "balanced", now, sources
    });
    expect(result.recommendations).toHaveLength(3);
    expect(result.recommendations.map((item) => item.articleId)).toEqual(["a", "b", "c"]);
  });

  it("returns no more than three items and does not admit user feeds or registry omissions", () => {
    const candidates = [
      ...["1", "2", "3", "4"].map((id) => candidate({ articleId: id, canonicalUrl: `https://example.com/${id}`, contentFingerprint: id, lexicalMatches: [{ wordId: "target", lemma: "target", occurrences: 1 }] })),
      candidate({ articleId: "user-feed", sourceKey: "user-created-feed", canonicalUrl: "https://custom.example/feed-story", contentFingerprint: "user", lexicalMatches: [{ wordId: "target", lemma: "target", occurrences: 1 }] })
    ];
    const result = rankDailyReadingRecommendations({ candidates, todayTargets: [{ wordId: "target", lemma: "target" }], recentWords: [], knownWordIds: [], difficultyPreference: "balanced", now, sources });
    expect(result.recommendations.map((item) => item.articleId)).toEqual(["1", "2", "3"]);
    expect(result.algorithmVersion).toBe("daily-3-v1");
    expect(rankDailyReadingRecommendations({ candidates: [candidate()], todayTargets: [], recentWords: [], knownWordIds: [], difficultyPreference: "balanced", now, sources: [] }).recommendations).toEqual([]);
  });

  it("does not recommend eligible articles with no Today or recent-learning match", () => {
    const result = rankDailyReadingRecommendations({
      candidates: [candidate()], todayTargets: [], recentWords: [], knownWordIds: [],
      difficultyPreference: "balanced", now, sources
    });
    expect(result.recommendations).toEqual([]);
  });
});
