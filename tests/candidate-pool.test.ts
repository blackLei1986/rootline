import { describe, expect, it } from "vitest";
import { buildCandidatePool, calculateKnowledgeGap, calculatePathRelevance } from "@/lib/candidate-pool";
import { createWordProgress, EMPTY_STORAGE } from "@/lib/storage";
import { getWordById } from "@/data/words";

describe("candidate pool", () => {
  it("gives unknown words a larger knowledge gap than known words", () => {
    const known = { ...createWordProgress("inspect"), recognitionState: "known" as const, memoryStrength: 80, correctCount: 4 };
    const unknown = { ...createWordProgress("respect"), recognitionState: "unknown" as const };
    expect(calculateKnowledgeGap(unknown)).toBeGreaterThan(calculateKnowledgeGap(known));
  });

  it("prefers the IELTS and TOEFL intersection for a combined path", () => {
    const word = getWordById("significant")!;
    const relevance = calculatePathRelevance(word, {
      path: "ielts-toefl",
      vocabularyBand: "core-3000",
      sessionMinutes: 20,
      goalType: "understanding"
    });
    expect(relevance).toBe(1);
  });

  it("puts a high-value unknown ahead of a verified known word", () => {
    const storage = structuredClone(EMPTY_STORAGE);
    storage.words.significant = { ...createWordProgress("significant"), recognitionState: "unknown" };
    storage.words.inspect = {
      ...createWordProgress("inspect"),
      recognitionState: "known",
      recognitionConfidence: 90,
      verificationCorrectCount: 2,
      memoryStrength: 85
    };
    const pool = buildCandidatePool({ storage, catalog: [getWordById("inspect")!, getWordById("significant")!] });
    expect(pool[0].word.id).toBe("significant");
  });
});
