import { createHash } from "node:crypto";
import { canonicalizeArticleUrl } from "@/lib/articles/canonicalize";
import type { ArticleIdentity, ExtractedArticle } from "@/types/articles";

export function fingerprintArticle(article: Pick<ExtractedArticle, "title" | "text">): string {
  const normalized = `${article.title}\n${article.text}`
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return createHash("sha256").update(normalized).digest("hex");
}

export function chooseArticleIdentity(input: {
  publisherUrl: string;
  canonicalUrl: string | null;
  contentFingerprint: string | null;
}): ArticleIdentity {
  const canonicalUrl = canonicalizeArticleUrl(input.canonicalUrl ?? input.publisherUrl);
  const identityKey = input.canonicalUrl
    ? `url:${canonicalUrl}`
    : input.contentFingerprint
      ? `content:${input.contentFingerprint}`
      : `url:${canonicalUrl}`;
  return {
    canonicalUrl,
    contentFingerprint: input.contentFingerprint,
    identityKey
  };
}
