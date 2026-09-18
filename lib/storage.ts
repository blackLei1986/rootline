import type {
  DailyStats,
  LearningEvent,
  LearningGoal,
  LearningStorage,
  RootProgress,
  WordProgress
} from "@/types/progress";
import type { LearningSession } from "@/types/session";
import { getStorageAdapter } from "@/lib/storage-adapter";
import { queueSyncPayload } from "@/lib/sync/offline-queue";

export const STORAGE_KEY = "root-learning-progress";
const ACTIVE_SESSION_KEY = "root-learning-active-session";
export const STORAGE_VERSION = 2;
const PROGRESS_EVENT = "root-learning-progress-updated";

export const DEFAULT_LEARNING_GOAL: LearningGoal = Object.freeze({
  path: "general",
  vocabularyBand: "core-3000",
  sessionMinutes: 20,
  goalType: "understanding"
});

export const EMPTY_STORAGE: LearningStorage = Object.freeze({
  version: STORAGE_VERSION,
  words: {},
  roots: {},
  dailyStats: {},
  events: [],
  calibration: null,
  settings: {
    dailyNewWordGoal: 10,
    dailyReviewGoal: 18,
    learningGoal: DEFAULT_LEARNING_GOAL
  },
  transferStats: { attempts: 0, correct: 0 }
});

let cachedProgress: LearningStorage | null = null;

export function createWordProgress(wordId: string): WordProgress {
  return {
    wordId,
    status: "new",
    recognitionState: null,
    recognitionConfidence: 0,
    recognitionCount: 0,
    knownCount: 0,
    fuzzyCount: 0,
    unknownCount: 0,
    lastRecognizedAt: null,
    averageResponseTime: null,
    lastResponseTime: null,
    fluencyScore: 0,
    verificationDue: false,
    verificationCorrectCount: 0,
    verificationWrongCount: 0,
    reviewCount: 0,
    correctCount: 0,
    wrongCount: 0,
    streak: 0,
    lapses: 0,
    memoryStrength: 0,
    difficulty: 50,
    intervalMinutes: 0,
    lastReviewedAt: null,
    nextReviewAt: null,
    firstLearnedAt: null,
    lastRating: null,
    firstSeenSource: null,
    encounters: {
      totalCount: 0,
      readingCount: 0,
      quizCount: 0,
      sentenceCount: 0,
      lastEncounterAt: null
    }
  };
}

export function createRootProgress(rootId: string): RootProgress {
  return {
    rootId,
    status: "new",
    learnedWordIds: [],
    mastery: 0,
    lastReviewedAt: null,
    nextReviewAt: null
  };
}

export function dateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function createDailyStats(date: string): DailyStats {
  return {
    date,
    newWordsLearned: 0,
    reviewsCompleted: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    sessionsCompleted: 0,
    studyMinutes: 0
  };
}

export function migrateStorage(value: unknown): LearningStorage {
  if (!value || typeof value !== "object") return structuredClone(EMPTY_STORAGE);
  const candidate = value as Partial<LearningStorage>;
  const normalizedWords = Object.fromEntries(
    Object.entries(candidate.words ?? {}).map(([wordId, progress]) => [
      wordId,
      { ...createWordProgress(wordId), ...(progress as Partial<WordProgress>), wordId }
    ])
  );
  const normalizedRoots = Object.fromEntries(
    Object.entries(candidate.roots ?? {}).map(([rootId, progress]) => [
      rootId,
      { ...createRootProgress(rootId), ...(progress as Partial<RootProgress>), rootId }
    ])
  );
  const normalizedDailyStats = Object.fromEntries(
    Object.entries(candidate.dailyStats ?? {}).map(([date, stats]) => [
      date,
      { ...createDailyStats(date), ...(stats as Partial<DailyStats>), date }
    ])
  );
  return {
    version: STORAGE_VERSION,
    words: normalizedWords,
    roots: normalizedRoots,
    dailyStats: normalizedDailyStats,
    events: Array.isArray(candidate.events) ? candidate.events.slice(-500) : [],
    calibration: candidate.calibration ?? null,
    settings: {
      dailyNewWordGoal: candidate.settings?.dailyNewWordGoal ?? 10,
      dailyReviewGoal: candidate.settings?.dailyReviewGoal ?? 18,
      learningGoal: {
        ...DEFAULT_LEARNING_GOAL,
        ...(candidate.settings?.learningGoal ?? {})
      }
    },
    transferStats: {
      attempts: candidate.transferStats?.attempts ?? 0,
      correct: candidate.transferStats?.correct ?? 0
    }
  };
}

export function loadProgress(): LearningStorage {
  if (typeof window === "undefined") return structuredClone(EMPTY_STORAGE);
  if (cachedProgress) return cachedProgress;
  try {
    const raw = getStorageAdapter().getItem(STORAGE_KEY);
    cachedProgress = raw ? migrateStorage(JSON.parse(raw)) : structuredClone(EMPTY_STORAGE);
  } catch {
    cachedProgress = structuredClone(EMPTY_STORAGE);
  }
  return cachedProgress;
}

export function saveProgress(progress: LearningStorage): LearningStorage {
  const next = migrateStorage(progress);
  cachedProgress = next;
  if (typeof window !== "undefined") {
    getStorageAdapter().setItem(STORAGE_KEY, JSON.stringify(next));
    queueSyncPayload("learner-auxiliary", "learner-auxiliary", {
      version: next.version,
      roots: next.roots,
      dailyStats: next.dailyStats,
      calibration: next.calibration,
      settings: next.settings,
      transferStats: next.transferStats
    });
    window.dispatchEvent(new Event(PROGRESS_EVENT));
  }
  return next;
}

export function getWordProgress(wordId: string): WordProgress {
  return loadProgress().words[wordId] ?? createWordProgress(wordId);
}

export function updateWordProgress(
  wordId: string,
  updater: (current: WordProgress) => WordProgress
): LearningStorage {
  const storage = loadProgress();
  const current = storage.words[wordId] ?? createWordProgress(wordId);
  const nextWord = updater(current);
  const next = saveProgress({
    ...storage,
    words: { ...storage.words, [wordId]: nextWord }
  });
  queueSyncPayload("word-state", wordId, nextWord);
  return next;
}

export function getRootProgress(rootId: string): RootProgress {
  return loadProgress().roots[rootId] ?? createRootProgress(rootId);
}

export function updateRootProgress(
  rootId: string,
  updater: (current: RootProgress) => RootProgress
): LearningStorage {
  const storage = loadProgress();
  const current = storage.roots[rootId] ?? createRootProgress(rootId);
  return saveProgress({
    ...storage,
    roots: { ...storage.roots, [rootId]: updater(current) }
  });
}

export function getTodayStats(now: Date = new Date()): DailyStats {
  const key = dateKey(now);
  return loadProgress().dailyStats[key] ?? createDailyStats(key);
}

export function updateTodayStats(
  updater: (current: DailyStats) => DailyStats,
  now: Date = new Date()
): LearningStorage {
  const storage = loadProgress();
  const key = dateKey(now);
  const current = storage.dailyStats[key] ?? createDailyStats(key);
  return saveProgress({
    ...storage,
    dailyStats: { ...storage.dailyStats, [key]: updater(current) }
  });
}

export function appendLearningEvent(event: LearningEvent): LearningStorage {
  const storage = loadProgress();
  const next = saveProgress({
    ...storage,
    events: [...storage.events, event].slice(-500)
  });
  queueSyncPayload("learning-event", event.id, event);
  return next;
}

export function resetProgress(): LearningStorage {
  const next = structuredClone(EMPTY_STORAGE);
  if (typeof window !== "undefined") {
    getStorageAdapter().removeItem(ACTIVE_SESSION_KEY);
  }
  return saveProgress(next);
}

export function loadActiveSession(): LearningSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = getStorageAdapter().getItem(ACTIVE_SESSION_KEY);
    return raw ? (JSON.parse(raw) as LearningSession) : null;
  } catch {
    return null;
  }
}

export function saveActiveSession(session: LearningSession): void {
  if (typeof window === "undefined") return;
  getStorageAdapter().setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
}

export function clearActiveSession(): void {
  if (typeof window === "undefined") return;
  getStorageAdapter().removeItem(ACTIVE_SESSION_KEY);
}

export function getProgressSnapshot(): LearningStorage {
  return loadProgress();
}

export function getServerProgressSnapshot(): LearningStorage {
  return EMPTY_STORAGE;
}

export function subscribeProgress(listener: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cachedProgress = null;
      listener();
    }
  };
  window.addEventListener("storage", handleStorage);
  window.addEventListener(PROGRESS_EVENT, listener);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(PROGRESS_EVENT, listener);
  };
}
