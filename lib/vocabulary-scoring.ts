import { VOCABULARY_SCORING_WEIGHTS } from "@/config/vocabulary-scoring";
import type { VocabularyPriorityMetrics } from "@/types/vocabulary";

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function calculateVocabularyPriorityScore(metrics: VocabularyPriorityMetrics): number {
  const readingDiversityBoost = Math.min(4, Math.max(0, metrics.readingDistinctArticles ?? 0)) +
    Math.min(3, Math.max(0, metrics.readingDistinctSources ?? 0)) * 2;
  return clamp(
    metrics.frequency * VOCABULARY_SCORING_WEIGHTS.frequency +
    metrics.generalUtility * VOCABULARY_SCORING_WEIGHTS.generalUtility +
    metrics.academicUtility * VOCABULARY_SCORING_WEIGHTS.academicUtility +
    metrics.examRelevance * VOCABULARY_SCORING_WEIGHTS.examRelevance +
    metrics.familyValue * VOCABULARY_SCORING_WEIGHTS.familyValue +
    metrics.transferValue * VOCABULARY_SCORING_WEIGHTS.transferValue +
    Math.min(10, readingDiversityBoost)
  );
}

export function averageExamRelevance(metrics: { ielts: number; toefl: number; academic: number; general: number }): number {
  return Math.round((metrics.ielts + metrics.toefl + metrics.academic + metrics.general) / 4);
}
