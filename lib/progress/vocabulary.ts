import type { WordProgress } from "@/types/progress";
import type { ProgressWordState } from "@/lib/progress/types";
import { calculateWordMastery } from "@/lib/mastery-engine";

function hasActiveLearning(progress: WordProgress): boolean {
  const directLearning = progress.firstLearnedAt !== null || progress.lastReviewedAt !== null
    || progress.correctCount > 0 || progress.wrongCount > 0
    || progress.verificationCorrectCount > 0 || progress.verificationWrongCount > 0;
  if (directLearning) return true;
  // A first-sight recognition schedules FSRS without completing any active learning.
  return progress.recognitionCount === 0 &&
    (progress.reviewCount > 0 || progress.status !== "new" || progress.fsrsState > 0);
}

function hasExposure(progress: WordProgress): boolean {
  return progress.recognitionCount > 0 || progress.knownCount > 0 || progress.fuzzyCount > 0
    || progress.unknownCount > 0 || progress.lastRecognizedAt !== null
    || progress.encounters.totalCount > 0 || progress.firstSeenSource !== null;
}

export function classifyProgressVocabulary(
  catalogIds: ReadonlySet<string>, states: ReadonlyMap<string, WordProgress>,
  passiveWordIds: ReadonlySet<string>, now: Date
): {touched: number; learning: number; stable: number; stablePercent: number;
  byWordId: Map<string, ProgressWordState>} {
  const byWordId = new Map<string, ProgressWordState>();
  const evidencedIds = new Set([...states.keys(), ...passiveWordIds]);
  for (const wordId of evidencedIds) {
    if (!catalogIds.has(wordId)) continue;
    const progress = states.get(wordId);
    if (progress && calculateWordMastery(wordId, progress, [], now).stable) {
      byWordId.set(wordId, "stable");
    } else if (progress && hasActiveLearning(progress)) {
      byWordId.set(wordId, "learning");
    } else if (passiveWordIds.has(wordId) || (progress && hasExposure(progress))) {
      byWordId.set(wordId, "touched");
    }
  }
  const values = [...byWordId.values()];
  const stable = values.filter((category) => category === "stable").length;
  return {
    touched: values.filter((category) => category === "touched").length,
    learning: values.filter((category) => category === "learning").length,
    stable,
    stablePercent: Math.min(100, Math.round(stable / 10_000 * 1_000) / 10),
    byWordId
  };
}
