import type { LearningEvent, LearningStorage, WordProgress } from "@/types/progress";

export type MasteryLevel = "unseen" | "recognized" | "stable" | "active" | "fluent";

export interface WordMastery {
  wordId: string;
  level: MasteryLevel;
  recognized: boolean;
  stable: boolean;
  active: boolean;
  fluent: boolean;
  reason: string;
}

export interface MasterySummary {
  recognized: number;
  stable: number;
  active: number;
  fluent: number;
  byWordId: Record<string, WordMastery>;
}

const DAY = 86_400_000;

function activeRecallSucceeded(events: LearningEvent[], wordId: string): boolean {
  return events.some((event) => event.wordId === wordId && event.type === "quiz_correct" && (event.metadata?.activeRecall === true || event.metadata?.mode === "meaning-recall" || event.metadata?.mode === "cloze"));
}

function isStable(progress: WordProgress, now: Date): boolean {
  if (!progress.firstLearnedAt || !progress.lastReviewedAt) return false;
  const delayed = new Date(progress.lastReviewedAt).getTime() - new Date(progress.firstLearnedAt).getTime() >= DAY;
  const badlyOverdue = progress.nextReviewAt ? now.getTime() - new Date(progress.nextReviewAt).getTime() > 14 * DAY : false;
  return delayed && progress.correctCount + progress.verificationCorrectCount >= 2 && progress.memoryStrength >= 55 && progress.lastRating !== "again" && !badlyOverdue;
}

export function calculateWordMastery(wordId: string, progress: WordProgress, events: LearningEvent[], now: Date = new Date()): WordMastery {
  const recognized = progress.knownCount > 0 || progress.verificationCorrectCount > 0 || progress.correctCount > 0;
  const stable = recognized && isStable(progress, now);
  const active = recognized && activeRecallSucceeded(events, wordId);
  const fluent = stable && active && progress.correctCount + progress.verificationCorrectCount >= 4 && (progress.averageResponseTime ?? Number.POSITIVE_INFINITY) <= 3_000 && progress.memoryStrength >= 75;
  const level: MasteryLevel = fluent ? "fluent" : active ? "active" : stable ? "stable" : recognized ? "recognized" : "unseen";
  const reason = fluent ? "多次正确、快速反应且保留稳定" : active ? "已完成中文→英文或填空回忆" : stable ? "相隔至少 24 小时仍能正确回忆" : recognized ? "已有可靠识别信号，等待延迟验证" : "尚未交互";
  return { wordId, level, recognized, stable, active, fluent, reason };
}

export function calculateMasterySummary(storage: LearningStorage, now: Date = new Date()): MasterySummary {
  const byWordId = Object.fromEntries(Object.entries(storage.words).map(([wordId, progress]) => [wordId, calculateWordMastery(wordId, progress, storage.events, now)]));
  const values = Object.values(byWordId);
  return {
    recognized: values.filter((item) => item.recognized).length,
    stable: values.filter((item) => item.stable).length,
    active: values.filter((item) => item.active).length,
    fluent: values.filter((item) => item.fluent).length,
    byWordId
  };
}

export function calculateRetention(storage: LearningStorage, days: 7 | 30, now: Date = new Date()): { percent: number | null; attempts: number } {
  const cutoff = now.getTime() - days * DAY;
  const reviews = storage.events.filter((event) => event.type === "review_completed" && new Date(event.timestamp).getTime() >= cutoff);
  const correct = reviews.filter((event) => event.metadata?.correct === true).length;
  return { percent: reviews.length ? Math.round(correct / reviews.length * 100) : null, attempts: reviews.length };
}

export function calculateContextUnderstanding(storage: LearningStorage): number | null {
  const contextEvents = storage.events.filter((event) => event.type === "sentence_understood" || (event.type === "quiz_correct" && event.metadata?.mode === "cloze"));
  const quizEvents = storage.events.filter((event) => (event.type === "quiz_correct" || event.type === "quiz_wrong") && event.metadata?.mode === "cloze");
  if (!contextEvents.length && !quizEvents.length) return null;
  const correctCloze = quizEvents.filter((event) => event.type === "quiz_correct").length;
  return Math.round((contextEvents.length + correctCloze) / Math.max(1, contextEvents.length + quizEvents.length) * 100);
}
