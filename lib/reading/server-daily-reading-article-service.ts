import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SupabaseDailyReadingArticleRepository } from "@/lib/repositories/supabase/daily-reading-article-repository";
import { createDailyReadingArticleService } from "@/lib/reading/daily-reading-article-service";
import { createProductionDailyReadingRecommendationsService } from "@/lib/reading/server-recommendations";

export function createProductionDailyReadingArticleService() {
  return createDailyReadingArticleService({
    recommendations: createProductionDailyReadingRecommendationsService(),
    states: new SupabaseDailyReadingArticleRepository(createAdminSupabaseClient())
  });
}
