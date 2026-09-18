import { getServerEnv } from "@/lib/config/env";
import {
  assertPublicHttpUrl,
  FeedNetworkError,
  nodeHostResolver,
  type HostResolver
} from "@/lib/feeds/network-policy";

export type FetchKind = "feed" | "article";

export const SAFE_FETCH_LIMITS = Object.freeze({
  feedBytes: 2 * 1024 * 1024,
  articleBytes: 5 * 1024 * 1024,
  redirects: 3,
  timeoutMs: 15_000
});

export interface SafeFetchDeps {
  resolver: HostResolver;
  fetchImpl: typeof fetch;
  now: () => Date;
  contact?: string;
}

export interface SafeTextResponse {
  finalUrl: string;
  status: number;
  contentType: string;
  text: string;
  etag: string | null;
  lastModified: string | null;
}

export async function safeFetchText(
  url: string,
  kind: FetchKind,
  dependencies?: SafeFetchDeps,
  conditionalHeaders: { etag?: string | null; lastModified?: string | null } = {}
): Promise<SafeTextResponse> {
  const deps = dependencies ?? defaultDependencies();
  let current = parseUrl(url);
  let redirects = 0;

  while (true) {
    await assertPublicHttpUrl(current, deps.resolver);
    const response = await deps.fetchImpl(current, {
      method: "GET",
      redirect: "manual",
      credentials: "omit",
      signal: AbortSignal.timeout(SAFE_FETCH_LIMITS.timeoutMs),
      headers: requestHeaders(kind, deps.contact ?? "security@example.invalid", conditionalHeaders)
    });

    if (isRedirect(response.status)) {
      if (redirects >= SAFE_FETCH_LIMITS.redirects) {
        throw new FeedNetworkError("TOO_MANY_REDIRECTS", "Remote content redirected too many times.");
      }
      const location = response.headers.get("location");
      if (!location) throw new FeedNetworkError("FETCH_FAILED", "Redirect response has no location.");
      current = parseUrl(new URL(location, current).toString());
      redirects += 1;
      continue;
    }

    const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
    if (response.status === 304) return responseDto(current, response, contentType, "");
    if (!response.ok) throw new FeedNetworkError("FETCH_FAILED", `Remote server returned ${response.status}.`);
    assertContentType(kind, contentType);
    const text = await readLimitedText(
      response,
      kind === "feed" ? SAFE_FETCH_LIMITS.feedBytes : SAFE_FETCH_LIMITS.articleBytes
    );
    return responseDto(current, response, contentType, text);
  }
}

function defaultDependencies(): SafeFetchDeps {
  const env = getServerEnv();
  return {
    resolver: nodeHostResolver,
    fetchImpl: fetch,
    now: () => new Date(),
    contact: env.FEED_FETCH_CONTACT
  };
}

function parseUrl(value: string): URL {
  try {
    return new URL(value);
  } catch {
    throw new FeedNetworkError("INVALID_URL", "Remote URL is invalid.");
  }
}

function requestHeaders(
  kind: FetchKind,
  contact: string,
  conditional: { etag?: string | null; lastModified?: string | null }
): Headers {
  const headers = new Headers({
    accept: kind === "feed"
      ? "application/atom+xml, application/rss+xml, application/xml, text/xml;q=0.9"
      : "text/html, application/xhtml+xml;q=0.9",
    "user-agent": `RootlineVocabularyReader/1.0 (+${contact})`
  });
  if (conditional.etag) headers.set("if-none-match", conditional.etag);
  if (conditional.lastModified) headers.set("if-modified-since", conditional.lastModified);
  return headers;
}

function assertContentType(kind: FetchKind, contentType: string): void {
  const allowed = kind === "feed"
    ? ["application/rss+xml", "application/atom+xml", "application/xml", "text/xml"]
    : ["text/html", "application/xhtml+xml"];
  if (!allowed.includes(contentType)) {
    throw new FeedNetworkError("UNSUPPORTED_CONTENT_TYPE", "Remote content type is not supported.");
  }
}

async function readLimitedText(response: Response, limit: number): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > limit) {
    throw new FeedNetworkError("RESPONSE_TOO_LARGE", "Remote response is too large.");
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > limit) {
      await reader.cancel();
      throw new FeedNetworkError("RESPONSE_TOO_LARGE", "Remote response is too large.");
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return text + decoder.decode();
}

function responseDto(
  url: URL,
  response: Response,
  contentType: string,
  text: string
): SafeTextResponse {
  return {
    finalUrl: url.toString(),
    status: response.status,
    contentType,
    text,
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified")
  };
}

function isRedirect(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}
