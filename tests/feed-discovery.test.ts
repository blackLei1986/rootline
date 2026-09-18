import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { discoverFeedUrls } from "@/lib/feeds/discovery";

describe("feed discovery", () => {
  it("returns only HTTP(S) alternate feed links", () => {
    const html = readFileSync(resolve(process.cwd(), "tests", "fixtures", "discovery.html"), "utf8");
    expect(discoverFeedUrls(html, "https://example.com/news/index.html")).toEqual([
      "https://example.com/feed.xml",
      "https://feeds.example.com/atom.xml"
    ]);
  });
});
