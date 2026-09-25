import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SupabaseDailyReadingRecommendationRepository } from "@/lib/repositories/supabase/daily-reading-recommendation-repository";
import { SupabaseReadingReinforcementRepository } from "@/lib/repositories/supabase/reading-reinforcement-repository";
import { createReadingReinforcementService, type CurrentReadingArticle } from "@/lib/reading/reinforcement/service";
import { toPublicSession } from "@/lib/reading/reinforcement/service";
import type { PublicSession } from "@/lib/reading/reinforcement/types";
import { learningDateForTimeZone } from "@/lib/today/local-date";
import { loadProductionVocabulary } from "@/lib/today/server-service";
import { SupabaseDailyReadingArticleRepository } from "@/lib/repositories/supabase/daily-reading-article-repository";
import type { WordProgress } from "@/types/progress";

export function createProductionReadingReinforcementService() {
  const client = createAdminSupabaseClient();
  const snapshots = new SupabaseDailyReadingRecommendationRepository(client);
  const repository = new SupabaseReadingReinforcementRepository(client);
  const articleStates = new SupabaseDailyReadingArticleRepository(client);
  return createReadingReinforcementService({
    async getCurrentArticle(userId: string, articleId: string): Promise<CurrentReadingArticle | null> {
      const {data, error} = await client.from("profiles").select("timezone").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      let learningDate: string;
      try { learningDate = learningDateForTimeZone(new Date(), data?.timezone ?? "Asia/Shanghai"); }
      catch { learningDate = learningDateForTimeZone(new Date(), "Asia/Shanghai"); }
      const frozen = await snapshots.getSet(userId, learningDate);
      const article = frozen?.recommendations.find((item) => item.articleId === articleId);
      return article ? {article, learningDate} : null;
    },
    getVocabulary: loadProductionVocabulary,
    getArticleState: (userId, articleId) => articleStates.getState(userId, articleId),
    async getWordStates(userId, wordIds): Promise<Record<string, WordProgress>> {
      if (wordIds.length === 0) return {};
      const {data, error} = await client.from("word_learning_states").select("word_id,state")
        .eq("user_id", userId).in("word_id", wordIds);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((row) => [row.word_id, row.state as unknown as WordProgress]));
    },
    async getOpenedWordIds(userId, articleId): Promise<string[]> {
      const {data, error} = await client.from("review_events").select("word_id")
        .eq("user_id", userId).eq("event_type", "reading_lookup")
        .like("client_event_id", `reading-lookup:${articleId}:%`);
      if (error) throw error;
      return (data ?? []).flatMap((row) => row.word_id ? [row.word_id] : []);
    },
    repository
  });
}

export async function listActiveReadingReinforcementSessions(userId: string): Promise<PublicSession[]> {
  const repository = new SupabaseReadingReinforcementRepository(createAdminSupabaseClient());
  return (await repository.listActive(userId, 3)).map(toPublicSession);
}
