import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SupabaseDailyReadingRecommendationRepository } from "@/lib/repositories/supabase/daily-reading-recommendation-repository";
import { SupabaseReadingReinforcementRepository } from "@/lib/repositories/supabase/reading-reinforcement-repository";
import { createReadingReinforcementService, type CurrentReadingArticle } from "@/lib/reading/reinforcement/service";
import { learningDateForTimeZone } from "@/lib/today/local-date";
import { loadProductionVocabulary } from "@/lib/today/server-service";

export function createProductionReadingReinforcementService() {
  const client = createAdminSupabaseClient();
  const snapshots = new SupabaseDailyReadingRecommendationRepository(client);
  const repository = new SupabaseReadingReinforcementRepository(client);
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
    repository
  });
}
