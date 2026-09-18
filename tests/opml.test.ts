import { describe, expect, it } from "vitest";
import { parseOpml, serializeOpml } from "@/lib/feeds/opml";

describe("OPML", () => {
  it("round-trips unique subscription titles and URLs", () => {
    const input = [
      { title: "Science & Learning", feedUrl: "https://example.com/feed.xml", siteUrl: "https://example.com/" },
      { title: "News", feedUrl: "https://news.example/rss", siteUrl: null }
    ];
    expect(parseOpml(serializeOpml(input))).toEqual(input);
  });

  it("drops executable and duplicate outlines", () => {
    const xml = `<opml version="2.0"><body>
      <outline text="Safe" xmlUrl="https://example.com/feed" />
      <outline text="Duplicate" xmlUrl="https://example.com/feed" />
      <outline text="Bad" xmlUrl="javascript:alert(1)" />
    </body></opml>`;
    expect(parseOpml(xml)).toEqual([
      { title: "Safe", feedUrl: "https://example.com/feed", siteUrl: null }
    ]);
  });
});
