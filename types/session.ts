import type { ReviewRating } from "@/types/progress";
import type { QuizMode } from "@/types/quiz";
import type { LearningDepth, LearningDepthReason } from "@/lib/learning-depth";

export type LearningItemType = "root" | "word" | "phrase" | "sentence" | "quiz" | "review";

export type LearningStage =
  | "root-intro"
  | "root-recall"
  | "word-intro"
  | "word-recall"
  | "phrase-reinforcement"
  | "sentence-reinforcement"
  | "review-recall"
  | "mixed-quiz"
  | "summary";

export interface LearningSessionItem {
  id: string;
  type: LearningItemType;
  stage: LearningStage;
  rootId?: string;
  wordId?: string;
  phraseId?: string;
  sentenceId?: string;
  mode?: QuizMode;
  reinforcement?: boolean;
  learningDepth?: LearningDepth;
  reasonCodes?: LearningDepthReason[];
  estimatedSeconds?: number;
  priority?: number;
}

export interface SessionAnswer {
  itemId: string;
  wordId?: string;
  rootId?: string;
  correct: boolean;
  rating?: ReviewRating;
  answeredAt: string;
}

export interface LearningSession {
  id: string;
  startedAt: string;
  completedAt?: string;
  rootIds: string[];
  newWordIds: string[];
  reviewWordIds: string[];
  items: LearningSessionItem[];
  currentIndex: number;
  answers: SessionAnswer[];
  reinforcementCounts: Record<string, number>;
  rootMasteryBefore: Record<string, number>;
  timeBudgetMinutes?: 10 | 20 | 30;
  estimatedSeconds?: number;
  recoveryMode?: boolean;
}
