import { LEARNING_ENGINE_CONFIG } from "@/config/learning-engine";
import type { Word } from "@/types";
import type { RecognitionState, WordProgress } from "@/types/progress";

export type LearningDepth = "skip" | "quick" | "standard" | "deep";

export type LearningDepthReason =
  | "known-verified"
  | "known-needs-verification"
  | "fuzzy-high-yield"
  | "unknown-low-value"
  | "unknown-high-value"
  | "exam-relevant"
  | "repeated-errors"
  | "weak-memory";

export interface LearningDepthInput {
  word: Word;
  recognitionState: RecognitionState;
  wordProgress?: WordProgress;
  learningValueScore?: number;
  difficulty?: number;
  examRelevance?: number;
  previousErrors?: number;
}

export interface LearningDepthDecision {
  depth: LearningDepth;
  reasons: LearningDepthReason[];
}

export function explainLearningDepth({
  word,
  recognitionState,
  wordProgress,
  learningValueScore = word.learningValueScore,
  difficulty = word.staticDifficulty,
  examRelevance = Math.max(word.examRelevance.ielts, word.examRelevance.toefl, word.examRelevance.academic),
  previousErrors = wordProgress?.wrongCount ?? 0
}: LearningDepthInput): LearningDepthDecision {
  const verified = (wordProgress?.verificationCorrectCount ?? 0) > 0 &&
    (wordProgress?.recognitionConfidence ?? 0) >= LEARNING_ENGINE_CONFIG.verifiedConfidenceThreshold;
  const repeatedErrors = previousErrors >= LEARNING_ENGINE_CONFIG.repeatedErrorThreshold ||
    (wordProgress?.lapses ?? 0) >= LEARNING_ENGINE_CONFIG.repeatedErrorThreshold;
  const weakMemory = Boolean(wordProgress?.firstLearnedAt) && (wordProgress?.memoryStrength ?? 100) < 30;

  if (repeatedErrors) {
    return { depth: "deep", reasons: ["repeated-errors", ...(weakMemory ? ["weak-memory" as const] : [])] };
  }

  if (recognitionState === "known") {
    return verified
      ? { depth: "skip", reasons: ["known-verified"] }
      : { depth: "skip", reasons: ["known-needs-verification"] };
  }

  if (recognitionState === "fuzzy") {
    return {
      depth: difficulty >= 85 && learningValueScore >= LEARNING_ENGINE_CONFIG.deepLearningValueThreshold ? "deep" : "standard",
      reasons: ["fuzzy-high-yield", ...(weakMemory ? ["weak-memory" as const] : [])]
    };
  }

  const highValue = learningValueScore >= LEARNING_ENGINE_CONFIG.deepLearningValueThreshold;
  const examRelevant = examRelevance >= LEARNING_ENGINE_CONFIG.highExamRelevanceThreshold;
  if (highValue || examRelevant) {
    return {
      depth: "deep",
      reasons: ["unknown-high-value", ...(examRelevant ? ["exam-relevant" as const] : [])]
    };
  }

  return { depth: "quick", reasons: ["unknown-low-value"] };
}

export function determineLearningDepth(input: LearningDepthInput): LearningDepth {
  return explainLearningDepth(input).depth;
}
