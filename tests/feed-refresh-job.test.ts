// @vitest-environment node

import { describe, expect, it, vi } from "vitest";
import { createFeedRefreshJob, type FeedRefreshRepository } from "@/lib/jobs/feed-refresh";
import { InMemoryJobLocks } from "@/lib/jobs/locks";
import type { NormalizedFeedEntry } from "@/types/feeds";

describe("feed refresh job", () => {
  it("sends conditional validators and treats 304 as no new records", async () => {
    const repository = new MemoryFeedRepository();
    const fetchText = vi.fn(async (_url, _kind, _deps, conditional) => ({
      finalUrl: "https://example.com/feed.xml",
      status: 304,
      contentType: "application/rss+xml",
      text: "",
      etag: '"v1"',
      lastModified: "Wed, 16 Sep 2026 00:00:00 GMT",
      conditional
    }));
    const refreshFeed = createFeedRefreshJob({ repository, fetchText, locks: new InMemoryJobLocks() });

    const result = await refreshFeed("source-1");

    expect(result).toMatchObject({ status: "not-modified", inserted: 0, duplicate: 0 });
    expect(fetchText.mock.calls[0][3]).toEqual({
      etag: '"old"',
      lastModified: "Tue, 15 Sep 2026 00:00:00 GMT"
    });
  });

  it("upserts repeated entries once and permits one concurrent source refresh", async () => {
    const repository = new MemoryFeedRepository();
    let releaseFetch: (() => void) | undefined;
    const waiting = new Promise<void>((resolve) => { releaseFetch = resolve; });
    const fetchText = vi.fn(async () => {
      await waiting;
      return {
        finalUrl: "https://example.com/feed.xml",
        status: 200,
        contentType: "application/rss+xml",
        text: rssWithDuplicateEntry,
        etag: '"v2"',
        lastModified: null
      };
    });
    const refreshFeed = createFeedRefreshJob({ repository, fetchText, locks: new InMemoryJobLocks() });
    const first = refreshFeed("source-1");
    const second = refreshFeed("source-1");
    releaseFetch?.();
    const results = await Promise.all([first, second]);

    expect(fetchText).toHaveBeenCalledTimes(1);
    expect(results.map((result) => result.status).sort()).toEqual(["failed", "updated"]);
    expect(repository.entries).toHaveLength(1);
  });
});

class MemoryFeedRepository implements FeedRefreshRepository {
  entries: NormalizedFeedEntry[] = [];

  async getSource() {
    return {
      id: "source-1",
      feedUrl: "https://example.com/feed.xml",
      etag: '"old"',
      lastModified: "Tue, 15 Sep 2026 00:00:00 GMT"
    };
  }

  async saveEntries(_sourceId: string, entries: NormalizedFeedEntry[]) {
    let inserted = 0;
    let duplicate = 0;
    for (const entry of entries) {
      if (this.entries.some((item) => item.externalId === entry.externalId)) duplicate += 1;
      else { this.entries.push(entry); inserted += 1; }
    }
    return { inserted, duplicate };
  }

  async finishRefresh() {}
}

const rssWithDuplicateEntry = `<?xml version="1.0"?><rss version="2.0"><channel><title>Example</title><link>https://example.com</link>
<item><guid>same</guid><title>First</title><link>https://example.com/first</link><description>Summary</description></item>
<item><guid>same</guid><title>First</title><link>https://example.com/first</link><description>Summary</description></item>
</channel></rss>`;
