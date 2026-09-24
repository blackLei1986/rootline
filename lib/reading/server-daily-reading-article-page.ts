import "server-only";
import { createProductionDailyReadingArticleService } from "@/lib/reading/server-daily-reading-article-service";
import { createProductionDailyReadingRecommendationsService } from "@/lib/reading/server-recommendations";
import { createProductionTodayService, loadProductionVocabulary } from "@/lib/today/server-service";
import { SupabaseDailyReadingMorphologyRepository } from "@/lib/repositories/supabase/daily-reading-morphology-repository";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { DailyReadingArticleWord } from "@/components/reading/daily-reading-article";

export async function loadDailyReadingArticlePageData(userId: string, articleId: string): Promise<{ article: NonNullable<Awaited<ReturnType<ReturnType<typeof createProductionDailyReadingArticleService>["getArticle"]>>>; words: DailyReadingArticleWord[] } | null> {
  const article = await createProductionDailyReadingArticleService().getArticle(userId, articleId);
  if (!article) return null;
  const recommendations = await createProductionDailyReadingRecommendationsService().getForToday(userId);
  const todayPlan = await createProductionTodayService().getOrCreateTodayPlan(userId, recommendations.learningDate, new Date());
  const vocabulary = await loadProductionVocabulary();
  const vocabularyById = new Map(vocabulary.map((entry) => [entry.id, entry]));
  const todayById = new Map((todayPlan.dailyTargets ?? []).map((target) => [target.wordId, target]));
  const recentIds = (article.matchedRecent7DayWordIds ?? article.matchedRecentWordIds).filter((id) => !todayById.has(id));
  const recentMorphology = await new SupabaseDailyReadingMorphologyRepository(createAdminSupabaseClient()).getPublishedForWordIds(recentIds, vocabulary);
  const recentLevel = article.matchedRecent7DayWordIds === undefined ? "recent-legacy" as const : "recent-7-day" as const;
  const words: DailyReadingArticleWord[] = [];
  const ids = new Set([...article.matchedTodayWordIds, ...(article.matchedRecent7DayWordIds ?? article.matchedRecentWordIds)]);
  for (const wordId of ids) {
    const target = todayById.get(wordId);
    const entry = vocabularyById.get(wordId);
    if (!target && !entry) continue;
    const isToday = article.matchedTodayWordIds.includes(wordId);
    const morphologySnapshot = target?.morphology ? target : recentMorphology.get(wordId);
    words.push({
      wordId, word: target?.word ?? entry?.word ?? entry?.lemma ?? wordId,
      lemma: target?.lemma ?? entry?.lemma ?? wordId, surfaceForms: entry?.surfaceForms ?? [target?.word ?? target?.lemma ?? wordId],
      coreMeaningZh: target?.coreMeaningZh ?? entry?.coreMeaningZh ?? "", coreDefinitionEn: target?.coreDefinitionEn ?? entry?.coreDefinitionEn ?? "",
      ...(target?.phonetic ?? entry?.phonetic ? { phonetic: target?.phonetic ?? entry?.phonetic } : {}),
      example: target?.example ?? entry?.example ?? "", morphology: morphologySnapshot?.morphology ?? null,
      rootForm: morphologySnapshot?.rootForm, rootMeaningEn: morphologySnapshot?.rootMeaningEn,
      rootMeaningZh: morphologySnapshot?.rootMeaningZh, rootExplanation: morphologySnapshot?.rootExplanation,
      level: isToday ? "today" : recentLevel
    });
  }
  return { article, words };
}
