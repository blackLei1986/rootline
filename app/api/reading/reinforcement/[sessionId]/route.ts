import { requireVerifiedViewerHttp } from "@/lib/auth/http";
import { createReadingSessionGetHandler } from "@/lib/reading/reinforcement/http";
import { createProductionReadingReinforcementService } from "@/lib/reading/reinforcement/server";

export const runtime = "nodejs";
export const GET = createReadingSessionGetHandler({
  requireViewer: requireVerifiedViewerHttp,
  getService: createProductionReadingReinforcementService
});
