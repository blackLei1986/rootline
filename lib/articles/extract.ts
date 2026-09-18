import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { canonicalizeArticleUrl } from "@/lib/articles/canonicalize";
import type { ExtractedArticle } from "@/types/articles";

const MIN_ARTICLE_WORDS = 120;

export class ArticleExtractionError extends Error {
  constructor(public readonly code: "UNREADABLE" | "TOO_SHORT", message: string) {
    super(message);
    this.name = "ArticleExtractionError";
  }
}

export function extractArticle(html: string, publisherUrl: string): ExtractedArticle {
  const normalizedPublisherUrl = canonicalizeArticleUrl(publisherUrl);
  const dom = new JSDOM(html, { url: normalizedPublisherUrl });
  const canonicalUrl = readCanonicalUrl(dom.window.document, normalizedPublisherUrl);
  const parsed = new Readability(dom.window.document.cloneNode(true) as Document).parse();
  if (!parsed?.textContent || !parsed.title) {
    throw new ArticleExtractionError("UNREADABLE", "The page does not contain a readable article.");
  }

  const text = parsed.textContent.replace(/\s+/g, " ").trim();
  const words = text.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g) ?? [];
  if (words.length < MIN_ARTICLE_WORDS) {
    throw new ArticleExtractionError("TOO_SHORT", "The article is too short for vocabulary analysis.");
  }

  return {
    publisherUrl: normalizedPublisherUrl,
    canonicalUrl,
    title: parsed.title.trim(),
    byline: parsed.byline?.trim() || null,
    excerpt: parsed.excerpt?.replace(/\s+/g, " ").trim() || null,
    text,
    wordCount: words.length,
    language: likelyLanguage(text)
  };
}

function readCanonicalUrl(document: Document, fallback: string): string {
  const href = document.querySelector<HTMLLinkElement>("link[rel~='canonical'][href]")?.href;
  if (!href) return fallback;
  try {
    const url = new URL(href, fallback);
    return ["http:", "https:"].includes(url.protocol)
      ? canonicalizeArticleUrl(url.toString())
      : fallback;
  } catch {
    return fallback;
  }
}

function likelyLanguage(text: string): string {
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length === 0) return "und";
  const latin = text.match(/[A-Za-z]/g)?.length ?? 0;
  return latin / letters.length >= 0.8 ? "en" : "und";
}
