import { describe, expect, it } from "vitest";
import { recordArticleEncounter, type ArticleEncounterRow, type ArticleEncounterStore } from "@/lib/reading/encounters";
import { calculateVocabularyPriorityScore } from "@/lib/vocabulary-scoring";

describe("Reading encounter diversity", () => {
  it("counts repeated occurrences once per article and source", async () => {
    const store = new MemoryEncounterStore();
    const first = await recordArticleEncounter({ userId: "user-1", wordId: "retain", articleId: "a-1", sourceKey: "source-a", occurrenceCount: 5, occurredAt: "2026-09-17T08:00:00.000Z", operationId: "op-1" }, store);
    expect(first).toEqual({ totalOccurrences: 5, distinctArticles: 1, distinctSources: 1, lastEncounterAt: "2026-09-17T08:00:00.000Z" });

    const second = await recordArticleEncounter({ userId: "user-1", wordId: "retain", articleId: "a-2", sourceKey: "source-a", occurrenceCount: 2, occurredAt: "2026-09-17T09:00:00.000Z", operationId: "op-2" }, store);
    expect(second).toMatchObject({ totalOccurrences: 7, distinctArticles: 2, distinctSources: 1 });

    const third = await recordArticleEncounter({ userId: "user-1", wordId: "retain", articleId: "a-3", sourceKey: "source-b", occurrenceCount: 1, occurredAt: "2026-09-17T10:00:00.000Z", operationId: "op-3" }, store);
    expect(third).toMatchObject({ totalOccurrences: 8, distinctArticles: 3, distinctSources: 2 });

    const replayed = await recordArticleEncounter({ userId: "user-1", wordId: "retain", articleId: "a-3", sourceKey: "source-b", occurrenceCount: 1, occurredAt: "2026-09-17T10:00:00.000Z", operationId: "op-3" }, store);
    expect(replayed).toEqual(third);
    expect(store.rows).toHaveLength(3);
  });

  it("adds only a small capped priority boost without changing mastery", () => {
    const base = { frequency: 70, generalUtility: 70, academicUtility: 70, examRelevance: 70, familyValue: 70, transferValue: 70, contextUtility: 0, difficulty: 50 };
    const unobserved = calculateVocabularyPriorityScore(base);
    const diverse = calculateVocabularyPriorityScore({ ...base, readingDistinctArticles: 3, readingDistinctSources: 2 });
    const excessive = calculateVocabularyPriorityScore({ ...base, readingDistinctArticles: 100, readingDistinctSources: 100 });
    expect(diverse).toBeGreaterThan(unobserved);
    expect(excessive - unobserved).toBeLessThanOrEqual(10);
  });
});

class MemoryEncounterStore implements ArticleEncounterStore {
  readonly rows: ArticleEncounterRow[] = [];
  private readonly operations = new Set<string>();

  async operationWasApplied(_userId: string, operationId: string): Promise<boolean> { return this.operations.has(operationId); }
  async getEncounter(userId: string, wordId: string, articleId: string): Promise<ArticleEncounterRow | null> {
    return this.rows.find((row) => row.userId === userId && row.wordId === wordId && row.articleId === articleId) ?? null;
  }
  async saveEncounter(row: ArticleEncounterRow, operationId: string): Promise<void> {
    const index = this.rows.findIndex((current) => current.userId === row.userId && current.wordId === row.wordId && current.articleId === row.articleId);
    if (index >= 0) this.rows[index] = row;
    else this.rows.push(row);
    this.operations.add(operationId);
  }
  async listEncounters(userId: string, wordId: string): Promise<ArticleEncounterRow[]> {
    return this.rows.filter((row) => row.userId === userId && row.wordId === wordId);
  }
}
