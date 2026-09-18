import { getWordById, getWordsByRoot } from "@/data/words";
import { calculateRootMastery, rootStatusFromMastery } from "@/lib/progress-calculation";
import { normalizeRating, scheduleNextReview } from "@/lib/spaced-repetition";
import {
  createDailyStats,
  createRootProgress,
  createWordProgress,
  dateKey,
  loadProgress,
  saveProgress
} from "@/lib/storage";
import type { ReviewRating } from "@/types/progress";

export function markRootStarted(rootId: string, now: Date = new Date()): void {
  const storage = loadProgress();
  const current = storage.roots[rootId] ?? createRootProgress(rootId);
  if (current.status !== "new") return;
  saveProgress({
    ...storage,
    roots: {
      ...storage.roots,
      [rootId]: { ...current, status: "learning", lastReviewedAt: now.toISOString() }
    }
  });
}

export function recordRootRating(
  rootId: string,
  rating: ReviewRating,
  quizCorrect = true,
  now: Date = new Date()
): void {
  const storage = loadProgress();
  const current = storage.roots[rootId] ?? createRootProgress(rootId);
  const normalizedRating = normalizeRating(rating, quizCorrect);
  const intervalMinutes = { again: 10, hard: 480, good: 1440, easy: 4320 }[normalizedRating];
  saveProgress({
    ...storage,
    roots: {
      ...storage.roots,
      [rootId]: {
        ...current,
        status: current.status === "new" ? "learning" : current.status,
        lastReviewedAt: now.toISOString(),
        nextReviewAt: new Date(now.getTime() + intervalMinutes * 60_000).toISOString()
      }
    }
  });
}

export function markWordIntroduced(wordId: string, now: Date = new Date()): void {
  const word = getWordById(wordId);
  const storage = loadProgress();
  const current = storage.words[wordId] ?? createWordProgress(wordId);
  if (current.firstLearnedAt) return;
  const nextWord = {
    ...current,
    status: "learning" as const,
    firstLearnedAt: now.toISOString()
  };
  const key = dateKey(now);
  const today = storage.dailyStats[key] ?? createDailyStats(key);
  const nextStorage = {
    ...storage,
    words: { ...storage.words, [wordId]: nextWord },
    dailyStats: {
      ...storage.dailyStats,
      [key]: { ...today, newWordsLearned: today.newWordsLearned + 1 }
    }
  };
  const rootId = word?.rootIds[0];
  if (!rootId) {
    saveProgress(nextStorage);
    return;
  }
  const root = nextStorage.roots[rootId] ?? createRootProgress(rootId);
  const learnedWordIds = [...new Set([...root.learnedWordIds, wordId])];
  const withRoot = {
    ...nextStorage,
    roots: {
      ...nextStorage.roots,
      [rootId]: { ...root, status: "learning" as const, learnedWordIds }
    }
  };
  const mastery = calculateRootMastery(rootId, withRoot);
  withRoot.roots[rootId] = {
    ...withRoot.roots[rootId],
    mastery,
    status: rootStatusFromMastery(mastery, learnedWordIds.length)
  };
  saveProgress(withRoot);
}

export function recordWordAnswer(
  wordId: string,
  requestedRating: ReviewRating,
  correct: boolean,
  now: Date = new Date(),
  metadata: Record<string, string | number | boolean> = {}
): void {
  const word = getWordById(wordId);
  const storage = loadProgress();
  const current = storage.words[wordId] ?? createWordProgress(wordId);
  const rating = normalizeRating(requestedRating, correct);
  const schedule = scheduleNextReview({ progress: current, rating, now });
  const firstLearnedAt = current.firstLearnedAt ?? now.toISOString();
  const nextWord = {
    ...current,
    ...schedule,
    reviewCount: current.reviewCount + 1,
    correctCount: current.correctCount + (correct ? 1 : 0),
    wrongCount: current.wrongCount + (correct ? 0 : 1),
    streak: correct ? current.streak + 1 : 0,
    lapses: current.lapses + (!correct || rating === "again" ? 1 : 0),
    lastReviewedAt: now.toISOString(),
    firstLearnedAt,
    lastRating: rating
  };
  const key = dateKey(now);
  const today = storage.dailyStats[key] ?? createDailyStats(key);
  const wasNew = current.reviewCount === 0;
  let nextStorage = {
    ...storage,
    words: { ...storage.words, [wordId]: nextWord },
    events: [...storage.events, {
      id: `${now.getTime()}-${wordId}-answer`,
      type: correct ? "quiz_correct" as const : "quiz_wrong" as const,
      timestamp: now.toISOString(),
      wordId,
      metadata: { rating, review: !wasNew, ...metadata }
    }, ...(!wasNew ? [{ id: `${now.getTime()}-${wordId}-review`, type: "review_completed" as const, timestamp: now.toISOString(), wordId, metadata: { correct } }] : [])].slice(-500),
    dailyStats: {
      ...storage.dailyStats,
      [key]: {
        ...today,
        reviewsCompleted: today.reviewsCompleted + (wasNew ? 0 : 1),
        correctAnswers: today.correctAnswers + (correct ? 1 : 0),
        wrongAnswers: today.wrongAnswers + (correct ? 0 : 1)
      }
    }
  };

  for (const rootId of word?.rootIds ?? []) {
    const root = nextStorage.roots[rootId] ?? createRootProgress(rootId);
    const learnedWordIds = [...new Set([...root.learnedWordIds, wordId])];
    nextStorage = {
      ...nextStorage,
      roots: {
        ...nextStorage.roots,
        [rootId]: {
          ...root,
          learnedWordIds,
          lastReviewedAt: now.toISOString(),
          nextReviewAt: schedule.nextReviewAt
        }
      }
    };
    const mastery = calculateRootMastery(rootId, nextStorage);
    nextStorage.roots[rootId] = {
      ...nextStorage.roots[rootId],
      mastery,
      status: rootStatusFromMastery(mastery, learnedWordIds.length)
    };
  }
  saveProgress(nextStorage);
}

export function completeLearningSession(
  startedAt: string,
  now: Date = new Date(),
  sessionId?: string
): void {
  const storage = loadProgress();
  const key = dateKey(now);
  const today = storage.dailyStats[key] ?? createDailyStats(key);
  const minutes = Math.max(1, Math.round((now.getTime() - new Date(startedAt).getTime()) / 60_000));
  saveProgress({
    ...storage,
    events: [...storage.events, { id: `${now.getTime()}-${sessionId ?? "session"}-complete`, type: "session_completed" as const, timestamp: now.toISOString(), sessionId }].slice(-500),
    dailyStats: {
      ...storage.dailyStats,
      [key]: {
        ...today,
        sessionsCompleted: today.sessionsCompleted + 1,
        studyMinutes: today.studyMinutes + minutes
      }
    }
  });
}

export function setWordDueNow(wordId: string, now: Date = new Date()): void {
  const storage = loadProgress();
  const current = storage.words[wordId] ?? createWordProgress(wordId);
  saveProgress({
    ...storage,
    words: {
      ...storage.words,
      [wordId]: {
        ...current,
        status: current.status === "new" ? "learning" : current.status,
        firstLearnedAt: current.firstLearnedAt ?? now.toISOString(),
        nextReviewAt: new Date(now.getTime() - 60_000).toISOString()
      }
    }
  });
}

export function getRootCoverage(rootId: string): { learned: number; total: number } {
  const storage = loadProgress();
  const rootWords = getWordsByRoot(rootId);
  const learned = rootWords.filter((word) => storage.words[word.id]?.firstLearnedAt).length;
  return { learned, total: rootWords.length };
}

export function recordTransferResult(correct: boolean): void {
  const storage = loadProgress();
  saveProgress({
    ...storage,
    transferStats: {
      attempts: storage.transferStats.attempts + 1,
      correct: storage.transferStats.correct + (correct ? 1 : 0)
    }
  });
}
