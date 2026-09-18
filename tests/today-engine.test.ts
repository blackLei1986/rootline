import { describe, expect, it } from "vitest";
import { buildTodayPlan } from "@/lib/today-engine";
import { createWordProgress, migrateStorage } from "@/lib/storage";
import type { ProductionVocabularyEntry } from "@/types";

function entry(index: number): ProductionVocabularyEntry {
  return {
    id: `word-${index}`, word: `word${index}`, lemma: `word${index}`, wordFamilyId: `word${index}`, surfaceForms: [`word${index}`], partOfSpeech: ["noun"], coreMeaningZh: `词${index}`, coreDefinitionEn: `definition ${index}`, example: `Example ${index}.`, examples: [`Example ${index}.`], frequencyBand: "high", frequencyRank: index + 1, learningValueScore: 90 - index / 10, contentTier: index < 30 ? "tier-1-core" : "tier-2-important", learningGoal: "understanding", coverageTags: index % 2 ? ["general"] : ["academic"], pipelineStatus: "accepted", morphologyConfidence: "none", sourceMetadata: { frequencySources: [{ name: "test" }], academicSources: [], examSources: [], generatedAt: "2026-01-01", generatedBy: "test", confidence: 90 }
  };
}

describe("today engine", () => {
  it("keeps the visible daily candidate set between 20 and 50", () => {
    const storage = migrateStorage({ settings: { dailyNewWordGoal: 10, dailyReviewGoal: 18, learningGoal: { path: "general", vocabularyBand: "core-3000", sessionMinutes: 20, goalType: "understanding" } } });
    const plan = buildTodayPlan(Array.from({ length: 100 }, (_, index) => entry(index)), storage, [], new Date("2026-09-17T08:00:00Z"));
    expect(plan.rapidScanEntries).toHaveLength(35);
    expect(plan.rapidScanEntries.length).toBeGreaterThanOrEqual(20);
    expect(plan.rapidScanEntries.length).toBeLessThanOrEqual(50);
    expect(plan.focusedLearningTarget).toBe(9);
  });

  it("puts the most urgent due words into a 5–10 item warm-up", () => {
    const storage = migrateStorage({ words: Object.fromEntries(Array.from({ length: 12 }, (_, index) => {
      const progress = createWordProgress(`due-${index}`);
      return [progress.wordId, { ...progress, nextReviewAt: `2026-09-${String(index + 1).padStart(2, "0")}T00:00:00Z`, lapses: index }];
    })) });
    const plan = buildTodayPlan(Array.from({ length: 60 }, (_, index) => entry(index)), storage, [], new Date("2026-09-17T08:00:00Z"));
    expect(plan.warmupReviewIds.length).toBeGreaterThanOrEqual(5);
    expect(plan.warmupReviewIds.length).toBeLessThanOrEqual(10);
    expect(plan.warmupReviewIds[0]).toBe("due-0");
  });
});
