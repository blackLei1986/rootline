export interface CuratedReadingSource {
  key: string;
  title: string;
  feedUrl: string;
  siteUrl: string;
  attribution: string;
  category: string;
  language: string;
  qualityScore: number;
  enabled: boolean;
  reviewedAt: string;
}

// This code-managed key/URL map is the admission boundary. Starter feeds and
// user subscriptions are never implicitly promoted into the curated corpus.
const reviewedFeedUrls: Readonly<Record<string, string>> = Object.freeze({
  "nasa-recently-published": "https://www.nasa.gov/news-release/feed/"
});

export function defineCuratedReadingSources(sources: readonly CuratedReadingSource[]): readonly CuratedReadingSource[] {
  const keys = new Set<string>();
  const urls = new Set<string>();
  const validated = sources.map((source) => {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source.key)) throw new Error("Invalid source key");
    if (keys.has(source.key)) throw new Error(`Duplicate source key: ${source.key}`);
    keys.add(source.key);

    const feedUrl = new URL(source.feedUrl);
    const siteUrl = new URL(source.siteUrl);
    if (feedUrl.protocol !== "https:" || siteUrl.protocol !== "https:") throw new Error("Source URLs must use HTTPS");
    const normalizedUrl = feedUrl.toString();
    if (urls.has(normalizedUrl)) throw new Error(`Duplicate feed URL: ${normalizedUrl}`);
    urls.add(normalizedUrl);

    if (!Number.isInteger(source.qualityScore) || source.qualityScore < 0 || source.qualityScore > 100) {
      throw new Error(`Invalid quality score: ${source.key}`);
    }
    if (!source.title.trim() || !source.attribution.trim() || !source.category.trim()) {
      throw new Error(`Missing source metadata: ${source.key}`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(source.reviewedAt)) throw new Error(`Invalid review date: ${source.key}`);
    return Object.freeze({ ...source });
  });
  return Object.freeze(validated.sort((left, right) => left.key.localeCompare(right.key)));
}

export const curatedReadingSources = defineCuratedReadingSources([
  {
    key: "nasa-recently-published",
    title: "NASA News Releases",
    feedUrl: "https://www.nasa.gov/news-release/feed/",
    siteUrl: "https://www.nasa.gov/",
    attribution: "NASA",
    category: "science",
    language: "en",
    qualityScore: 85,
    enabled: true,
    reviewedAt: "2026-09-23"
  }
]);

export function isEligibleCuratedReadingSource(source: CuratedReadingSource): boolean {
  return source.enabled
    && source.language === "en"
    && reviewedFeedUrls[source.key] === source.feedUrl;
}

export const eligibleCuratedReadingSources = Object.freeze(curatedReadingSources.filter(isEligibleCuratedReadingSource));

export function serializeCuratedReadingSources(sources: readonly CuratedReadingSource[]): string {
  return JSON.stringify([...sources]
    .sort((left, right) => left.key.localeCompare(right.key))
    .map((source) => ({
      key: source.key,
      title: source.title,
      feedUrl: source.feedUrl,
      siteUrl: source.siteUrl,
      attribution: source.attribution,
      category: source.category,
      language: source.language,
      qualityScore: source.qualityScore,
      enabled: source.enabled,
      reviewedAt: source.reviewedAt
    })));
}
