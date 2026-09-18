import { LEARNING_ENGINE_CONFIG } from "@/config/learning-engine";
import { getWordById } from "@/data/words";
import { buildCandidatePool } from "@/lib/candidate-pool";
import { explainLearningDepth } from "@/lib/learning-depth";
import { shouldScheduleKnownVerification } from "@/lib/recognition-progress";
import type { LearningStorage, RecognitionState, ReviewRating } from "@/types/progress";
import type { RapidSession, RapidSessionSize } from "@/types/rapid-session";

const RAPID_SESSION_KEY = "root-learning-rapid-session";

export function createRapidSession(
  storage: LearningStorage,
  size: RapidSessionSize = 50,
  timeBudgetMinutes = storage.settings.learningGoal.sessionMinutes,
  now: Date = new Date()
): RapidSession {
  const candidates = buildCandidatePool({ storage, limit: size });
  const timestamp = now.toISOString();
  return {
    version: 1,
    id: `rapid-${now.getTime()}`,
    startedAt: timestamp,
    updatedAt: timestamp,
    size,
    timeBudgetMinutes,
    goal: structuredClone(storage.settings.learningGoal),
    phase: "scan",
    wordIds: candidates.map((candidate) => candidate.word.id),
    scanIndex: 0,
    learningIndex: 0,
    contextIndex: 0,
    quizIndex: 0,
    recognitionResults: {},
    learningQueue: [],
    quizWordIds: [],
    verificationWordIds: [],
    quizAnswers: []
  };
}

export function classifyRapidWord(
  session: RapidSession,
  storage: LearningStorage,
  state: RecognitionState,
  responseTimeMs: number,
  revealed: boolean,
  random: () => number = Math.random,
  now: Date = new Date()
): RapidSession {
  const wordId = session.wordIds[session.scanIndex];
  if (!wordId) return session;
  const word = getWordById(wordId);
  if (!word) return session;
  const decision = explainLearningDepth({ word, recognitionState: state, wordProgress: storage.words[wordId] });
  const verificationScheduled = state === "known" && shouldScheduleKnownVerification(storage.words[wordId], random);
  const result = {
    wordId,
    state,
    responseTimeMs: Math.max(250, Math.round(responseTimeMs)),
    revealed,
    classifiedAt: now.toISOString(),
    learningDepth: decision.depth,
    reasons: decision.reasons,
    verificationScheduled
  };
  const learningQueue = decision.depth === "skip"
    ? session.learningQueue
    : [...session.learningQueue, { wordId, depth: decision.depth, reasons: decision.reasons }];
  const verificationWordIds = verificationScheduled
    ? [...session.verificationWordIds, wordId]
    : session.verificationWordIds;
  const nextIndex = session.scanIndex + 1;
  const scanComplete = nextIndex >= session.wordIds.length;
  const depthWeight = { deep: 3, standard: 2, quick: 1 } as const;
  const orderedLearning = scanComplete
    ? [...learningQueue].sort((a, b) => depthWeight[b.depth] - depthWeight[a.depth])
    : learningQueue;
  const quizLimit = Math.max(3, Math.min(12, Math.floor(session.timeBudgetMinutes * 0.45)));
  const quizWordIds = scanComplete
    ? [...new Set([...orderedLearning.map((item) => item.wordId), ...verificationWordIds])].slice(0, quizLimit)
    : session.quizWordIds;
  const phase = scanComplete
    ? orderedLearning.length ? "learn" : quizWordIds.length ? "quiz" : "summary"
    : "scan";
  return {
    ...session,
    updatedAt: now.toISOString(),
    phase,
    scanIndex: nextIndex,
    recognitionResults: { ...session.recognitionResults, [wordId]: result },
    learningQueue: orderedLearning,
    verificationWordIds,
    quizWordIds
  };
}

export function advanceRapidLearning(session: RapidSession, now: Date = new Date()): RapidSession {
  const learningIndex = session.learningIndex + 1;
  return {
    ...session,
    updatedAt: now.toISOString(),
    learningIndex,
    phase: learningIndex >= session.learningQueue.length ? "context" : "learn"
  };
}

export function advanceRapidContext(session: RapidSession, now: Date = new Date()): RapidSession {
  const contextIndex = session.contextIndex + 1;
  return {
    ...session,
    updatedAt: now.toISOString(),
    contextIndex,
    phase: contextIndex >= session.learningQueue.length ? (session.quizWordIds.length ? "quiz" : "summary") : "context"
  };
}

export function recordRapidQuizAnswer(
  session: RapidSession,
  correct: boolean,
  rating: ReviewRating,
  now: Date = new Date()
): RapidSession {
  const wordId = session.quizWordIds[session.quizIndex];
  if (!wordId) return session;
  const quizIndex = session.quizIndex + 1;
  const completed = quizIndex >= session.quizWordIds.length;
  return {
    ...session,
    updatedAt: now.toISOString(),
    completedAt: completed ? now.toISOString() : session.completedAt,
    quizIndex,
    phase: completed ? "summary" : "quiz",
    quizAnswers: [...session.quizAnswers, {
      wordId,
      correct,
      rating,
      verification: session.verificationWordIds.includes(wordId),
      answeredAt: now.toISOString()
    }]
  };
}

export function finishRapidSessionEarly(session: RapidSession, now: Date = new Date()): RapidSession {
  return { ...session, phase: "summary", updatedAt: now.toISOString(), completedAt: now.toISOString() };
}

export function loadRapidSession(): RapidSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(RAPID_SESSION_KEY);
    return raw ? JSON.parse(raw) as RapidSession : null;
  } catch {
    return null;
  }
}

export function saveRapidSession(session: RapidSession): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RAPID_SESSION_KEY, JSON.stringify(session));
}

export function clearRapidSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(RAPID_SESSION_KEY);
}

export const rapidSessionEstimates = {
  scanSeconds: LEARNING_ENGINE_CONFIG.rapidCardSeconds,
  quickSeconds: LEARNING_ENGINE_CONFIG.quickCardSeconds,
  standardSeconds: LEARNING_ENGINE_CONFIG.standardCardSeconds,
  deepSeconds: LEARNING_ENGINE_CONFIG.deepCardSeconds,
  quizSeconds: LEARNING_ENGINE_CONFIG.quizSeconds
};
