import { describe, expect, it } from "vitest";
import { chooseArticleIdentity } from "@/lib/articles/fingerprint";

describe("article identity", () => {
  it("prefers a canonical URL and falls back to a content fingerprint", () => {
    const byUrl = chooseArticleIdentity({
      publisherUrl: "https://example.com/from-feed",
      canonicalUrl: "https://example.com/story",
      contentFingerprint: "fingerprint-1"
    });
    const duplicateUrl = chooseArticleIdentity({
      publisherUrl: "https://mirror.example/story",
      canonicalUrl: "https://example.com/story?utm_source=other",
      contentFingerprint: "fingerprint-2"
    });
    expect(byUrl.identityKey).toBe(duplicateUrl.identityKey);

    expect(chooseArticleIdentity({
      publisherUrl: "https://a.example/story",
      canonicalUrl: null,
      contentFingerprint: "same-content"
    }).identityKey).toBe("content:same-content");
  });
});
