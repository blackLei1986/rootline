import { parseFeed } from "@/lib/feeds/parser";
import { safeFetchText, type SafeTextResponse } from "@/lib/feeds/safe-fetch";
import { processJobLocks, type JobLocks } from "@/lib/jobs/locks";
import type { FeedRefreshResult, NormalizedFeedEntry } from "@/types/feeds";

export interface FeedRefreshSource {
  id: string;
  feedUrl: string;
  etag: string | null;
  lastModified: string | null;
}

export interface FeedRefreshRepository {
  getSource(sourceId: string): Promise<FeedRefreshSource | null>;
  saveEntries(
    sourceId: string,
    entries: NormalizedFeedEntry[]
  ): Promise<{ inserted: number; duplicate: number }>;
  finishRefresh(
    sourceId: string,
    input: {
      status: FeedRefreshResult["status"];
      etag: string | null;
      lastModified: string | null;
      errorCode?: string;
    }
  ): Promise<void>;
}

type FetchText = (
  url: string,
  kind: "feed",
  dependencies: undefined,
  conditional: { etag: string | null; lastModified: string | null }
) => Promise<SafeTextResponse>;

export function createFeedRefreshJob(dependencies: {
  repository: FeedRefreshRepository;
  fetchText?: FetchText;
  locks?: JobLocks;
}) {
  const fetchText = dependencies.fetchText ?? safeFetchText;
  const locks = dependencies.locks ?? processJobLocks;

  return async function refreshFeed(sourceId: string): Promise<FeedRefreshResult> {
    const release = await locks.tryAcquire(`feed:${sourceId}`);
    if (!release) return failedResult(sourceId);

    try {
      const source = await dependencies.repository.getSource(sourceId);
      if (!source) return failedResult(sourceId);
      const response = await fetchText(source.feedUrl, "feed", undefined, {
        etag: source.etag,
        lastModified: source.lastModified
      });

      if (response.status === 304) {
        await dependencies.repository.finishRefresh(sourceId, {
          status: "not-modified",
          etag: response.etag ?? source.etag,
          lastModified: response.lastModified ?? source.lastModified
        });
        return { sourceId, fetched: 0, inserted: 0, duplicate: 0, status: "not-modified" };
      }

      const feed = parseFeed(response.text, response.finalUrl);
      const counts = await dependencies.repository.saveEntries(sourceId, feed.entries);
      await dependencies.repository.finishRefresh(sourceId, {
        status: "updated",
        etag: response.etag,
        lastModified: response.lastModified
      });
      return {
        sourceId,
        fetched: feed.entries.length,
        inserted: counts.inserted,
        duplicate: counts.duplicate,
        status: "updated"
      };
    } catch (error) {
      await dependencies.repository.finishRefresh(sourceId, {
        status: "failed",
        etag: null,
        lastModified: null,
        errorCode: errorCode(error)
      });
      return failedResult(sourceId);
    } finally {
      release();
    }
  };
}

export async function refreshFeed(sourceId: string): Promise<FeedRefreshResult> {
  const [{ createAdminSupabaseClient }, { SupabaseFeedRepository }] = await Promise.all([
    import("@/lib/supabase/admin"),
    import("@/lib/repositories/supabase/feed-repository")
  ]);
  const repository = new SupabaseFeedRepository(createAdminSupabaseClient());
  return createFeedRefreshJob({ repository })(sourceId);
}

function failedResult(sourceId: string): FeedRefreshResult {
  return { sourceId, fetched: 0, inserted: 0, duplicate: 0, status: "failed" };
}

function errorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : "FETCH_FAILED";
}
