import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseFeed } from "@/lib/feeds/parser";

describe("feed parser", () => {
  it.each([
    ["rss2.xml", "https://example.com/feed.xml"],
    ["atom.xml", "https://example.com/atom.xml"]
  ])("normalizes %s", (fixture, sourceUrl) => {
    const feed = parseFeed(readFixture(fixture), sourceUrl);
    expect(feed.title).toBe("Memory Journal");
    expect(feed.entries[0]).toMatchObject({
      externalId: "post-1",
      url: "https://example.com/post-1",
      title: "How memory changes",
      summary: "A short summary."
    });
  });

  it("rejects XML that has no usable feed entries", () => {
    expect(() => parseFeed("<root><item /></root>", "https://example.com/feed"))
      .toThrowError(expect.objectContaining({ code: "INVALID_FEED" }));
  });
});

function readFixture(name: string) {
  return readFileSync(resolve(process.cwd(), "tests", "fixtures", name), "utf8");
}
