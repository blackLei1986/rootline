import { JSDOM } from "jsdom";
import { eligibleCuratedReadingSources, type CuratedReadingSource } from "@/data/curated-reading-sources";
import { canonicalizeArticleUrl } from "@/lib/articles/canonicalize";
import { extractArticle } from "@/lib/articles/extract";
import { fingerprintArticleContent } from "@/lib/articles/fingerprint";
import { parseFeed } from "@/lib/feeds/parser";
import { safeFetchText, type FetchKind, type SafeFetchPolicy } from "@/lib/feeds/safe-fetch";
import { analyzeArticleForLearner } from "@/lib/reading/analyze-production";
import { EMPTY_STORAGE } from "@/lib/storage";
import type { ArticleAnalysis } from "@/types/articles";
import { FEED_LIMITS, type FeedRefreshResult, type NormalizedFeedEntry } from "@/types/feeds";
import type { FeedRefreshSource } from "@/lib/jobs/feed-refresh";
import type { SafeTextResponse } from "@/lib/feeds/safe-fetch";

export interface CuratedArticleRecord {
  sourceKey: string;
  attribution: string;
  externalId: string;
  canonicalUrl: string;
  publisherUrl: string;
  title: string;
  author: string | null;
  summary: string | null;
  publishedAt: string | null;
  language: "en";
  contentFingerprint: string;
  analysis: ArticleAnalysis;
}

export interface CuratedIngestionRepository {
  resolveSource(source: CuratedReadingSource): Promise<FeedRefreshSource>;
  saveCuratedArticle(sourceId: string, article: CuratedArticleRecord): Promise<"inserted" | "duplicate">;
  finishCuratedRun(sourceId: string, input: {
    status: FeedRefreshResult["status"];
    fetched: number;
    inserted: number;
    duplicate: number;
    etag: string | null;
    lastModified: string | null;
    errorCode?: string;
  }): Promise<void>;
}

export interface CuratedIngestionResult extends FeedRefreshResult {
  rejected: number;
}

type FetchCuratedText = (
  url: string,
  kind: FetchKind,
  conditional: { etag?: string | null; lastModified?: string | null },
  policy: SafeFetchPolicy
) => Promise<SafeTextResponse>;

const publisherPolicy: SafeFetchPolicy = {
  allowedHostname: (hostname) => hostname === "nasa.gov" || hostname.endsWith(".nasa.gov"),
  requireHttps: true
};

export function createCuratedIngestionJob(dependencies: {
  repository: CuratedIngestionRepository;
  fetchText?: FetchCuratedText;
}) {
  const fetchText = dependencies.fetchText ?? ((url, kind, conditional, policy) =>
    safeFetchText(url, kind, undefined, conditional, policy));

  return async function ingestCuratedSource(sourceKey: string): Promise<CuratedIngestionResult> {
    const reviewed = eligibleCuratedReadingSources.find((source) => source.key === sourceKey);
    if (!reviewed) throw new Error(`Unreviewed curated source: ${sourceKey}`);
    const source = await dependencies.repository.resolveSource(reviewed);
    if (source.feedUrl !== reviewed.feedUrl) throw new Error("Curated source URL differs from the reviewed registry.");
    const result: CuratedIngestionResult = {
      sourceId: source.id, fetched: 0, inserted: 0, duplicate: 0, rejected: 0, status: "failed"
    };
    let etag = source.etag;
    let lastModified = source.lastModified;
    let failureCode: string | undefined;

    try {
      const feedResponse = await fetchText(reviewed.feedUrl, "feed", {
        etag: source.etag, lastModified: source.lastModified
      }, publisherPolicy);
      assertPublisherUrl(feedResponse.finalUrl);
      if (feedResponse.finalUrl !== reviewed.feedUrl) {
        throw new Error("Feed redirected away from the reviewed endpoint.");
      }
      etag = feedResponse.etag ?? source.etag;
      lastModified = feedResponse.lastModified ?? source.lastModified;
      if (feedResponse.status === 304) {
        result.status = "not-modified";
      } else {
        const feed = parseFeed(feedResponse.text, feedResponse.finalUrl);
        if (!isEnglish(feed.language)) throw new Error("Feed language is missing or not English.");
        const entries = uniqueBoundedEntries(feed.entries);
        result.fetched = entries.length;
        result.duplicate += Math.min(feed.entries.length, FEED_LIMITS.metadataCandidatesPerRun) - entries.length;
        const fingerprints = new Set<string>();
        for (const entry of entries) {
          try {
            if (entry.language && !isEnglish(entry.language)) throw new Error("Entry language is not English.");
            assertPublisherUrl(entry.url);
            const response = await fetchText(entry.url, "article", {}, publisherPolicy);
            assertPublisherUrl(response.finalUrl);
            if (!isEnglish(declaredHtmlLanguage(response.text))) throw new Error("Article language is missing or not English.");
            const extracted = extractArticle(response.text, response.finalUrl);
            assertPublisherUrl(extracted.canonicalUrl);
            if (extracted.language !== "en") throw new Error("Article content language is not English.");
            const contentFingerprint = fingerprintArticleContent(extracted.text);
            if (fingerprints.has(contentFingerprint)) {
              result.duplicate++;
              continue;
            }
            fingerprints.add(contentFingerprint);
            const analysis = await analyzeArticleForLearner({
              id: extracted.canonicalUrl,
              title: entry.title,
              text: extracted.text,
              wordCount: extracted.wordCount
            }, structuredClone(EMPTY_STORAGE));
            const saved = await dependencies.repository.saveCuratedArticle(source.id, {
              sourceKey: reviewed.key,
              attribution: reviewed.attribution,
              externalId: entry.externalId,
              canonicalUrl: extracted.canonicalUrl,
              publisherUrl: canonicalizeArticleUrl(response.finalUrl),
              title: entry.title,
              author: entry.author ?? extracted.byline,
              summary: (entry.summary || extracted.excerpt)?.slice(0, 500) ?? null,
              publishedAt: entry.publishedAt,
              language: "en",
              contentFingerprint,
              analysis
            });
            result[saved]++;
          } catch (error) {
            result.rejected++;
            failureCode ??= errorCode(error);
          }
        }
        result.status = failureCode ? "failed" : "updated";
      }
    } catch (error) {
      failureCode = errorCode(error);
    }
    // A partial run must retry the feed body; committing its validators could
    // turn the next request into a 304 and strand rejected entries.
    if (result.status === "failed") {
      etag = source.etag;
      lastModified = source.lastModified;
    }
    await dependencies.repository.finishCuratedRun(source.id, {
      status: result.status,
      fetched: result.fetched,
      inserted: result.inserted,
      duplicate: result.duplicate,
      etag,
      lastModified,
      ...(failureCode ? { errorCode: failureCode } : {})
    });
    return result;
  };
}

export async function ingestCuratedReadingSource(sourceKey: string): Promise<CuratedIngestionResult> {
  const [{ createAdminSupabaseClient }, { SupabaseFeedRepository }] = await Promise.all([
    import("@/lib/supabase/admin"),
    import("@/lib/repositories/supabase/feed-repository")
  ]);
  return createCuratedIngestionJob({
    repository: new SupabaseFeedRepository(createAdminSupabaseClient())
  })(sourceKey);
}

function assertPublisherUrl(value: string): void {
  const url = new URL(value);
  if (url.protocol !== "https:" || !publisherPolicy.allowedHostname(url.hostname)) {
    throw new Error("URL is outside the reviewed NASA publisher hosts.");
  }
}

function isEnglish(value: string | null | undefined): boolean {
  return /^en(?:-[a-z0-9]+)*$/i.test(value ?? "");
}

function declaredHtmlLanguage(html: string): string | null {
  const dom = new JSDOM(html);
  return dom.window.document.documentElement.getAttribute("lang");
}

function uniqueBoundedEntries(entries: NormalizedFeedEntry[]): NormalizedFeedEntry[] {
  const sorted = [...entries].sort((left, right) =>
    (right.publishedAt ?? "").localeCompare(left.publishedAt ?? "")
      || canonicalizeArticleUrl(left.url).localeCompare(canonicalizeArticleUrl(right.url))
      || left.externalId.localeCompare(right.externalId)
      || left.title.localeCompare(right.title)
      || left.summary.localeCompare(right.summary));
  const seen = new Set<string>();
  const unique: NormalizedFeedEntry[] = [];
  for (const entry of sorted) {
    if (unique.length >= FEED_LIMITS.metadataCandidatesPerRun) break;
    const canonicalUrl = canonicalizeArticleUrl(entry.url);
    if (seen.has(canonicalUrl)) continue;
    seen.add(canonicalUrl);
    unique.push(entry);
  }
  return unique;
}

function errorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error && typeof error.code === "string"
    ? error.code
    : "CURATED_FETCH_FAILED";
}
