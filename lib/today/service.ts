import type { RecentArticleHistory } from "@/lib/today/article-selection";
import { buildDailyTargets, type DailyTargetCandidate } from "@/lib/today/daily-30-planner";
import { shiftLearningDate } from "@/lib/today/local-date";
import type { LearningStorage } from "@/types/progress";
import type { TodaySessionDTO } from "@/types/today";
import type { ArticleCandidate, ArticleVocabularyMatch } from "@/types/articles";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";
import type { TodayPlan, TodayPlanDTO } from "@/types/today";
import type { ReadingAvailability, ReadingDegradationReason } from "@/lib/today/degradation";

export interface TodayPlanStore {
  getPlan(userId: string, learningDate: string): Promise<TodayPlan | null>;
  createPlan(userId: string, plan: TodayPlan): Promise<TodayPlan>;
  getSession?(userId: string, planId: string): Promise<TodaySessionDTO | null>;
}

export interface TodayArticleBundle {
  id: string;
  text: string;
  lexicalMatches: ArticleVocabularyMatch[];
}

export interface TodayServiceDependencies {
  plans: TodayPlanStore;
  getLearnerSnapshot(userId: string): Promise<LearningStorage>;
  getDailyVocabulary(learningDate: string): Promise<ProductionVocabularyEntry[]>;
  getRootCoreCandidates?(vocabulary: readonly ProductionVocabularyEntry[]): Promise<DailyTargetCandidate[]>;
  getVocabularyEntries(wordIds: string[]): Promise<ProductionVocabularyEntry[]>;
  getArticleCandidates(userId: string): Promise<ArticleCandidate[]>;
  getRecentArticleHistory(userId: string): Promise<RecentArticleHistory[]>;
  getArticleBundle(userId: string, articleId: string): Promise<TodayArticleBundle | null>;
  getReadingAvailability?(userId: string): Promise<ReadingAvailability>;
  reportDegradation?(input: { userId: string; reason: ReadingDegradationReason; availability: ReadingAvailability }): void;
}

export interface TodayService {
  getOrCreateTodayPlan(userId: string, learningDate: string, now: Date): Promise<TodayPlanDTO>;
}

export function createTodayService(dependencies: TodayServiceDependencies): TodayService {
  return {
    async getOrCreateTodayPlan(userId, learningDate, now) {
      const stored = await dependencies.plans.getPlan(userId, learningDate);
      if (stored) return { ...await toDTO(stored, dependencies, userId), planCreated: false };

      const generated = await generateDaily30Plan(dependencies, userId, learningDate, now);
      const persisted = await dependencies.plans.createPlan(userId, generated);
      return { ...await toDTO(persisted, dependencies, userId), planCreated: persisted.id === generated.id };
    }
  };
}

async function generateDaily30Plan(
  dependencies: TodayServiceDependencies,
  userId: string,
  learningDate: string,
  now: Date
): Promise<TodayPlan> {
  const [snapshot, vocabulary] = await Promise.all([
    dependencies.getLearnerSnapshot(userId),
    dependencies.getDailyVocabulary(learningDate)
  ]);

  const rootCoreCandidates = await dependencies.getRootCoreCandidates?.(vocabulary) ?? [];
  const morphologyByWord = new Map(rootCoreCandidates.flatMap((candidate) => {
    const entry = vocabulary.find((word) => word.id === candidate.entry.id);
    return entry ? [[entry.id, { ...candidate, entry }] as const] : [];
  }));
  const vocabularyById = new Map(vocabulary.map((entry) => [entry.id, entry]));
  const weakCandidates = selectWeakCandidates(snapshot, vocabularyById, morphologyByWord, now);
  const freshVocabulary = vocabulary.filter((entry) => !hasLearningEvidence(snapshot.words[entry.id]));
  const freshById = new Map(freshVocabulary.map((entry) => [entry.id, entry]));
  const freshRootCore = rootCoreCandidates.filter((candidate) => freshById.has(candidate.entry.id));
  const priorDate = shiftLearningDate(learningDate, -1);
  const previousPlan = await dependencies.plans.getPlan(userId, priorDate);
  const previousSession = previousPlan && previousPlan.status !== "complete"
    ? await dependencies.plans.getSession?.(userId, previousPlan.id) ?? null
    : null;
  const completedYesterday = new Set(previousSession?.completedTargetIds ?? []);
  const carryoverTargets = previousPlan && previousPlan.status !== "complete" && previousSession?.status !== "complete"
    ? (previousPlan?.dailyTargets ?? []).filter((target) => (
      !completedYesterday.has(target.wordId)
      && previousSession?.targetProgress?.[target.wordId]?.status !== "complete"
    ))
    : [];
  const dailyTargets = buildDailyTargets({
    carryoverTargets,
    weakCandidates,
    rootCoreCandidates: freshRootCore,
    supportCandidates: freshVocabulary.map((entry) => ({ entry }))
  });
  const sessionMinutes = snapshot.settings.learningGoal.sessionMinutes;
  return {
    id: globalThis.crypto.randomUUID(),
    date: learningDate,
    version: 1,
    status: "not-started",
    estimatedMinutes: sessionMinutes,
    warmupReviewIds: [],
    rapidScanEntries: [],
    focusedLearningTarget: dailyTargets.length,
    sentenceTarget: dailyTargets.length,
    quizTarget: dailyTargets.length,
    readingCandidateIds: [],
    mix: { review: 0, newVocabulary: 100, reading: 0, sentence: 0 },
    article: null,
    contextQuestions: [],
    stages: ["learn", "summary"],
    degradationReason: dailyTargets.length < 30 ? "DAILY_TARGET_CATALOG_SHORTAGE" : null,
    dailyTargets
  };
}

function selectWeakCandidates(
  snapshot: LearningStorage,
  vocabulary: ReadonlyMap<string, ProductionVocabularyEntry>,
  morphologyByWord: ReadonlyMap<string, DailyTargetCandidate>,
  now: Date
): DailyTargetCandidate[] {
  return Object.values(snapshot.words).flatMap((progress) => {
    const entry = vocabulary.get(progress.wordId);
    if (!entry || !isGenuinelyWeak(progress)) return [];
    const dueBoost = progress.nextReviewAt && new Date(progress.nextReviewAt) <= now ? 2 : 0;
    const weakness = progress.wrongCount * 10
      + progress.verificationWrongCount * 15
      + progress.unknownCount * 5
      + (progress.recognitionState === "unknown" ? 20 : progress.recognitionState === "fuzzy" ? 10 : 0)
      + Math.max(0, 40 - progress.fluencyScore)
      + dueBoost;
    return [{ ...(morphologyByWord.get(entry.id) ?? { entry }), entry, weakPriority: weakness }];
  }).sort((left, right) => (right.weakPriority ?? 0) - (left.weakPriority ?? 0)
    || left.entry.frequencyRank - right.entry.frequencyRank
    || left.entry.id.localeCompare(right.entry.id, "en"));
}

function isGenuinelyWeak(progress: LearningStorage["words"][string]): boolean {
  return progress.verificationWrongCount > 0
    || progress.wrongCount >= 2
    || (progress.wrongCount > 0 && progress.wrongCount >= progress.correctCount)
    || (progress.recognitionState === "unknown" && progress.recognitionCount > 0)
    || (progress.recognitionState === "fuzzy" && progress.recognitionCount >= 2)
    || (progress.fluencyScore < 40 && progress.recognitionCount + progress.reviewCount >= 2);
}

function hasLearningEvidence(progress: LearningStorage["words"][string] | undefined): boolean {
  return Boolean(progress && (
    progress.status !== "new"
    || progress.firstLearnedAt
    || progress.recognitionCount > 0
    || progress.reviewCount > 0
  ));
}

async function toDTO(
  plan: TodayPlan,
  dependencies: TodayServiceDependencies,
  userId: string
): Promise<TodayPlanDTO> {
  if (plan.dailyTargets) return { ...plan, warmupReviewEntries: [], article: null };
  const warmupReviewEntries = await dependencies.getVocabularyEntries(plan.warmupReviewIds);
  if (!plan.article) return { ...plan, warmupReviewEntries, article: null };
  const bundle = await dependencies.getArticleBundle(userId, plan.article.articleId);
  if (!bundle) return {
    ...plan,
    warmupReviewEntries,
    article: null,
    contextQuestions: [],
    stages: ["warmup", "scan", "learn", "summary"],
    degradationReason: "EXTRACTION_UNAVAILABLE"
  };
  return {
    ...plan,
    warmupReviewEntries,
    article: { ...plan.article, text: bundle.text }
  };
}
