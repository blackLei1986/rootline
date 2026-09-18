import { XMLParser } from "fast-xml-parser";
import { decodeAndNormalizeWhitespace } from "@/lib/feeds/html-entities";
import { FEED_LIMITS, type OpmlSubscription } from "@/types/feeds";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  processEntities: false,
  parseTagValue: false,
  trimValues: true
});

export function parseOpml(xml: string): OpmlSubscription[] {
  let parsed: unknown;
  try {
    parsed = parser.parse(xml);
  } catch {
    return [];
  }
  const body = record(record(parsed).opml).body;
  const outlines = flattenOutlines(record(body).outline);
  const unique = new Map<string, OpmlSubscription>();

  for (const outline of outlines) {
    const feedUrl = safeUrl(string(outline.xmlUrl));
    if (!feedUrl || unique.has(feedUrl)) continue;
    const siteUrl = safeUrl(string(outline.htmlUrl));
    unique.set(feedUrl, {
      title: plainText(string(outline.title || outline.text)) || new URL(feedUrl).hostname,
      feedUrl,
      siteUrl
    });
    if (unique.size >= FEED_LIMITS.opmlSources) break;
  }
  return [...unique.values()];
}

export function serializeOpml(subscriptions: OpmlSubscription[]): string {
  const outlines = subscriptions.slice(0, FEED_LIMITS.opmlSources).map((subscription) => {
    const site = subscription.siteUrl ? ` htmlUrl="${escapeXml(subscription.siteUrl)}"` : "";
    return `    <outline type="rss" text="${escapeXml(subscription.title)}" title="${escapeXml(subscription.title)}" xmlUrl="${escapeXml(subscription.feedUrl)}"${site} />`;
  });
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    "  <head><title>Rootline subscriptions</title></head>",
    "  <body>",
    ...outlines,
    "  </body>",
    "</opml>"
  ].join("\n");
}

function flattenOutlines(value: unknown): Array<Record<string, unknown>> {
  const values = value === undefined ? [] : Array.isArray(value) ? value : [value];
  return values.flatMap((item) => {
    const outline = record(item);
    return [outline, ...flattenOutlines(outline.outline)];
  });
}

function safeUrl(value: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function plainText(value: string): string {
  return decodeAndNormalizeWhitespace(value);
}

function string(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
