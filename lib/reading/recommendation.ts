import type { Word } from "@/types";
import type { LearningPath } from "@/types/progress";
import type { ReadingKnowledgeState, ReadingRecommendationBand } from "@/types/reading";

const GAP: Record<ReadingKnowledgeState, number> = { fluent: 0, known: 0.12, fuzzy: 0.72, unknown: 1, untracked: 0.58 };

export function scoreRecommendation(input: { word: Word; state: ReadingKnowledgeState; occurrences: number; inTitle: boolean; sentenceIndex: number; path: LearningPath }): { contextImportance: number; score: number; band: ReadingRecommendationBand; canInfer: boolean } {
  const { word, state, occurrences, inTitle, sentenceIndex, path } = input;
  const occurrenceValue = Math.min(42, Math.log2(occurrences + 1) * 20);
  const contextImportance = Math.min(100, 28 + occurrenceValue + (inTitle ? 20 : 0) + (sentenceIndex <= 1 ? 10 : 0) + (word.coverageTags.includes("academic") ? 8 : 0));
  const pathKey = path === "ielts-toefl" ? "academic" : path;
  const pathRelevance = pathKey === "general" ? word.examRelevance.general : word.examRelevance[pathKey] ?? word.examRelevance.general;
  const learningValue = word.learningValueScore;
  const score = Math.round(Math.min(100, (learningValue * 0.38 + contextImportance * 0.34 + pathRelevance * 0.28) * GAP[state]));
  const canInfer = state !== "fluent" && state !== "known" && Boolean(word.rootIds.length && word.morphology && word.morphology.includes("+"));
  const band: ReadingRecommendationBand = score >= 67 ? "must-learn" : score >= 43 ? "worth-learning" : canInfer && score >= 24 ? "can-infer" : "ignore";
  return { contextImportance, score, band, canInfer };
}
