import { requireVerifiedViewerHttp } from "@/lib/auth/http";
import { createDailyReadingRecommendationsGetHandler } from "@/lib/reading/daily-reading-recommendations-http";
import { createProductionDailyReadingRecommendationsService } from "@/lib/reading/server-recommendations";

export const runtime = "nodejs";

export const GET = createDailyReadingRecommendationsGetHandler({
  requireViewer: requireVerifiedViewerHttp,
  getService: createProductionDailyReadingRecommendationsService
});
