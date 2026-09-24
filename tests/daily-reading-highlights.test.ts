import { describe, expect, it } from "vitest";
import { buildSummaryTokens, getHighlightLabel, type DailyReadingHighlightMatch } from "@/lib/reading/daily-reading-highlights";

const adapt: DailyReadingHighlightMatch = { wordId: "adapt-id", lemma: "adapt", surfaceForms: ["adapt"], level: "today" };
const recent: DailyReadingHighlightMatch = { wordId: "learn-id", lemma: "learn", surfaceForms: ["learn"], level: "recent-7-day" };

describe("Daily-3 summary highlights", () => {
  it("preserves exact summary text and punctuation while only linking frozen matches", () => {
    expect(buildSummaryTokens("Adapt, unknown!", [adapt])).toEqual([
      { text: "Adapt", wordId: "adapt-id", level: "today" },
      { text: ", unknown!" }
    ]);
  });

  it("matches case-insensitive lemmas and established inflection forms", () => {
    expect(buildSummaryTokens("LEARNED and adapting", [recent, adapt])).toEqual([
      { text: "LEARNED", wordId: "learn-id", level: "recent-7-day" },
      { text: " and ", },
      { text: "adapting", wordId: "adapt-id", level: "today" }
    ]);
  });

  it("gives Today precedence and supports honest legacy recent labels", () => {
    expect(buildSummaryTokens("adapt learn", [
      adapt, { ...adapt, level: "recent-legacy" }, recent
    ])).toEqual([
      { text: "adapt", wordId: "adapt-id", level: "today" },
      { text: " ", },
      { text: "learn", wordId: "learn-id", level: "recent-7-day" }
    ]);
    expect(getHighlightLabel("today")).toBe("今日词");
    expect(getHighlightLabel("recent-7-day")).toBe("近 7 日词");
    expect(getHighlightLabel("recent-legacy")).toBe("近期词");
  });
});
