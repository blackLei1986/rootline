import { z } from "zod";
import type { ViewerDTO } from "@/types/auth";
import type { DailyReadingArticleReadState, DailyReadingStatePatch } from "@/lib/reading/daily-reading-article-service";

const statePatchSchema = z.object({
  opened: z.literal(true).optional(),
  completed: z.literal(true).optional()
}).strict().refine((value) => value.opened === true || value.completed === true);

export function createDailyReadingArticleStatePostHandler(dependencies: {
  requireViewer(): Promise<ViewerDTO | Response>;
  service?: { updateState(userId: string, articleId: string, patch: DailyReadingStatePatch): Promise<DailyReadingArticleReadState | null> };
  getService?(): { updateState(userId: string, articleId: string, patch: DailyReadingStatePatch): Promise<DailyReadingArticleReadState | null> };
}) {
  return async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> }
  ): Promise<Response> {
    const viewer = await dependencies.requireViewer();
    if (viewer instanceof Response) return viewer;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "INVALID_READING_ARTICLE_STATE" }, { status: 400 });
    }
    const parsed = statePatchSchema.safeParse(body);
    if (!parsed.success) return Response.json({ error: "INVALID_READING_ARTICLE_STATE" }, { status: 400 });

    try {
      const { id } = await context.params;
      const service = dependencies.getService?.() ?? dependencies.service;
      if (!service) throw new Error("Daily-3 article state service is unavailable.");
      const state = await service.updateState(viewer.userId, id, parsed.data);
      if (!state) return Response.json({ error: "READING_ARTICLE_NOT_AVAILABLE" }, { status: 404 });
      return Response.json({ ok: true, state }, { headers: { "cache-control": "private, no-store" } });
    } catch {
      return Response.json({ error: "READING_ARTICLE_STATE_UNAVAILABLE" }, { status: 503 });
    }
  };
}
