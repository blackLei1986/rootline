import { requireVerifiedViewerHttp } from "@/lib/auth/http";
import { createReadingSessionStartPostHandler } from "@/lib/reading/reinforcement/http";
import { createProductionReadingReinforcementService } from "@/lib/reading/reinforcement/server";

export const runtime = "nodejs";
export const POST = createReadingSessionStartPostHandler({
  requireViewer: requireVerifiedViewerHttp,
  getService: createProductionReadingReinforcementService
});
