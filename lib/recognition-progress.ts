import { LEARNING_ENGINE_CONFIG } from "@/config/learning-engine";
import { appendLearningEvent, loadProgress, saveProgress, createWordProgress } from "@/lib/storage";
import type { RecognitionState, WordProgress } from "@/types/progress";

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const selfAssessmentTarget: Record<RecognitionState, number> = {
  known: 60,
  fuzzy: 35,
  unknown: 5
};

export function calculateFluencyScore(progress: WordProgress): number {
  const attempts = progress.correctCount + progress.wrongCount + progress.verificationCorrectCount + progress.verificationWrongCount;
  const correct = progress.correctCount + progress.verificationCorrectCount;
  const accuracy = attempts ? correct / attempts * 100 : progress.recognitionConfidence;
  const responseTime = progress.averageResponseTime ?? 6000;
  const speed = clamp(100 - Math.max(0, responseTime - 1200) / 68);
  return clamp(accuracy * 0.4 + speed * 0.3 + progress.memoryStrength * 0.3);
}

export function applyRecognitionResult(
  progress: WordProgress,
  state: RecognitionState,
  responseTimeMs: number,
  verificationScheduled = false,
  now: Date = new Date()
): WordProgress {
  const response = Math.max(250, Math.round(responseTimeMs));
  const nextCount = progress.recognitionCount + 1;
  const averageResponseTime = progress.averageResponseTime === null
    ? response
    : Math.round((progress.averageResponseTime * progress.recognitionCount + response) / nextCount);
  const target = selfAssessmentTarget[state];
  let recognitionConfidence = progress.recognitionCount === 0
    ? target
    : clamp(progress.recognitionConfidence * 0.7 + target * 0.3);
  if (state === "known" && progress.verificationCorrectCount === 0) {
    recognitionConfidence = Math.min(70, recognitionConfidence);
  }
  const next: WordProgress = {
    ...progress,
    recognitionState: state,
    recognitionConfidence,
    recognitionCount: nextCount,
    knownCount: progress.knownCount + (state === "known" ? 1 : 0),
    fuzzyCount: progress.fuzzyCount + (state === "fuzzy" ? 1 : 0),
    unknownCount: progress.unknownCount + (state === "unknown" ? 1 : 0),
    lastRecognizedAt: now.toISOString(),
    averageResponseTime,
    lastResponseTime: response,
    verificationDue: progress.verificationDue || verificationScheduled
  };
  return { ...next, fluencyScore: calculateFluencyScore(next) };
}

export function recordWordRecognition(
  wordId: string,
  state: RecognitionState,
  responseTimeMs: number,
  verificationScheduled: boolean,
  sessionId?: string,
  now: Date = new Date()
): void {
  const storage = loadProgress();
  const current = storage.words[wordId] ?? createWordProgress(wordId);
  saveProgress({
    ...storage,
    words: {
      ...storage.words,
      [wordId]: applyRecognitionResult(current, state, responseTimeMs, verificationScheduled, now)
    }
  });
  appendLearningEvent({
    id: `${now.getTime()}-${wordId}-${state}`,
    type: `recognition_${state}`,
    timestamp: now.toISOString(),
    wordId,
    sessionId,
    metadata: { responseTimeMs: Math.round(responseTimeMs), verificationScheduled }
  });
}

export function applyVerificationResult(
  progress: WordProgress,
  correct: boolean
): WordProgress {
  const next: WordProgress = {
    ...progress,
    recognitionState: correct ? "known" : "fuzzy",
    recognitionConfidence: clamp(progress.recognitionConfidence + (correct ? 25 : -40)),
    verificationDue: false,
    verificationCorrectCount: progress.verificationCorrectCount + (correct ? 1 : 0),
    verificationWrongCount: progress.verificationWrongCount + (correct ? 0 : 1)
  };
  return { ...next, fluencyScore: calculateFluencyScore(next) };
}

export function recordVerificationResult(
  wordId: string,
  correct: boolean,
  sessionId?: string,
  now: Date = new Date()
): void {
  const storage = loadProgress();
  const current = storage.words[wordId] ?? createWordProgress(wordId);
  saveProgress({
    ...storage,
    words: { ...storage.words, [wordId]: applyVerificationResult(current, correct) }
  });
  appendLearningEvent({
    id: `${now.getTime()}-${wordId}-verification`,
    type: correct ? "quiz_correct" : "quiz_wrong",
    timestamp: now.toISOString(),
    wordId,
    sessionId,
    metadata: { verification: true }
  });
}

export function shouldScheduleKnownVerification(
  progress: WordProgress | undefined,
  random: () => number = Math.random
): boolean {
  if (progress?.verificationDue) return true;
  if ((progress?.verificationCorrectCount ?? 0) > 0 && (progress?.recognitionConfidence ?? 0) >= 80) return false;
  return random() < LEARNING_ENGINE_CONFIG.knownVerificationRate;
}
