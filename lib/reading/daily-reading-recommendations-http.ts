import type { ViewerDTO } from "@/types/auth";
import type { DailyReadingRecommendationsResponse } from "@/lib/reading/daily-reading-recommendations-service";

export function createDailyReadingRecommendationsGetHandler(dependencies: {
  requireViewer(): Promise<ViewerDTO | Response>;
  service?: { getForToday(userId: string): Promise<DailyReadingRecommendationsResponse> };
  getService?(): { getForToday(userId: string): Promise<DailyReadingRecommendationsResponse> };
}) {
  return async function GET(_request: Request): Promise<Response> {
    void _request;
    try {
      const viewer = await dependencies.requireViewer();
      if (viewer instanceof Response) return viewer;
      const service = dependencies.getService?.() ?? dependencies.service;
      if (!service) throw new Error("Recommendation service is unavailable.");
      const result = await service.getForToday(viewer.userId);
      return Response.json(result, { headers: { "cache-control": "private, no-store" } });
    } catch {
      return Response.json({ error: "READING_RECOMMENDATIONS_UNAVAILABLE" }, { status: 503 });
    }
  };
}
