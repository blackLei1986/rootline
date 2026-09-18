import { describe, expect, it } from "vitest";
import { createWordProgress } from "@/lib/storage";
import { MemoryLearnerRepository, MemoryReadingRepository } from "@/lib/repositories/memory";
import type { LearningEvent } from "@/types/progress";
import type { ReadingDocument } from "@/types/reading";

describe("repository contracts", () => {
  it("keeps word writes idempotent and isolated by user", async () => {
    const repository = new MemoryLearnerRepository();
    const initial = { ...createWordProgress("inspect"), recognitionState: "fuzzy" as const };
    const conflictingRetry = { ...initial, recognitionState: "known" as const };

    await repository.upsertWordState("user-1", initial, "operation-1");
    await repository.upsertWordState("user-1", conflictingRetry, "operation-1");

    expect((await repository.getSnapshot("user-1")).words.inspect.recognitionState).toBe("fuzzy");
    expect((await repository.getSnapshot("user-2")).words.inspect).toBeUndefined();
  });

  it("appends each learning event once", async () => {
    const repository = new MemoryLearnerRepository();
    const event: LearningEvent = { id: "event-1", type: "word_seen", timestamp: "2026-09-17T00:00:00.000Z", wordId: "inspect" };

    expect(await repository.appendEvents("user-1", [event])).toBe(1);
    expect(await repository.appendEvents("user-1", [event])).toBe(0);
    expect((await repository.getSnapshot("user-1")).events).toEqual([event]);
  });

  it("does not overwrite a document when the same operation is replayed", async () => {
    const repository = new MemoryReadingRepository();
    const document = readingDocument("Original");

    await repository.saveDocument("user-1", document, "operation-1");
    await repository.saveDocument("user-1", { ...document, title: "Changed" }, "operation-1");

    expect((await repository.listDocuments("user-1"))[0].title).toBe("Original");
    expect(await repository.listDocuments("user-2")).toEqual([]);
  });
});

function readingDocument(title: string): ReadingDocument {
  return {
    id: "document-1",
    title,
    text: "Vocabulary supports reading comprehension.",
    sourceType: "academic",
    createdAt: "2026-09-17T00:00:00.000Z",
    wordCount: 4,
    uniqueLemmaCount: 4,
    documentDifficulty: 30,
    userDifficulty: 40,
    difficultyLabel: "comfortable",
    coverage: {
      overallTokenCoverage: 100,
      contentWordCoverage: 95,
      stableCoverage: 80,
      lemmaCoverage: 95,
      familyCoverage: 95,
      unknownContentWords: 1,
      fuzzyContentWords: 0,
      untrackedContentWords: 0,
      contentWordCount: 4
    },
    unknownDensity: 5,
    academicVocabularyRatio: 25,
    tokens: [],
    vocabulary: [],
    phrases: [],
    patterns: [],
    sentences: ["Vocabulary supports reading comprehension."],
    analysisVersion: "1.0.0"
  };
}
