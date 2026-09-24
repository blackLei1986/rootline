// @vitest-environment node

import { describe, expect, it } from "vitest";
import { createCuratedIngestionJob, type CuratedIngestionRepository, type CuratedArticleRecord } from "@/lib/jobs/curated-ingestion";
import type { SafeTextResponse } from "@/lib/feeds/safe-fetch";

const feedUrl = "https://www.nasa.gov/news-release/feed/";
const articleUrl = "https://www.nasa.gov/news-release/mission-update/";
const body = "Analysis of the mission provides evidence about science and technology. ".repeat(35);

function articleHtml(language = "en-US", canonical = articleUrl, title = "Mission update") {
  return `<html lang="${language}"><head><title>${title}</title><link rel="canonical" href="${canonical}"></head>
    <body><article><h1>${title}</h1><p>${body}</p></article></body></html>`;
}

function rss(items: string, language = "en-US") {
  return `<?xml version="1.0"?><rss><channel><title>NASA News Releases</title><language>${language}</language>${items}</channel></rss>`;
}

function item(url: string, title = "Mission update", extra = "") {
  return `<item><guid>${url}</guid><title>${title}</title><link>${url}</link><description>Short NASA summary.</description>${extra}</item>`;
}

function response(finalUrl: string, text: string, status = 200): SafeTextResponse {
  return { finalUrl, text, status, contentType: status === 304 ? "" : "text/html", etag: null, lastModified: null };
}

class MemoryRepository implements CuratedIngestionRepository {
  articles: CuratedArticleRecord[] = [];
  runs: Array<{ status: string; errorCode?: string }> = [];
  resolveCount = 0;
  async resolveSource() {
    this.resolveCount++;
    return { id: "nasa-id", feedUrl, etag: null, lastModified: null };
  }
  async saveCuratedArticle(_sourceId: string, article: CuratedArticleRecord) {
    if (this.articles.some((saved) => saved.canonicalUrl === article.canonicalUrl || saved.contentFingerprint === article.contentFingerprint)) {
      return "duplicate" as const;
    }
    this.articles.push(article);
    return "inserted" as const;
  }
  async finishCuratedRun(_sourceId: string, input: { status: string; errorCode?: string }) {
    this.runs.push(input);
  }
}

describe("curated ingestion", () => {
  it("admits only the reviewed registry key and persists metadata plus lexical features, never body text", async () => {
    const repo = new MemoryRepository();
    const fetchText = async (url: string) => url === feedUrl
      ? response(feedUrl, rss(item(articleUrl, "Mission update", "<pubDate>Wed, 23 Sep 2026 10:00:00 GMT</pubDate>")))
      : response(articleUrl, articleHtml());
    const ingest = createCuratedIngestionJob({ repository: repo, fetchText });

    await expect(ingest("user-created-source")).rejects.toThrow(/curated source/i);
    expect(repo.resolveCount).toBe(0);
    const result = await ingest("nasa-recently-published");

    expect(result).toMatchObject({ status: "updated", inserted: 1, fetched: 1 });
    expect(repo.articles[0]).toMatchObject({
      sourceKey: "nasa-recently-published", attribution: "NASA", publisherUrl: articleUrl,
      canonicalUrl: articleUrl, title: "Mission update", summary: "Short NASA summary.",
      publishedAt: "2026-09-23T10:00:00.000Z", language: "en"
    });
    expect(repo.articles[0].analysis.lexicalMatches.some((match) => match.wordId)).toBe(true);
    expect(JSON.stringify(repo.articles[0])).not.toContain(body.trim());
    expect(repo.articles[0]).not.toHaveProperty("text");
  });

  it("uses a nullable publication date and collapses canonical and body duplicates", async () => {
    const repo = new MemoryRepository();
    const secondUrl = "https://science.nasa.gov/mission-copy/";
    const fetchText = async (url: string) => url === feedUrl
      ? response(feedUrl, rss([
        item(`${articleUrl}?utm_source=feed`), item(articleUrl),
        item(secondUrl, "Alternate mission title")
      ].join("")))
      : response(url, articleHtml("en-US", url, url === secondUrl ? "Alternate mission title" : "Mission update"));
    const result = await createCuratedIngestionJob({ repository: repo, fetchText })("nasa-recently-published");

    expect(result).toMatchObject({ inserted: 1, duplicate: 2 });
    expect(repo.articles).toHaveLength(1);
    expect(repo.articles[0].publishedAt).toBeNull();
  });

  it.each([
    ["Spanish item declaration", "<language>es</language>", "en-US"],
    ["Spanish page declaration", "", "es"],
    ["missing page declaration", "", ""],
    ["missing feed declaration", "", "en-US"]
  ])("rejects %s before persistence", async (reason, extra, htmlLanguage) => {
    const repo = new MemoryRepository();
    const feedLanguage = reason === "missing feed declaration" ? "" : "en-US";
    const fetchText = async (url: string) => url === feedUrl
      ? response(feedUrl, rss(item(articleUrl, "Mission update", extra), feedLanguage))
      : response(articleUrl, articleHtml(htmlLanguage));
    const result = await createCuratedIngestionJob({ repository: repo, fetchText })("nasa-recently-published");
    expect(result.inserted).toBe(0);
    expect(repo.articles).toHaveLength(0);
  });

  it("rejects non-NASA article and final redirect hosts", async () => {
    const repo = new MemoryRepository();
    const foreignUrl = "https://example.org/story";
    const fetchText = async (url: string) => url === feedUrl
      ? response(feedUrl, rss(item(foreignUrl) + item(articleUrl)))
      : response(foreignUrl, articleHtml());
    const result = await createCuratedIngestionJob({ repository: repo, fetchText })("nasa-recently-published");
    expect(result.inserted).toBe(0);
    expect(repo.articles).toHaveLength(0);
  });

  it("records feed failures without touching previously stored articles", async () => {
    const repo = new MemoryRepository();
    const previous = { canonicalUrl: articleUrl } as CuratedArticleRecord;
    repo.articles.push(previous);
    const ingest = createCuratedIngestionJob({ repository: repo, fetchText: async () => { throw Object.assign(new Error("offline"), { code: "FETCH_FAILED" }); } });
    const result = await ingest("nasa-recently-published");
    expect(result.status).toBe("failed");
    expect(repo.runs).toHaveLength(1);
    expect(repo.runs[0]).toMatchObject({ status: "failed", errorCode: "FETCH_FAILED" });
    expect(repo.articles).toEqual([previous]);
  });

  it("rejects a feed redirect to an unreviewed NASA feed path", async () => {
    const repo = new MemoryRepository();
    let fetches = 0;
    const fetchText = async () => { fetches++; return response("https://www.nasa.gov/feed/", rss(item(articleUrl))); };
    const result = await createCuratedIngestionJob({ repository: repo, fetchText })("nasa-recently-published");
    expect(result.status).toBe("failed");
    expect(repo.articles).toHaveLength(0);
    expect(fetches).toBe(1);
  });

  it("bounds article fetches to forty candidates", async () => {
    const repo = new MemoryRepository();
    let articleFetches = 0;
    const entries = Array.from({ length: 45 }, (_, index) => item(`https://www.nasa.gov/news-release/mission-${index}/`)).join("");
    const fetchText = async (url: string) => {
      if (url === feedUrl) return response(feedUrl, rss(entries));
      articleFetches++;
      return response(url, articleHtml("en-US", url));
    };
    await createCuratedIngestionJob({ repository: repo, fetchText })("nasa-recently-published");
    expect(articleFetches).toBe(40);
  });

  it("chooses the same metadata for duplicate canonical entries regardless of feed order", async () => {
    const run = async (titles: string[]) => {
      const repo = new MemoryRepository();
      const fetchText = async (url: string) => url === feedUrl
        ? response(feedUrl, rss(titles.map((title) => item(articleUrl, title)).join("")))
        : response(articleUrl, articleHtml());
      await createCuratedIngestionJob({ repository: repo, fetchText })("nasa-recently-published");
      return repo.articles[0].title;
    };
    expect(await run(["Zeta mission", "Alpha mission"])).toBe("Alpha mission");
    expect(await run(["Alpha mission", "Zeta mission"])).toBe("Alpha mission");
  });
});
