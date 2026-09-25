import { requireVerifiedViewerHttp } from "@/lib/auth/http";
import { createReadingAnswerPostHandler } from "@/lib/reading/reinforcement/http";
import { createProductionReadingReinforcementService } from "@/lib/reading/reinforcement/server";

export const runtime = "nodejs";
export const POST = createReadingAnswerPostHandler({
  requireViewer: requireVerifiedViewerHttp,
  getService: createProductionReadingReinforcementService
});
