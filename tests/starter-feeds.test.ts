import { describe, expect, it } from "vitest";
import { starterFeeds } from "@/data/starter-feeds";

describe("starter feeds", () => {
  it("is a small attributed list of unique HTTPS sources", () => {
    expect(starterFeeds.length).toBeGreaterThan(0);
    expect(starterFeeds.length).toBeLessThanOrEqual(12);
    expect(new Set(starterFeeds.map((source) => source.feedUrl)).size).toBe(starterFeeds.length);
    starterFeeds.forEach((source) => {
      expect(new URL(source.feedUrl).protocol).toBe("https:");
      expect(source.attribution.length).toBeGreaterThan(2);
      expect(source.topic.length).toBeGreaterThan(2);
    });
  });
});
