import { LEARNING_ENGINE_CONFIG } from "@/config/learning-engine";
import { getWordById } from "@/data/words";
import { enhancedReviewPriorityScore } from "@/lib/progress-calculation";
import { isDueForReview } from "@/lib/spaced-repetition";
import type { LearningStorage, WordProgress } from "@/types/progress";

export interface RecoveryPlan {
  active: boolean;
  totalOverdue: number;
  batchSize: number;
  wordIds: string[];
  deferredCount: number;
}

export function buildRecoveryPlan(
  storage: LearningStorage,
  now: Date = new Date(),
  threshold = LEARNING_ENGINE_CONFIG.recoveryThreshold,
  batchSize = LEARNING_ENGINE_CONFIG.recoveryBatchSize
): RecoveryPlan {
  const overdue = Object.values(storage.words)
    .filter((progress: WordProgress) => isDueForReview(progress, now))
    .sort((a, b) => enhancedReviewPriorityScore(b, getWordById(b.wordId), now) - enhancedReviewPriorityScore(a, getWordById(a.wordId), now));
  const active = overdue.length >= threshold;
  const selected = active ? overdue.slice(0, batchSize) : overdue;
  return {
    active,
    totalOverdue: overdue.length,
    batchSize: selected.length,
    wordIds: selected.map((progress) => progress.wordId),
    deferredCount: Math.max(0, overdue.length - selected.length)
  };
}
