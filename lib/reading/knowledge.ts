import type { LearningStorage } from "@/types/progress";
import type { ReadingKnowledgeState } from "@/types/reading";

export function getReadingKnowledgeState(wordId: string, storage: LearningStorage): ReadingKnowledgeState {
  const progress = storage.words[wordId];
  if (!progress || (!progress.firstLearnedAt && !progress.recognitionState)) return "untracked";
  if (progress.status === "mastered" || progress.fluencyScore >= 80 || progress.memoryStrength >= 85) return "fluent";
  if (progress.recognitionState === "unknown") return "unknown";
  if (progress.recognitionState === "fuzzy" || progress.verificationDue) return "fuzzy";
  if (progress.recognitionState === "known" || progress.correctCount > progress.wrongCount) return "known";
  return "untracked";
}
