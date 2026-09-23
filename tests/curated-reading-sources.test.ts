import { describe, expect, it } from "vitest";
import {
  curatedReadingSources,
  defineCuratedReadingSources,
  eligibleCuratedReadingSources,
  isEligibleCuratedReadingSource,
  serializeCuratedReadingSources,
  type CuratedReadingSource
} from "@/data/curated-reading-sources";
import { starterFeeds } from "@/data/starter-feeds";

const nasa: CuratedReadingSource = {
  key: "nasa-recently-published",
  title: "NASA Recently Published",
  feedUrl: "https://www.nasa.gov/feed/",
  siteUrl: "https://www.nasa.gov/",
  attribution: "NASA",
  category: "science",
  language: "en",
  qualityScore: 85,
  enabled: true,
  reviewedAt: "2026-09-23"
};

describe("curated reading sources", () => {
  it("rejects duplicate stable keys", () => {
    expect(() => defineCuratedReadingSources([nasa, { ...nasa, feedUrl: "https://example.org/feed" }]))
      .toThrow(/duplicate.*key/i);
  });

  it("rejects duplicate feed URLs even with different keys", () => {
    expect(() => defineCuratedReadingSources([nasa, { ...nasa, key: "other" }]))
      .toThrow(/duplicate.*url/i);
  });

  it.each([-1, 101, Number.NaN, 70.5])("rejects invalid quality score %s", (qualityScore) => {
    expect(() => defineCuratedReadingSources([{ ...nasa, qualityScore }]))
      .toThrow(/quality/i);
  });

  it("excludes disabled and non-English entries from eligibility", () => {
    expect(isEligibleCuratedReadingSource({ ...nasa, enabled: false })).toBe(false);
    expect(isEligibleCuratedReadingSource({ ...nasa, language: "es" })).toBe(false);
  });

  it("admits only the reviewed key and exact feed URL", () => {
    expect(isEligibleCuratedReadingSource(curatedReadingSources[0])).toBe(true);
    expect(isEligibleCuratedReadingSource(nasa)).toBe(false);
    expect(isEligibleCuratedReadingSource({ ...nasa, key: "unreviewed" })).toBe(false);
    expect(isEligibleCuratedReadingSource({ ...nasa, feedUrl: "https://example.org/feed" })).toBe(false);
    expect(eligibleCuratedReadingSources.map(({ key }) => key)).toEqual(["nasa-recently-published"]);
    expect(starterFeeds.filter(({ feedUrl }) => eligibleCuratedReadingSources.some((source) => source.feedUrl === feedUrl))).toHaveLength(1);
  });

  it("serializes the validated registry deterministically regardless of insertion order", () => {
    const other = { ...nasa, key: "unreviewed", feedUrl: "https://example.org/feed", enabled: false };
    const first = defineCuratedReadingSources([other, nasa]);
    const second = defineCuratedReadingSources([nasa, other]);
    expect(serializeCuratedReadingSources(first)).toBe(serializeCuratedReadingSources(second));
    expect(serializeCuratedReadingSources(curatedReadingSources)).toBe(serializeCuratedReadingSources([nasa]));
  });
});
