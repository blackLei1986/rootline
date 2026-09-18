import { JSDOM } from "jsdom";

const FEED_TYPES = new Set([
  "application/rss+xml",
  "application/atom+xml",
  "application/feed+json"
]);

export function discoverFeedUrls(html: string, pageUrl: string): string[] {
  const document = new JSDOM(html, { url: pageUrl }).window.document;
  const found = new Set<string>();

  for (const element of document.querySelectorAll<HTMLLinkElement>("link[rel~='alternate'][href]")) {
    if (!FEED_TYPES.has(element.type.toLowerCase())) continue;
    try {
      const url = new URL(element.getAttribute("href") ?? "", pageUrl);
      if (["http:", "https:"].includes(url.protocol)) found.add(url.toString());
    } catch {
      // Ignore malformed discovery hints and continue checking the remaining links.
    }
  }
  return [...found];
}
