import { describe, expect, it } from "vitest";
import { buildSummaryTokens, getHighlightLabel, type DailyReadingHighlightMatch } from "@/lib/reading/daily-reading-highlights";
import { getProductionReadingIndex } from "@/lib/reading/production-index";

const adapt: DailyReadingHighlightMatch = { wordId: "adapt-id", lemma: "adapt", surfaceForms: ["adapt"], level: "today" };
const recent: DailyReadingHighlightMatch = { wordId: "learn-id", lemma: "learn", surfaceForms: ["learn"], level: "recent-7-day" };
const knownVocabulary = [{ lemma: "adapt", surfaceForms: ["adapt"] }, { lemma: "learn", surfaceForms: ["learn"] }];

describe("Daily-3 summary highlights", () => {
  it("preserves exact summary text and punctuation while only linking frozen matches", () => {
    expect(buildSummaryTokens("Adapt, unknown!", [adapt], knownVocabulary)).toEqual([
      { text: "Adapt", wordId: "adapt-id", level: "today" },
      { text: ", unknown!" }
    ]);
  });

  it("matches case-insensitive lemmas and established inflection forms", () => {
    expect(buildSummaryTokens("LEARNED and adapting", [recent, adapt], knownVocabulary)).toEqual([
      { text: "LEARNED", wordId: "learn-id", level: "recent-7-day" },
      { text: " and ", },
      { text: "adapting", wordId: "adapt-id", level: "today" }
    ]);
  });

  it("does not highlight a separate production lemma as an inflection", async () => {
    const index = await getProductionReadingIndex();
    const newEntry = index.byLemma.get("new");
    expect(newEntry).toBeDefined();
    expect(index.byLemma.has("news")).toBe(true);
    const newWord: DailyReadingHighlightMatch = { wordId: newEntry!.id, lemma: newEntry!.lemma, surfaceForms: newEntry!.surfaceForms, level: "today" };
    expect(buildSummaryTokens("The new study is in the news.", [newWord], [...index.byLemma.values()])).toEqual([
      { text: "The " },
      { text: "new", wordId: newEntry!.id, level: "today" },
      { text: " study is in the news." }
    ]);
  });

  it("gives Today precedence and supports honest legacy recent labels", () => {
    expect(buildSummaryTokens("adapt learn", [
      adapt, { ...adapt, level: "recent-legacy" }, recent
    ], knownVocabulary)).toEqual([
      { text: "adapt", wordId: "adapt-id", level: "today" },
      { text: " ", },
      { text: "learn", wordId: "learn-id", level: "recent-7-day" }
    ]);
    expect(getHighlightLabel("today")).toBe("今日词");
    expect(getHighlightLabel("recent-7-day")).toBe("近 7 日词");
    expect(getHighlightLabel("recent-legacy")).toBe("近期词");
  });
});
