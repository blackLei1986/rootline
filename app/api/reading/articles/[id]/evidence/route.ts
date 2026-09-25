import { requireVerifiedViewerHttp } from "@/lib/auth/http";
import { createReadingEvidencePostHandler } from "@/lib/reading/reinforcement/http";
import { createProductionReadingReinforcementService } from "@/lib/reading/reinforcement/server";

export const runtime = "nodejs";
export const POST = createReadingEvidencePostHandler({
  requireViewer: requireVerifiedViewerHttp,
  getService: createProductionReadingReinforcementService
});
