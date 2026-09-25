import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { throwRepositoryError } from "@/lib/repositories/supabase/shared";
import { SupabaseDailyReadingRecommendationRepository } from "@/lib/repositories/supabase/daily-reading-recommendation-repository";
import { SupabaseFeedRepository } from "@/lib/repositories/supabase/feed-repository";
import { SupabaseLearnerRepository } from "@/lib/repositories/supabase/learner-repository";
import { createProductionTodayService, loadProductionVocabulary } from "@/lib/today/server-service";
import { createDailyReadingRecommendationsService } from "@/lib/reading/daily-reading-recommendations-service";
import { readRecommendationProfileTimeZone } from "@/lib/reading/profile-time-zone";
import type { DifficultyPreference } from "@/types/reading-recommendations";

export function createProductionDailyReadingRecommendationsService() {
  const client = createAdminSupabaseClient();
  const learner = new SupabaseLearnerRepository(client);
  const feeds = new SupabaseFeedRepository(client);
  const snapshots = new SupabaseDailyReadingRecommendationRepository(client);
  const today = createProductionTodayService();

  return createDailyReadingRecommendationsService({
    async getTimeZone(userId) {
      const { data, error } = await client.from("profiles").select("timezone")
        .eq("user_id", userId).maybeSingle();
      return readRecommendationProfileTimeZone({ data, error });
    },
    getTodayPlan: (userId, learningDate, now) => today.getOrCreateTodayPlan(userId, learningDate, now),
    async getLearnerVocabularyState(userId) {
      const [snapshot, vocabulary] = await Promise.all([
        learner.getSnapshot(userId),
        loadProductionVocabulary()
      ]);
      const lemmaById = new Map(vocabulary.map((entry) => [entry.id, entry.lemma]));
      const recentWords = Object.values(snapshot.words).flatMap((word) => {
        const lemma = lemmaById.get(word.wordId);
        return word.firstLearnedAt && lemma
          ? [{ wordId: word.wordId, lemma, learnedAt: word.firstLearnedAt }]
          : [];
      });
      const knownWordIds = Object.values(snapshot.words)
        .filter((word) => word.firstLearnedAt || word.recognitionState === "known")
        .map((word) => word.wordId);
      return { recentWords, knownWordIds };
    },
    async getDifficultyPreference(userId): Promise<DifficultyPreference | "comfortable"> {
      const { data, error } = await client.from("user_preferences").select("difficulty_preference")
        .eq("user_id", userId).maybeSingle();
      throwRepositoryError(error, "load reading difficulty preference");
      return data?.difficulty_preference ?? "balanced";
    },
    getCandidates: () => feeds.listCuratedRecommendationCandidates(),
    snapshots
  });
}
