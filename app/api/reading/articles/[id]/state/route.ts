import { requireVerifiedViewerHttp } from "@/lib/auth/http";
import { createDailyReadingArticleStatePostHandler } from "@/lib/reading/daily-reading-article-state-http";
import { createProductionDailyReadingArticleService } from "@/lib/reading/server-daily-reading-article-service";

export const runtime = "nodejs";

export const POST = createDailyReadingArticleStatePostHandler({
  requireViewer: requireVerifiedViewerHttp,
  getService: createProductionDailyReadingArticleService
});
