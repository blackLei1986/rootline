import { getWordsByRoot } from "@/data/words";
import type { Word } from "@/types";
import type {
  DailyStats,
  LearningStorage,
  LearningStatus,
  WordProgress
} from "@/types/progress";

export function calculateRootMastery(
  rootId: string,
  storage: LearningStorage
): number {
  return getRootLearningMetrics(rootId, storage).mastery;
}

export function getRootLearningMetrics(rootId: string, storage: LearningStorage) {
  const coreWords = getWordsByRoot(rootId).filter((word) => word.rootTier === "core");
  const empty = { learnedCore: 0, totalCore: coreWords.length, stableCore: 0, coverage: 0, retention: 0, recallAccuracy: 0, mastery: 0 };
  if (coreWords.length === 0) return empty;
  const learned = coreWords
    .map((word) => storage.words[word.id])
    .filter((progress): progress is WordProgress => Boolean(progress?.firstLearnedAt));
  if (learned.length === 0) return empty;
  const averageStrength = learned.reduce((sum, item) => sum + item.memoryStrength, 0) / learned.length;
  const correct = learned.reduce((sum, item) => sum + item.correctCount, 0);
  const attempts = learned.reduce((sum, item) => sum + item.correctCount + item.wrongCount, 0);
  const recallAccuracy = attempts ? correct / attempts : 0;
  const coverage = learned.length / coreWords.length;
  const stableCore = learned.filter((item) => item.memoryStrength >= 55 && item.reviewCount >= 2).length;
  const mastery = Math.round(averageStrength * 0.4 + recallAccuracy * 100 * 0.35 + coverage * 100 * 0.25);
  return { learnedCore: learned.length, totalCore: coreWords.length, stableCore, coverage: Math.round(coverage * 100), retention: Math.round(averageStrength), recallAccuracy: Math.round(recallAccuracy * 100), mastery };
}

export function rootStatusFromMastery(
  mastery: number,
  learnedCount: number
): LearningStatus {
  if (learnedCount === 0) return "new";
  if (mastery >= 70 && learnedCount >= 5) return "mastered";
  if (mastery >= 35) return "review";
  return "learning";
}

export function reviewPriorityScore(
  progress: WordProgress,
  now: Date = new Date()
): number {
  const dueAt = progress.nextReviewAt ? new Date(progress.nextReviewAt).getTime() : now.getTime();
  const overdueHours = Math.max(0, (now.getTime() - dueAt) / 3_600_000);
  const recentWrong = progress.lastRating === "again" ? 30 : 0;
  return (
    Math.min(60, overdueHours / 4) +
    progress.difficulty * 0.35 +
    progress.lapses * 12 +
    (100 - progress.memoryStrength) * 0.3 +
    recentWrong
  );
}

export function enhancedReviewPriorityScore(
  progress: WordProgress,
  word: Word | undefined,
  now: Date = new Date()
): number {
  const base = reviewPriorityScore(progress, now);
  const learningValue = word?.learningValueScore ?? 50;
  const examRelevance = word
    ? Math.max(word.examRelevance.ielts, word.examRelevance.toefl, word.examRelevance.academic)
    : 50;
  const firstLearnedAt = progress.firstLearnedAt ? new Date(progress.firstLearnedAt).getTime() : 0;
  const recentlyLearned = firstLearnedAt > 0 && now.getTime() - firstLearnedAt <= 7 * 24 * 60 * 60_000;
  return base + learningValue * 0.25 + examRelevance * 0.12 + (recentlyLearned ? 15 : 0);
}

export function calculateStudyStreak(
  dailyStats: Record<string, DailyStats>,
  now: Date = new Date()
): number {
  let streak = 0;
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let offset = 0; offset < 366; offset += 1) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, "0");
    const day = String(cursor.getDate()).padStart(2, "0");
    const stats = dailyStats[`${year}-${month}-${day}`];
    const studied = stats && (
      stats.newWordsLearned > 0 ||
      stats.reviewsCompleted > 0 ||
      stats.sessionsCompleted > 0
    );
    if (!studied) {
      if (offset === 0) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }
      break;
    }
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
