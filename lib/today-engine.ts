import type { LearningStorage } from "@/types/progress";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";
import type { TodayPlan } from "@/types/today";
import { dateKey } from "@/lib/storage";

function duePriority(storage: LearningStorage, id: string, now: Date): number {
  const progress = storage.words[id];
  if (!progress?.nextReviewAt || new Date(progress.nextReviewAt) > now) return -1;
  const overdueHours = Math.max(0, (now.getTime() - new Date(progress.nextReviewAt).getTime()) / 3_600_000);
  return overdueHours + progress.lapses * 20 + (100 - progress.memoryStrength);
}

function candidateScore(entry: ProductionVocabularyEntry, storage: LearningStorage, readingIds: Set<string>): number {
  const progress = storage.words[entry.id];
  const path = storage.settings.learningGoal.path;
  const pathMatch = path === "general" ? entry.coverageTags.includes("general") : path === "ielts-toefl" ? entry.coverageTags.includes("ielts") || entry.coverageTags.includes("toefl") : entry.coverageTags.includes(path);
  const tierBoost = { "tier-1-core": 24, "tier-2-important": 14, "tier-3-recognition": 6, "tier-4-extension": 0 }[entry.contentTier];
  const knowledgeGap = progress?.recognitionState === "unknown" ? 28 : progress?.recognitionState === "fuzzy" ? 20 : progress?.recognitionState === "known" ? -22 : 8;
  const readingBoost = readingIds.has(entry.id) ? 26 : 0;
  const errorBoost = (progress?.wrongCount ?? 0) * 5 + (progress?.lapses ?? 0) * 7;
  return entry.learningValueScore + tierBoost + knowledgeGap + readingBoost + errorBoost + (pathMatch ? 15 : 0);
}

export function buildTodayPlan(
  candidates: ProductionVocabularyEntry[],
  storage: LearningStorage,
  readingWordIds: string[] = [],
  now: Date = new Date()
): TodayPlan {
  const readingIds = new Set(readingWordIds);
  const reviewSize = Math.max(5, Math.min(10, storage.settings.dailyReviewGoal));
  const warmupReviewIds = Object.keys(storage.words)
    .filter((id) => duePriority(storage, id, now) >= 0)
    .sort((left, right) => duePriority(storage, right, now) - duePriority(storage, left, now))
    .slice(0, reviewSize);
  const minutes = storage.settings.learningGoal.sessionMinutes;
  const scanSize = minutes === 10 ? 20 : minutes === 20 ? 35 : 50;
  const due = new Set(warmupReviewIds);
  const deduped = [...new Map(candidates.map((entry) => [entry.lemma.toLowerCase(), entry])).values()];
  const rapidScanEntries = deduped
    .filter((entry) => !due.has(entry.id))
    .sort((left, right) => candidateScore(right, storage, readingIds) - candidateScore(left, storage, readingIds) || left.frequencyRank - right.frequencyRank)
    .slice(0, scanSize);
  const focusedLearningTarget = minutes === 10 ? 5 : minutes === 20 ? 9 : 12;
  const sentenceTarget = Math.min(focusedLearningTarget, minutes === 10 ? 5 : minutes === 20 ? 8 : 10);
  const quizTarget = minutes === 10 ? 5 : minutes === 20 ? 8 : 12;

  return {
    id: `today-${dateKey(now)}`,
    date: dateKey(now),
    version: 1,
    status: "not-started",
    estimatedMinutes: minutes,
    warmupReviewIds,
    rapidScanEntries,
    focusedLearningTarget,
    sentenceTarget,
    quizTarget,
    readingCandidateIds: rapidScanEntries.filter((entry) => readingIds.has(entry.id)).map((entry) => entry.id),
    mix: { review: 40, newVocabulary: 30, reading: 20, sentence: 10 },
    article: null,
    contextQuestions: [],
    stages: ["warmup", "scan", "learn", "summary"],
    degradationReason: null
  };
}
