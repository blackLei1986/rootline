import { describe, expect, it } from "vitest";
import { buildContextQuestions } from "@/lib/today/context-questions";
import type { ProductionVocabularyEntry } from "@/types";

describe("Today context questions", () => {
  it("builds exactly five deterministic questions from actual contexts", () => {
    const vocabulary = Array.from({ length: 8 }, (_, index) => entry(index));
    const text = vocabulary.map((word) => `Readers use ${word.word} when they explain evidence in context.`).join(" ");
    const analysis = {
      valuableUnknownWordIds: vocabulary.slice(0, 5).map((word) => word.id),
      lexicalMatches: vocabulary.map((word) => ({ wordId: word.id }))
    };
    const first = buildContextQuestions({ articleId: "article-1", text }, analysis, vocabulary, 5);
    const second = buildContextQuestions({ articleId: "article-1", text }, analysis, vocabulary, 5);

    expect(first).toEqual(second);
    expect(first).toHaveLength(5);
    expect(new Set(first.map((question) => question.id)).size).toBe(5);
    first.forEach((question) => {
      expect(question.sentence).toContain("____");
      expect(question.choices.filter((choice) => choice === question.correctChoice)).toHaveLength(1);
    });
  });

  it("returns fewer questions when the article lacks five real target contexts", () => {
    const vocabulary = [entry(0), entry(1)];
    expect(buildContextQuestions(
      { articleId: "short", text: `Readers use ${vocabulary[0].word} in context.` },
      { valuableUnknownWordIds: [vocabulary[0].id], lexicalMatches: [{ wordId: vocabulary[0].id }] },
      vocabulary,
      5
    )).toHaveLength(1);
  });
});

function entry(index: number): ProductionVocabularyEntry {
  const word = `contextword${index}`;
  return {
    id: word, word, lemma: word, wordFamilyId: word, surfaceForms: [word], partOfSpeech: ["noun"], coreMeaningZh: `含义${index}`, coreDefinitionEn: `definition ${index}`, example: `Example ${index}.`, examples: [`Example ${index}.`], frequencyBand: "high", frequencyRank: index + 1, learningValueScore: 90 - index, contentTier: "tier-2-important", learningGoal: "understanding", coverageTags: ["general"], pipelineStatus: "accepted", morphologyConfidence: "none", sourceMetadata: { frequencySources: [{ name: "test" }], academicSources: [], examSources: [], generatedAt: "2026-01-01", generatedBy: "test", confidence: 90 }
  };
}
