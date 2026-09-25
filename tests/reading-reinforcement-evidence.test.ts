import { describe, expect, it } from "vitest";
import { createReadingReinforcementService } from "@/lib/reading/reinforcement/service";
import type { DailyReadingRecommendation } from "@/types/reading-recommendations";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

const article = {
  articleId: "article-1", summary: "The team adapted its method and analyzed results.",
  matchedTodayWordIds: ["adapt"], matchedRecentWordIds: ["analyze"], matchedRecent7DayWordIds: ["analyze"]
} as DailyReadingRecommendation;
const vocabulary = [
  {id: "adapt", lemma: "adapt", surfaceForms: ["adapt", "adapted"]},
  {id: "analyze", lemma: "analyze", surfaceForms: ["analyze", "analyzed"]}
] as ProductionVocabularyEntry[];

describe("Reading weak evidence", () => {
  it("writes one exposure and one detail event for an actually displayed match", async () => {
    const seen = new Set<string>();
    const events: Array<{id: string; type: string; wordId: string}> = [];
    const service = createReadingReinforcementService({
      getCurrentArticle: async () => ({article, learningDate: "2026-09-25"}),
      getVocabulary: async () => vocabulary,
      repository: {appendWeakEvidence: async (_userId, event) => {
        if (seen.has(event.id)) return false;
        seen.add(event.id); events.push(event); return true;
      }}
    });
    expect(await service.recordReadingEvidence("owner", "article-1", "exposure", "adapt")).toEqual({saved: true});
    expect(await service.recordReadingEvidence("owner", "article-1", "exposure", "adapt")).toEqual({saved: false});
    expect(await service.recordReadingEvidence("owner", "article-1", "detail-open", "adapt")).toEqual({saved: true});
    expect(events).toEqual([
      expect.objectContaining({id: "reading-exposure:article-1:adapt", type: "reading_encounter", wordId: "adapt"}),
      expect.objectContaining({id: "reading-lookup:article-1:adapt", type: "reading_lookup", wordId: "adapt"})
    ]);
  });

  it("rejects an old article, forged word, and word absent from the displayed summary", async () => {
    let writes = 0;
    const service = createReadingReinforcementService({
      getCurrentArticle: async (_userId, id) => id === "article-1" ? {article, learningDate: "2026-09-25"} : null,
      getVocabulary: async () => vocabulary,
      repository: {appendWeakEvidence: async () => {writes++; return true;}}
    });
    expect(await service.recordReadingEvidence("owner", "old", "exposure", "adapt")).toBeNull();
    expect(await service.recordReadingEvidence("owner", "article-1", "exposure", "forged")).toBeNull();
    const missing = {...article, summary: "The team changed its method."};
    const missingService = createReadingReinforcementService({
      getCurrentArticle: async () => ({article: missing, learningDate: "2026-09-25"}),
      getVocabulary: async () => vocabulary,
      repository: {appendWeakEvidence: async () => {writes++; return true;}}
    });
    expect(await missingService.recordReadingEvidence("owner", "article-1", "exposure", "adapt")).toBeNull();
    expect(writes).toBe(0);
  });
});
