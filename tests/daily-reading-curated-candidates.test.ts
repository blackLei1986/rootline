// @vitest-environment node

import { describe, expect, it } from "vitest";
import { SupabaseFeedRepository } from "@/lib/repositories/supabase/feed-repository";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

describe("curated recommendation candidate repository", () => {
  it("queries only registry-approved source IDs and excludes unrelated source rows", async () => {
    const filters: Array<{ table: string; column: string; values: unknown }> = [];
    const queryFor = (table: string) => {
      const query = {
        select: () => query,
        in: (column: string, values: unknown) => { filters.push({ table, column, values }); return query; },
        eq: () => query,
        order: () => query,
        limit: () => query,
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rowsByTable[table] ?? [], error: null }).then(resolve)
      };
      return query;
    };
    const rowsByTable: Record<string, unknown[]> = {
      feed_sources: [
        { id: "curated-id", normalized_feed_url: "https://www.nasa.gov/news-release/feed/" },
        { id: "custom-id", normalized_feed_url: "https://custom.example/rss" }
      ],
      articles: [
        { id: "curated-article", feed_source_id: "curated-id", canonical_url: "https://www.nasa.gov/story", publisher_url: "https://www.nasa.gov/story", title: "NASA story", published_at: null, summary: null, language: "en", content_fingerprint: "fp", created_at: "2026-09-23T00:00:00Z" },
        { id: "custom-article", feed_source_id: "custom-id", canonical_url: "https://custom.example/story", publisher_url: "https://custom.example/story", title: "Custom story", published_at: null, summary: null, language: "en", content_fingerprint: "fp2", created_at: "2026-09-23T00:00:00Z" }
      ],
      article_analyses: [{ article_id: "curated-article", word_count: 100, lexical_matches: [{ wordId: "adapt", lemma: "adapt", occurrences: 1 }] }],
      feed_fetch_runs: [{ status: "running" }, { status: "updated" }]
    };
    const client = { from: (table: string) => queryFor(table) } as unknown as SupabaseClient<Database>;
    const repository = new SupabaseFeedRepository(client);

    const candidates = await repository.listCuratedRecommendationCandidates();

    expect(candidates.map((candidate) => candidate.articleId)).toEqual(["curated-article"]);
    expect(candidates[0]).toMatchObject({ sourceKey: "nasa-recently-published", sourceReliability: 1 });
    expect(filters.find((filter) => filter.table === "articles" && filter.column === "feed_source_id")?.values)
      .toEqual(["curated-id"]);
  });
});
