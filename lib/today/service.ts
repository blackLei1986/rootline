import { buildContextQuestions } from "@/lib/today/context-questions";
import { selectTodayArticle, type RecentArticleHistory } from "@/lib/today/article-selection";
import type { LearningStorage } from "@/types/progress";
import type { ArticleCandidate, ArticleVocabularyMatch } from "@/types/articles";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";
import type { TodayPlan, TodayPlanDTO } from "@/types/today";
import { categorizeTodayReadingDegradation, type ReadingAvailability, type ReadingDegradationReason } from "@/lib/today/degradation";

export interface TodayPlanStore {
  getPlan(userId: string, learningDate: string): Promise<TodayPlan | null>;
  createPlan(userId: string, plan: TodayPlan): Promise<TodayPlan>;
  hasSessionEvents(userId: string, planId: string): Promise<boolean>;
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
  getVocabularyEntries(wordIds: string[]): Promise<ProductionVocabularyEntry[]>;
  getArticleCandidates(userId: string): Promise<ArticleCandidate[]>;
  getRecentArticleHistory(userId: string): Promise<RecentArticleHistory[]>;
  getArticleBundle(userId: string, articleId: string): Promise<TodayArticleBundle | null>;
  getReadingAvailability?(userId: string): Promise<ReadingAvailability>;
  reportDegradation?(input: { userId: string; reason: ReadingDegradationReason; availability: ReadingAvailability }): void;
}

export interface TodayService {
  getOrCreateTodayPlan(userId: string, learningDate: string, now: Date): Promise<TodayPlanDTO>;
  regenerateUnstartedTodayPlan(userId: string, learningDate: string, now: Date): Promise<TodayPlanDTO>;
}

export function createTodayService(dependencies: TodayServiceDependencies): TodayService {
  return {
    async getOrCreateTodayPlan(userId, learningDate, now) {
      const stored = await dependencies.plans.getPlan(userId, learningDate);
      if (stored) return toDTO(stored, dependencies, userId);

      const generated = await generatePlan(dependencies, userId, learningDate, now, 1);
      const persisted = await dependencies.plans.createPlan(userId, generated);
      return toDTO(persisted, dependencies, userId);
    },

    async regenerateUnstartedTodayPlan(userId, learningDate, now) {
      const stored = await dependencies.plans.getPlan(userId, learningDate);
      if (!stored) {
        const generated = await generatePlan(dependencies, userId, learningDate, now, 1);
        return toDTO(await dependencies.plans.createPlan(userId, generated), dependencies, userId);
      }
      if (stored.status !== "not-started" || await dependencies.plans.hasSessionEvents(userId, stored.id)) {
        throw new Error("Today plan has already started and cannot be regenerated.");
      }

      const generated = await generatePlan(dependencies, userId, learningDate, now, stored.version + 1);
      return toDTO(await dependencies.plans.createPlan(userId, generated), dependencies, userId);
    }
  };
}

async function generatePlan(
  dependencies: TodayServiceDependencies,
  userId: string,
  learningDate: string,
  now: Date,
  version: number
): Promise<TodayPlan> {
  const [snapshot, vocabulary, candidates, recentHistory, suppliedAvailability] = await Promise.all([
    dependencies.getLearnerSnapshot(userId),
    dependencies.getDailyVocabulary(learningDate),
    dependencies.getArticleCandidates(userId),
    dependencies.getRecentArticleHistory(userId),
    dependencies.getReadingAvailability?.(userId)
  ]);
  const sessionMinutes = snapshot.settings.learningGoal.sessionMinutes;
  const normalPlan = sessionMinutes === 20;
  const reviewTarget = normalPlan ? 15 : Math.max(5, Math.round(sessionMinutes * 0.75));
  const scanTarget = normalPlan ? 30 : Math.max(15, Math.round(sessionMinutes * 1.5));
  const focusTarget = normalPlan ? 7 : Math.max(4, Math.round(sessionMinutes * 0.35));
  const availability = suppliedAvailability ?? inferredAvailability(candidates.length);
  let degradationReason = categorizeTodayReadingDegradation(availability);
  const selected = degradationReason ? null : selectTodayArticle(candidates, recentHistory, 6);
  let bundle: TodayArticleBundle | null = null;
  if (selected) {
    try {
      bundle = await dependencies.getArticleBundle(userId, selected.articleId);
      if (!bundle) degradationReason = "EXTRACTION_UNAVAILABLE";
    } catch {
      degradationReason = "EXTRACTION_UNAVAILABLE";
    }
  }
  const contextQuestions = selected && bundle
    ? buildContextQuestions(
      { articleId: selected.articleId, text: bundle.text },
      { valuableUnknownWordIds: selected.valuableUnknownWordIds, lexicalMatches: bundle.lexicalMatches },
      vocabulary,
      5
    )
    : [];
  const articleEligible = Boolean(selected && bundle && contextQuestions.length === 5);
  if (!articleEligible && !degradationReason) degradationReason = "NO_LEVEL_MATCH";
  if (degradationReason) dependencies.reportDegradation?.({ userId, reason: degradationReason, availability });
  const articleTargetIds = articleEligible ? selected!.valuableUnknownWordIds : [];
  const rapidScanEntries = selectRapidScan(vocabulary, snapshot, articleTargetIds, scanTarget, now);

  return {
    id: globalThis.crypto.randomUUID(),
    date: learningDate,
    version,
    status: "not-started",
    estimatedMinutes: normalPlan ? 22 : sessionMinutes + (articleEligible ? 2 : 0),
    warmupReviewIds: selectDueReviewIds(snapshot, now, reviewTarget),
    rapidScanEntries,
    focusedLearningTarget: focusTarget,
    sentenceTarget: focusTarget,
    quizTarget: articleEligible ? 5 : Math.max(5, focusTarget),
    readingCandidateIds: articleEligible ? articleTargetIds : [],
    mix: { review: 40, newVocabulary: 30, reading: articleEligible ? 20 : 0, sentence: articleEligible ? 10 : 30 },
    article: articleEligible ? {
      articleId: selected!.articleId,
      title: selected!.title,
      sourceTitle: selected!.sourceTitle,
      canonicalUrl: selected!.canonicalUrl,
      estimatedMinutes: selected!.estimatedMinutes,
      contentWordCoverage: selected!.contentWordCoverage,
      targetWordIds: contextQuestions.map((question) => question.targetWordId),
      selectionReasons: selected!.explanationCodes
    } : null,
    contextQuestions: articleEligible ? contextQuestions : [],
    stages: articleEligible
      ? ["warmup", "scan", "learn", "reading", "context-quiz", "summary"]
      : ["warmup", "scan", "learn", "summary"],
    degradationReason: articleEligible ? null : degradationReason
  };
}

async function toDTO(
  plan: TodayPlan,
  dependencies: TodayServiceDependencies,
  userId: string
): Promise<TodayPlanDTO> {
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

function selectDueReviewIds(snapshot: LearningStorage, now: Date, limit: number): string[] {
  return Object.values(snapshot.words)
    .filter((progress) => progress.nextReviewAt && new Date(progress.nextReviewAt) <= now)
    .sort((left, right) => {
      const leftTime = new Date(left.nextReviewAt ?? 0).getTime();
      const rightTime = new Date(right.nextReviewAt ?? 0).getTime();
      return leftTime - rightTime || right.lapses - left.lapses || left.wordId.localeCompare(right.wordId);
    })
    .slice(0, limit)
    .map((progress) => progress.wordId);
}

function selectRapidScan(
  vocabulary: ProductionVocabularyEntry[],
  snapshot: LearningStorage,
  readingWordIds: string[],
  limit: number,
  now: Date
): ProductionVocabularyEntry[] {
  const dueIds = new Set(selectDueReviewIds(snapshot, now, Number.POSITIVE_INFINITY));
  const readingIds = new Set(readingWordIds);
  const deduped = [...new Map(vocabulary.map((entry) => [entry.lemma.toLowerCase(), entry])).values()]
    .filter((entry) => !dueIds.has(entry.id));
  const readingLimit = Math.floor(limit * 0.2);
  const reading = deduped
    .filter((entry) => readingIds.has(entry.id))
    .sort(compareVocabulary)
    .slice(0, readingLimit);
  const selectedIds = new Set(reading.map((entry) => entry.id));
  const general = deduped
    .filter((entry) => !selectedIds.has(entry.id))
    .sort(compareVocabulary)
    .slice(0, limit - reading.length);
  return [...reading, ...general];
}

function compareVocabulary(left: ProductionVocabularyEntry, right: ProductionVocabularyEntry): number {
  return right.learningValueScore - left.learningValueScore || left.frequencyRank - right.frequencyRank || left.id.localeCompare(right.id);
}

function inferredAvailability(candidateCount: number): ReadingAvailability {
  return {
    subscriptionCount: candidateCount > 0 ? 1 : 0,
    freshArticleCount: candidateCount,
    extractedArticleCount: candidateCount,
    analyzedArticleCount: candidateCount,
    eligibleArticleCount: candidateCount
  };
}
