import type { LearningDepth, LearningDepthReason } from "@/lib/learning-depth";
import type { LearningGoal, RecognitionState, ReviewRating } from "@/types/progress";

export type RapidSessionSize = 20 | 50 | 100;
export type RapidSessionPhase = "scan" | "learn" | "context" | "quiz" | "summary";

export interface RapidRecognitionResult {
  wordId: string;
  state: RecognitionState;
  responseTimeMs: number;
  revealed: boolean;
  classifiedAt: string;
  learningDepth: LearningDepth;
  reasons: LearningDepthReason[];
  verificationScheduled: boolean;
}

export interface RapidLearningItem {
  wordId: string;
  depth: Exclude<LearningDepth, "skip">;
  reasons: LearningDepthReason[];
}

export interface RapidQuizAnswer {
  wordId: string;
  correct: boolean;
  rating: ReviewRating;
  verification: boolean;
  answeredAt: string;
}

export interface RapidSession {
  version: 1;
  id: string;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  size: RapidSessionSize;
  timeBudgetMinutes: 10 | 20 | 30;
  goal: LearningGoal;
  phase: RapidSessionPhase;
  wordIds: string[];
  scanIndex: number;
  learningIndex: number;
  contextIndex: number;
  quizIndex: number;
  recognitionResults: Record<string, RapidRecognitionResult>;
  learningQueue: RapidLearningItem[];
  quizWordIds: string[];
  verificationWordIds: string[];
  quizAnswers: RapidQuizAnswer[];
}
