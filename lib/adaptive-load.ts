import { LEARNING_ENGINE_CONFIG } from "@/config/learning-engine";
import { buildLearnerModel } from "@/lib/learner-model";
import { buildRecoveryPlan } from "@/lib/recovery-mode";
import type { LearningStorage, SessionLengthMinutes } from "@/types/progress";

export interface DailyLoad {
  newWords: number;
  reviewWords: number;
  rapidScanSize: 20 | 50 | 100;
  sentenceCount: number;
  quizCount: number;
  reviewDebt: number;
  recoveryMode: boolean;
  estimatedMinutes: number;
}

const baseByMinutes: Record<SessionLengthMinutes, { newWords: number; reviews: number; scan: 20 | 50 | 100; sentences: number; quizzes: number }> = {
  10: { newWords: 4, reviews: 10, scan: 20, sentences: 4, quizzes: 5 },
  20: { newWords: 8, reviews: 18, scan: 50, sentences: 8, quizzes: 8 },
  30: { newWords: 12, reviews: 28, scan: 100, sentences: 12, quizzes: 12 }
};

export function calculateReviewDebt(storage: LearningStorage, now: Date = new Date()): number {
  return Object.values(storage.words).filter((progress) => {
    if (!progress.nextReviewAt) return false;
    return new Date(progress.nextReviewAt).getTime() <= now.getTime();
  }).length;
}

export function calculateDailyLoad(
  storage: LearningStorage,
  now: Date = new Date(),
  minutes: SessionLengthMinutes = storage.settings.learningGoal.sessionMinutes
): DailyLoad {
  const base = baseByMinutes[minutes];
  const model = buildLearnerModel(storage);
  const recovery = buildRecoveryPlan(storage, now);
  const reviewDebt = recovery.totalOverdue;

  let newWords = base.newWords;
  if (reviewDebt >= LEARNING_ENGINE_CONFIG.reviewDebtThreshold) newWords = Math.floor(newWords * 0.5);
  if (recovery.active) newWords = 0;
  if (!recovery.active && reviewDebt < 10 && model.recognitionAccuracy >= 85 && model.retention >= 70) {
    newWords = Math.ceil(newWords * 1.25);
  }
  newWords = Math.min(LEARNING_ENGINE_CONFIG.maxDailyNewWords, newWords);

  const reviewWords = recovery.active
    ? recovery.batchSize
    : Math.min(reviewDebt, Math.max(base.reviews, Math.round(model.dailyCapacity * 0.65)));
  const rapidScanSize = recovery.active ? 20 : base.scan;
  const sentenceCount = recovery.active ? Math.min(4, reviewWords) : Math.min(base.sentences, Math.max(2, newWords));
  const quizCount = recovery.active ? Math.min(10, reviewWords) : Math.min(base.quizzes, Math.max(3, newWords + Math.min(3, reviewWords)));
  const estimatedMinutes = Math.min(minutes, Math.max(5, Math.round(rapidScanSize * 4 / 60 + newWords * 0.5 + reviewWords * 0.16 + sentenceCount * 0.2 + quizCount * 8 / 60)));

  return { newWords, reviewWords, rapidScanSize, sentenceCount, quizCount, reviewDebt, recoveryMode: recovery.active, estimatedMinutes };
}
