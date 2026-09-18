export const FEED_LIMITS = Object.freeze({
  candidateCount: 3,
  opmlSources: 200,
  metadataCandidatesPerRun: 40
});

export type FeedFetchState = "idle" | "fetching" | "ready" | "failed";
export type FeedErrorCode =
  | "INVALID_URL"
  | "BLOCKED_ADDRESS"
  | "TOO_MANY_REDIRECTS"
  | "RESPONSE_TOO_LARGE"
  | "UNSUPPORTED_CONTENT_TYPE"
  | "INVALID_FEED"
  | "FETCH_FAILED";

export interface NormalizedFeedEntry {
  externalId: string;
  url: string;
  title: string;
  summary: string;
  publishedAt: string | null;
  author: string | null;
}

export interface NormalizedFeed {
  title: string;
  siteUrl: string | null;
  feedUrl: string;
  description: string | null;
  entries: NormalizedFeedEntry[];
}

export interface OpmlSubscription {
  title: string;
  feedUrl: string;
  siteUrl: string | null;
}

export interface FeedSourceDTO {
  id: string;
  title: string;
  feedUrl: string;
  siteUrl: string | null;
  enabled: boolean;
  fetchState: FeedFetchState;
  lastFetchedAt: string | null;
}

export interface FeedRefreshResult {
  sourceId: string;
  fetched: number;
  inserted: number;
  duplicate: number;
  status: "updated" | "not-modified" | "failed";
}
