// @vitest-environment node

import { describe, expect, it } from "vitest";
import { SupabaseDailyReadingRecommendationRepository } from "@/lib/repositories/supabase/daily-reading-recommendation-repository";
import type { Database } from "@/types/database";
import type { DailyReadingRecommendationResult } from "@/types/reading-recommendations";
import type { SupabaseClient } from "@supabase/supabase-js";

const result: DailyReadingRecommendationResult = {
  algorithmVersion: "daily-3-v1", generatedAt: "2026-09-24T12:00:00.000Z",
  recommendations: [{
    articleId: "article-1", title: "Science report", canonicalUrl: "https://example.org/report",
    publisherUrl: "https://example.org/report", sourceKey: "reviewed", sourceTitle: "Reviewed News",
    attribution: "Publisher", publishedAt: null, summary: "Short summary.",
    scores: { todayMatches: 50, recentMatches: 25, difficultyFit: 80, freshness: 90, sourceQuality: 85, total: 62.75 },
    matchedTodayWordIds: ["word-1"], matchedRecentWordIds: ["word-2"], matchedRecent7DayWordIds: ["word-2"],
    estimatedUnknownCoverage: { percent: 12, approximate: true, basis: "tracked-vocabulary-match-occurrences" },
    reasonCodes: ["today-target-match", "difficulty-fit"]
  }]
};

function testRepository(stored = result) {
  const calls: Array<{ table: string; operation: string; payload?: Record<string, unknown>; options?: Record<string, unknown> }> = [];
  const client = {
    from(table: string) {
      return {
        select(columns: string) {
          calls.push({ table, operation: `select:${columns}` });
          return {
            eq(column: string, value: string) {
              calls.push({ table, operation: `eq:${column}`, payload: { value } });
              return {
                eq(secondColumn: string, secondValue: string) {
                  calls.push({ table, operation: `eq:${secondColumn}`, payload: { value: secondValue } });
                  return { maybeSingle: async () => ({
                    data: {
                      algorithm_version: stored.algorithmVersion,
                      generated_at: stored.generatedAt,
                      recommendations: stored.recommendations
                    }, error: null
                  }) };
                }
              };
            }
          };
        },
        upsert(payload: Record<string, unknown>, options: Record<string, unknown>) {
          calls.push({ table, operation: "upsert", payload, options });
          return Promise.resolve({ error: null });
        }
      };
    }
  } as unknown as SupabaseClient<Database>;
  return { repository: new SupabaseDailyReadingRecommendationRepository(client), calls };
}

describe("daily reading recommendation snapshot repository", () => {
  it("freezes only the first non-empty result with conflict-ignore, then returns the stored winner unchanged", async () => {
    const storedWinner = { ...result, algorithmVersion: "daily-3-v0" };
    const { repository, calls } = testRepository(storedWinner);
    const loaded = await repository.saveFirstSet("owner-id", "2026-09-24", result);
    expect(calls.find((call) => call.operation === "upsert")).toMatchObject({
      table: "daily_reading_recommendation_sets", options: { onConflict: "user_id,learning_date", ignoreDuplicates: true },
      payload: { user_id: "owner-id", learning_date: "2026-09-24", algorithm_version: "daily-3-v1" }
    });
    expect(loaded).toEqual(storedWinner);
  });

  it("does not freeze an empty recommendation set", async () => {
    const { repository, calls } = testRepository();
    await expect(repository.saveFirstSet("owner-id", "2026-09-24", { ...result, recommendations: [] }))
      .rejects.toThrow(/empty/i);
    expect(calls).toEqual([]);
  });

  it("rejects snapshots above the three-recommendation contract", async () => {
    const { repository, calls } = testRepository();
    const tooMany = { ...result, recommendations: Array.from({ length: 4 }, (_, index) => ({
      ...result.recommendations[0]!, articleId: `article-${index}`
    })) };
    await expect(repository.saveFirstSet("owner-id", "2026-09-24", tooMany)).rejects.toThrow(/three/i);
    expect(calls).toEqual([]);
  });

  it("persists only recommendation metadata, scores, and exact matched IDs", async () => {
    const { repository, calls } = testRepository();
    await repository.saveFirstSet("owner-id", "2026-09-24", result);
    const saved = calls.find((call) => call.operation === "upsert")?.payload;
    expect(saved).toMatchObject({ recommendations: result.recommendations });
    expect(JSON.stringify(saved)).not.toContain("extracted_text");
    expect(JSON.stringify(saved)).not.toContain("article body");
  });

  it("loads a legacy snapshot without adding or rewriting the optional seven-day cohort", async () => {
    const legacyItem = { ...result.recommendations[0]! };
    delete legacyItem.matchedRecent7DayWordIds;
    const legacy: DailyReadingRecommendationResult = {
      ...result,
      recommendations: [legacyItem]
    };
    const { repository, calls } = testRepository(legacy);

    await expect(repository.getSet("owner-id", "2026-09-24")).resolves.toEqual(legacy);
    expect(calls.every((call) => call.operation !== "upsert")).toBe(true);
  });
});
