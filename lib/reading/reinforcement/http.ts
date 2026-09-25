import { z } from "zod";
import type { ViewerDTO } from "@/types/auth";
import type { ReadingEvidenceAction } from "@/lib/reading/reinforcement/service";

const evidenceSchema = z.object({
  action: z.enum(["exposure", "detail-open"]),
  wordId: z.string().min(1).max(200)
}).strict();

export function createReadingEvidencePostHandler(dependencies: {
  requireViewer(): Promise<ViewerDTO | Response>;
  getService(): {recordReadingEvidence(userId: string, articleId: string, action: ReadingEvidenceAction, wordId: string): Promise<{saved: boolean} | null>};
}) {
  return async function POST(request: Request, context: {params: Promise<{id: string}>}): Promise<Response> {
    const viewer = await dependencies.requireViewer();
    if (viewer instanceof Response) return viewer;
    let raw: unknown;
    try { raw = await request.json(); } catch { return Response.json({error: "INVALID_READING_EVIDENCE"}, {status: 400}); }
    const parsed = evidenceSchema.safeParse(raw);
    if (!parsed.success) return Response.json({error: "INVALID_READING_EVIDENCE"}, {status: 400});
    try {
      const {id} = await context.params;
      const result = await dependencies.getService().recordReadingEvidence(viewer.userId, id, parsed.data.action, parsed.data.wordId);
      if (!result) return Response.json({error: "READING_WORD_NOT_AVAILABLE"}, {status: 404});
      return Response.json(result, {headers: {"cache-control": "private, no-store"}});
    } catch {
      return Response.json({error: "READING_EVIDENCE_UNAVAILABLE"}, {status: 503});
    }
  };
}
