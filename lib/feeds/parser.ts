import { XMLParser } from "fast-xml-parser";
import { JSDOM } from "jsdom";
import { FeedNetworkError } from "@/lib/feeds/network-policy";
import type { NormalizedFeed, NormalizedFeedEntry } from "@/types/feeds";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  processEntities: false,
  parseTagValue: false,
  trimValues: true
});

export function parseFeed(xml: string, sourceUrl: string): NormalizedFeed {
  try {
    const value = parser.parse(xml) as Record<string, unknown>;
    if (isRecord(value.rss)) return parseRss(value.rss, sourceUrl);
    if (isRecord(value.feed)) return parseAtom(value.feed, sourceUrl);
  } catch (error) {
    if (error instanceof FeedNetworkError) throw error;
  }
  throw invalidFeed();
}

function parseRss(rss: Record<string, unknown>, sourceUrl: string): NormalizedFeed {
  const channel = asRecord(rss.channel);
  const entries = asArray(channel.item)
    .map((item) => normalizeRssEntry(asRecord(item), sourceUrl))
    .filter((item): item is NormalizedFeedEntry => item !== null);
  if (entries.length === 0) throw invalidFeed();
  return {
    title: requiredText(channel.title),
    siteUrl: optionalUrl(text(channel.link), sourceUrl),
    feedUrl: new URL(sourceUrl).toString(),
    description: optionalText(channel.description),
    entries
  };
}

function parseAtom(feed: Record<string, unknown>, sourceUrl: string): NormalizedFeed {
  const entries = asArray(feed.entry)
    .map((item) => normalizeAtomEntry(asRecord(item), sourceUrl))
    .filter((item): item is NormalizedFeedEntry => item !== null);
  if (entries.length === 0) throw invalidFeed();
  const links = asArray(feed.link).map(asRecord);
  const alternate = links.find((link) => !link.rel || link.rel === "alternate");
  return {
    title: requiredText(feed.title),
    siteUrl: optionalUrl(text(alternate?.href), sourceUrl),
    feedUrl: new URL(sourceUrl).toString(),
    description: optionalText(feed.subtitle),
    entries
  };
}

function normalizeRssEntry(
  item: Record<string, unknown>,
  sourceUrl: string
): NormalizedFeedEntry | null {
  const url = optionalUrl(text(item.link), sourceUrl);
  const title = optionalText(item.title);
  if (!url || !title) return null;
  return {
    externalId: optionalText(item.guid) ?? url,
    url,
    title,
    summary: optionalText(item.description) ?? "",
    publishedAt: isoDate(item.pubDate),
    author: optionalText(item.author ?? item.creator)
  };
}

function normalizeAtomEntry(
  item: Record<string, unknown>,
  sourceUrl: string
): NormalizedFeedEntry | null {
  const links = asArray(item.link).map(asRecord);
  const alternate = links.find((link) => !link.rel || link.rel === "alternate") ?? links[0];
  const url = optionalUrl(text(alternate?.href), sourceUrl);
  const title = optionalText(item.title);
  if (!url || !title) return null;
  const author = asRecord(item.author);
  return {
    externalId: optionalText(item.id) ?? url,
    url,
    title,
    summary: optionalText(item.summary ?? item.content) ?? "",
    publishedAt: isoDate(item.published ?? item.updated),
    author: optionalText(author.name)
  };
}

function optionalText(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const decoded = JSDOM.fragment(raw).textContent ?? "";
  const normalized = JSDOM.fragment(decoded).textContent?.replace(/\s+/g, " ").trim() ?? "";
  return normalized || null;
}

function requiredText(value: unknown): string {
  return optionalText(value) ?? "Untitled feed";
}

function text(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (isRecord(value)) {
    const candidate = value["#text"] ?? value["__cdata"];
    return typeof candidate === "string" ? candidate.trim() : "";
  }
  return "";
}

function optionalUrl(value: string, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function isoDate(value: unknown): string | null {
  const date = new Date(text(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function asArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function asRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function invalidFeed(): FeedNetworkError {
  return new FeedNetworkError("INVALID_FEED", "The document is not a usable RSS or Atom feed.");
}
