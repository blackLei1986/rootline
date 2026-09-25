import type { ViewerDTO } from "@/types/auth";
import type { WordProgress } from "@/types/progress";

export function createOwnedWordStateGetHandler(dependencies: {
  requireViewer(): Promise<ViewerDTO | Response>;
  getWordState(userId: string, wordId: string): Promise<WordProgress | null>;
}) {
  return async function GET(_request: Request, context: {params: Promise<{wordId: string}>}): Promise<Response> {
    const viewer = await dependencies.requireViewer();
    if (viewer instanceof Response) return viewer;
    const {wordId} = await context.params;
    if (!wordId || wordId.length > 200) return Response.json({error: "WORD_STATE_NOT_FOUND"}, {status: 404});
    try {
      const state = await dependencies.getWordState(viewer.userId, wordId);
      if (!state) return Response.json({error: "WORD_STATE_NOT_FOUND"}, {status: 404});
      return Response.json({wordState: state}, {headers: {"cache-control": "private, no-store"}});
    } catch {
      return Response.json({error: "WORD_STATE_UNAVAILABLE"}, {status: 503});
    }
  };
}
