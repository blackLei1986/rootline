// @vitest-environment node

import { describe, expect, it } from "vitest";
import { SupabaseFeedRepository } from "@/lib/repositories/supabase/feed-repository";
import type { CuratedArticleRecord } from "@/lib/jobs/curated-ingestion";
import type { Database } from "@/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

const article: CuratedArticleRecord = {
  sourceKey: "nasa-recently-published",
  attribution: "NASA",
  externalId: "nasa-guid",
  canonicalUrl: "https://www.nasa.gov/news-release/mission/",
  publisherUrl: "https://www.nasa.gov/news-release/mission/",
  title: "Mission report",
  author: "NASA Team",
  summary: "Mission summary.",
  publishedAt: null,
  language: "en",
  contentFingerprint: "body-only-fingerprint",
  analysis: {
    articleId: "temporary-id",
    vocabularyVersion: "v1",
    analysisState: "full",
    wordCount: 150,
    uniqueLemmaCount: 1,
    estimatedMinutes: 1,
    lexicalMatches: [{
      wordId: "analysis", lemma: "analysis", familyId: "family-1", occurrences: 3,
      frequencyRank: 1000, learningValue: 80, vocabularyBand: "core-3000", coverageTags: []
    }],
    analyzedAt: "2026-09-23T00:00:00.000Z"
  }
};

function recordingClient(duplicate = false, failAnalysis = false) {
  const writes: Array<{ table: string; operation: string; payload: Record<string, unknown> }> = [];
  const client = {
    from(table: string) {
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        insert(payload: Record<string, unknown>) {
          writes.push({ table, operation: "insert", payload });
          if (table === "articles") return {
            select: () => ({ single: async () => duplicate
              ? { data: null, error: { code: "23505" } }
              : { data: { id: "article-id" }, error: null } })
          };
          return Promise.resolve({ error: null });
        },
        upsert(payload: Record<string, unknown>) {
          writes.push({ table, operation: "upsert", payload });
          return Promise.resolve({ error: failAnalysis ? { code: "DB_UNAVAILABLE", message: "analysis failed" } : null });
        },
        update(payload: Record<string, unknown>) {
          writes.push({ table, operation: "update", payload });
          return { eq: async () => ({ error: null }) };
        },
        delete() {
          return { eq: async (column: string, value: string) => {
            writes.push({ table, operation: "delete", payload: { [column]: value } });
            return { error: null };
          } };
        }
      };
    }
  } as unknown as SupabaseClient<Database>;
  return { client, writes };
}

describe("curated feed repository", () => {
  it("keeps every reviewed NASA feed ID out of generic full-text refresh while retaining other custom IDs", async () => {
    const rows = [
      { id: "nasa-id", normalized_feed_url: "https://www.nasa.gov/news-release/feed/", description: "User's NASA feed" },
      { id: "custom-id", normalized_feed_url: "https://example.org/rss", description: null },
      { id: "other-custom-id", normalized_feed_url: "https://example.net/rss", description: "Other custom feed" }
    ];
    const client = {
      from(table: string) {
        expect(table).toBe("feed_sources");
        return { select: () => ({
          neq: () => ({ order: () => ({ limit: async (limit: number) => ({ data: rows.slice(0, limit), error: null }) }) })
        }) };
      }
    } as unknown as SupabaseClient<Database>;
    const repository = new SupabaseFeedRepository(client);
    expect(await repository.listRefreshableSourceIds(2)).toEqual(["custom-id", "other-custom-id"]);
  });

  it("refuses direct legacy refresh of an unmarked NASA feed ID but loads another custom ID", async () => {
    const rows = new Map([
      ["nasa-id", { id: "nasa-id", normalized_feed_url: "https://www.nasa.gov/news-release/feed/", description: "User's NASA feed", etag: null, last_modified: null }],
      ["custom-id", { id: "custom-id", normalized_feed_url: "https://example.org/rss", description: "Custom feed", etag: null, last_modified: null }]
    ]);
    const client = {
      from: () => ({ select: () => ({ eq: (_column: string, id: string) => ({
        maybeSingle: async () => ({ data: rows.get(id), error: null })
      }) }) })
    } as unknown as SupabaseClient<Database>;
    const repository = new SupabaseFeedRepository(client);
    expect(await repository.getSource("nasa-id")).toBeNull();
    expect(await repository.getSource("custom-id")).toMatchObject({ id: "custom-id" });
  });

  it("creates the reviewed NASA source with ordinary attribution metadata", async () => {
    const writes: Record<string, unknown>[] = [];
    const client = {
      from(table: string) {
        expect(table).toBe("feed_sources");
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
          insert(payload: Record<string, unknown>) {
            writes.push(payload);
            return { select: () => ({ single: async () => ({
              data: { id: "curated-id", normalized_feed_url: payload.normalized_feed_url, etag: null, last_modified: null },
              error: null
            }) }) };
          }
        };
      }
    } as unknown as SupabaseClient<Database>;
    const repository = new SupabaseFeedRepository(client);
    await repository.resolveSource({
      key: "nasa-recently-published", title: "NASA News Releases",
      feedUrl: "https://www.nasa.gov/news-release/feed/", siteUrl: "https://www.nasa.gov/",
      attribution: "NASA", category: "science", language: "en", qualityScore: 85,
      enabled: true, reviewedAt: "2026-09-23"
    });
    expect(writes[0]).toMatchObject({ description: "Publisher: NASA" });
  });

  it("protects a pre-existing NASA source while preserving its ID and description", async () => {
    const row = {
      id: "existing-id", normalized_feed_url: "https://www.nasa.gov/news-release/feed/",
      description: "User's NASA headlines", etag: '"old"', last_modified: null
    };
    const writes: Record<string, unknown>[] = [];
    const client = {
      from(table: string) {
        expect(table).toBe("feed_sources");
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
          update(payload: Record<string, unknown>) {
            writes.push(payload);
            return { eq: async () => { row.description = String(payload.description); return { error: null }; } };
          }
        };
      }
    } as unknown as SupabaseClient<Database>;
    const repository = new SupabaseFeedRepository(client);
    const source = await repository.resolveSource({
      key: "nasa-recently-published", title: "NASA News Releases",
      feedUrl: "https://www.nasa.gov/news-release/feed/", siteUrl: "https://www.nasa.gov/",
      attribution: "NASA", category: "science", language: "en", qualityScore: 85,
      enabled: true, reviewedAt: "2026-09-23"
    });
    expect(source).toMatchObject({ id: "existing-id", etag: '"old"' });
    expect(row.description).toBe("User's NASA headlines");
    expect(writes).toEqual([]);
  });

  it("keeps a custom NASA source metadata update available while URL-based protection remains active", async () => {
    let upserts = 0;
    const client = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: {
          id: "curated-id", normalized_feed_url: "https://www.nasa.gov/news-release/feed/",
          description: "User's NASA feed"
        }, error: null }) }) }),
        upsert: () => { upserts++; return { select: () => ({ single: async () => ({ data: { id: "curated-id" }, error: null }) }) }; }
      })
    } as unknown as SupabaseClient<Database>;
    const repository = new SupabaseFeedRepository(client);
    expect(await repository.upsertSource("https://www.nasa.gov/news-release/feed/")).toBe("curated-id");
    expect(upserts).toBe(1);
  });

  it("excludes a pending NASA article from legacy body analysis before curated resolution", async () => {
    const pending = [
      { id: "nasa-pending", feed_source_id: "curated-id", publisher_url: "https://www.nasa.gov/story", title: "NASA story" },
      { id: "custom-pending", feed_source_id: "custom-id", publisher_url: "https://example.org/story", title: "Custom story" }
    ];
    let pendingFilter = "";
    const client = {
      from(table: string) {
        if (table === "feed_sources") return {
          select: () => ({ in: async () => ({ data: [{
            id: "curated-id", normalized_feed_url: "https://www.nasa.gov/news-release/feed/",
            description: "User's NASA headlines"
          }], error: null }) })
        };
        return {
          select: () => ({ eq: () => ({
            or(filter: string) { pendingFilter = filter; return this; },
            limit: async () => ({
              data: pending.filter((row) => !pendingFilter || row.feed_source_id !== "curated-id"), error: null
            })
          }) })
        };
      }
    } as unknown as SupabaseClient<Database>;
    const repository = new SupabaseFeedRepository(client);
    expect(await repository.listPendingArticles(10)).toEqual([{
      id: "custom-pending", publisherUrl: "https://example.org/story", title: "Custom story"
    }]);
    expect(pendingFilter).toContain("curated-id");
  });

  it("blocks a stale legacy worker from writing full text for an unmarked NASA source", async () => {
    const writes: Array<{ table: string; payload: Record<string, unknown> }> = [];
    const client = {
      from(table: string) {
        return {
          select: () => ({ eq: (_column: string, id: string) => ({ maybeSingle: async () => ({
            data: table === "articles"
              ? { feed_source_id: "curated-id" }
              : { id, normalized_feed_url: "https://www.nasa.gov/news-release/feed/",
                  description: "User's NASA feed" },
            error: null
          }) }) }),
          update(payload: Record<string, unknown>) {
            writes.push({ table, payload });
            return { eq: async () => ({ error: null }) };
          },
          upsert(payload: Record<string, unknown>) {
            writes.push({ table, payload });
            return Promise.resolve({ error: null });
          }
        };
      }
    } as unknown as SupabaseClient<Database>;
    const repository = new SupabaseFeedRepository(client);
    await expect(repository.saveArticleAnalysis("pending-id", {
      canonicalUrl: article.canonicalUrl, publisherUrl: article.publisherUrl,
      title: article.title, byline: article.author, excerpt: article.summary,
      text: "Full NASA body must remain transient", wordCount: 150, language: "en"
    }, article.contentFingerprint, article.analysis)).rejects.toThrow(/curated/i);
    await repository.rejectArticle("pending-id", "ANALYSIS_FAILED");
    expect(writes).toHaveLength(0);
  });

  it("keeps the existing full-text analysis behavior for an unrelated custom feed", async () => {
    const writes: Array<{ table: string; payload: Record<string, unknown> }> = [];
    const client = {
      from(table: string) {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({
            data: table === "articles" ? { feed_source_id: "custom-id" }
              : { normalized_feed_url: "https://example.org/rss" }, error: null
          }) }) }),
          update(payload: Record<string, unknown>) {
            writes.push({ table, payload });
            return { eq: async () => ({ error: null }) };
          },
          upsert(payload: Record<string, unknown>) {
            writes.push({ table, payload });
            return Promise.resolve({ error: null });
          }
        };
      }
    } as unknown as SupabaseClient<Database>;
    const repository = new SupabaseFeedRepository(client);
    await repository.saveArticleAnalysis("custom-article", {
      canonicalUrl: "https://example.org/story", publisherUrl: "https://example.org/story",
      title: "Custom story", byline: null, excerpt: null,
      text: "Existing custom article body", wordCount: 150, language: "en"
    }, "custom-fingerprint", article.analysis);
    expect(writes.find((write) => write.table === "articles")?.payload)
      .toMatchObject({ extracted_text: "Existing custom article body" });
  });

  it("refuses unreviewed source metadata before database resolution", async () => {
    const { client, writes } = recordingClient();
    const repository = new SupabaseFeedRepository(client);
    await expect(repository.resolveSource({
      key: "user-feed", title: "User feed", feedUrl: "https://example.org/rss",
      siteUrl: "https://example.org/", attribution: "User", category: "science",
      language: "en", qualityScore: 85, enabled: true, reviewedAt: "2026-09-23"
    })).rejects.toThrow(/reviewed/i);
    expect(writes).toHaveLength(0);
  });

  it("stores metadata and exact lexical matches without extracted body or images", async () => {
    const { client, writes } = recordingClient();
    const repository = new SupabaseFeedRepository(client);
    expect(await repository.saveCuratedArticle("source-id", article)).toBe("inserted");

    const articleWrite = writes.find((write) => write.table === "articles")?.payload;
    const analysisWrite = writes.find((write) => write.table === "article_analyses")?.payload;
    expect(articleWrite).toMatchObject({
      feed_source_id: "source-id", canonical_url: article.canonicalUrl,
      publisher_url: article.publisherUrl, title: "Mission report", summary: "Mission summary.",
      published_at: null, language: "en", extracted_text: null,
      extraction_status: "extracted", content_fingerprint: "body-only-fingerprint"
    });
    expect(analysisWrite).toMatchObject({
      article_id: "article-id", vocabulary_version: "v1", word_count: 150,
      lexical_matches: [expect.objectContaining({ wordId: "analysis", occurrences: 3 })],
      topic_features: { sourceKey: "nasa-recently-published", attribution: "NASA" }
    });
    expect(JSON.stringify(writes)).not.toContain("Analysis of the mission provides evidence");
    expect(JSON.stringify(writes)).not.toContain("image_url");
  });

  it("treats global canonical or content unique conflicts as duplicates without overwriting legacy rows", async () => {
    const { client, writes } = recordingClient(true);
    const repository = new SupabaseFeedRepository(client);
    expect(await repository.saveCuratedArticle("source-id", article)).toBe("duplicate");
    expect(writes).toHaveLength(1);
    expect(writes[0].operation).toBe("insert");
  });

  it("promotes an existing pending article from the protected NASA source without storing body text", async () => {
    const writes: Array<{ table: string; operation: string; payload: Record<string, unknown> }> = [];
    const client = {
      from(table: string) {
        if (table === "articles") return {
          insert(payload: Record<string, unknown>) {
            writes.push({ table, operation: "insert", payload });
            return { select: () => ({ single: async () => ({ data: null, error: { code: "23505" } }) }) };
          },
          select: () => ({ eq: () => ({ maybeSingle: async () => ({
            data: { id: "pending-id", feed_source_id: "source-id", extraction_status: "pending" }, error: null
          }) }) }),
          update(payload: Record<string, unknown>) {
            writes.push({ table, operation: "update", payload });
            return { eq: async () => ({ error: null }) };
          }
        };
        return {
          upsert(payload: Record<string, unknown>) {
            writes.push({ table, operation: "upsert", payload });
            return Promise.resolve({ error: null });
          }
        };
      }
    } as unknown as SupabaseClient<Database>;
    const repository = new SupabaseFeedRepository(client);
    expect(await repository.saveCuratedArticle("source-id", article)).toBe("duplicate");
    expect(writes.find((write) => write.table === "article_analyses")?.payload)
      .toMatchObject({ article_id: "pending-id", lexical_matches: [expect.objectContaining({ wordId: "analysis" })] });
    expect(writes.find((write) => write.operation === "update")?.payload)
      .toMatchObject({ extracted_text: null, extraction_status: "extracted", analysis_version: "v1" });
    expect(writes.find((write) => write.operation === "update")?.payload).not.toHaveProperty("title");
  });

  it("removes only a newly inserted curated row when lexical persistence fails", async () => {
    const { client, writes } = recordingClient(false, true);
    const repository = new SupabaseFeedRepository(client);
    await expect(repository.saveCuratedArticle("source-id", article)).rejects.toThrow();
    expect(writes.find((write) => write.operation === "delete"))
      .toMatchObject({ table: "articles", payload: { id: "article-id" } });
  });

  it("records a failed source run without deleting articles", async () => {
    const { client, writes } = recordingClient();
    const repository = new SupabaseFeedRepository(client);
    await repository.finishCuratedRun("source-id", {
      status: "failed", fetched: 0, inserted: 0, duplicate: 0,
      etag: '"old"', lastModified: null, errorCode: "FETCH_FAILED"
    });
    expect(writes.find((write) => write.table === "feed_sources")?.payload)
      .toMatchObject({ fetch_status: "failed", etag: '"old"', last_error_code: "FETCH_FAILED" });
    expect(writes.find((write) => write.table === "feed_fetch_runs")?.payload)
      .toMatchObject({ feed_source_id: "source-id", status: "failed", error_code: "FETCH_FAILED" });
    expect(writes.some((write) => write.operation === "delete")).toBe(false);
  });
});
