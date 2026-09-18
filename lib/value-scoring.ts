import type { RootValueMetrics, WordLearningMetrics } from "@/types/vocabulary";

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function calculateRootValueScore(metrics: RootValueMetrics): number {
  return clamp(
    metrics.frequencyCoverage * 0.3 +
    metrics.usefulWordCount * 0.25 +
    metrics.morphologyClarity * 0.2 +
    metrics.transferValue * 0.2 -
    metrics.learnerDifficulty * 0.05
  );
}

export function calculateWordLearningValueScore(metrics: WordLearningMetrics): number {
  return clamp(
    metrics.frequencyScore * 0.32 +
    metrics.utilityScore * 0.28 +
    metrics.familyValue * 0.16 +
    metrics.morphologyClarity * 0.19 -
    metrics.complexityPenalty * 0.05
  );
}
