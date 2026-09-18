import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalizeArticleUrl } from "@/lib/articles/canonicalize";
import { extractArticle } from "@/lib/articles/extract";

describe("article extraction", () => {
  it("extracts attributed article text without page chrome or scripts", () => {
    const html = readFileSync(resolve(process.cwd(), "tests", "fixtures", "article.html"), "utf8");
    const article = extractArticle(html, "https://example.com/story?utm_campaign=rss");

    expect(article.title).toContain("deliberate reading");
    expect(article.byline).toContain("Ada Reader");
    expect(article.wordCount).toBeGreaterThanOrEqual(120);
    expect(article.text).not.toContain("Navigation should disappear");
    expect(article.text).not.toContain("never include this");
    expect(article.canonicalUrl).toBe("https://example.com/features/deliberate-reading");
  });

  it("removes tracking parameters but preserves semantic query parameters", () => {
    expect(
      canonicalizeArticleUrl("https://EXAMPLE.com/story?id=42&utm_source=mail&fbclid=abc#part")
    ).toBe("https://example.com/story?id=42");
  });

  it("ignores a non-HTTP canonical link", () => {
    const html = readFileSync(resolve(process.cwd(), "tests", "fixtures", "article.html"), "utf8")
      .replace("https://example.com/features/deliberate-reading?utm_source=feed", "javascript:alert(1)");
    expect(extractArticle(html, "https://example.com/original").canonicalUrl)
      .toBe("https://example.com/original");
  });
});
