import { z } from "zod";
import type { ViewerDTO } from "@/types/auth";
import type { ReadingEvidenceAction } from "@/lib/reading/reinforcement/service";
import type { PublicSession } from "@/lib/reading/reinforcement/types";
import type { WordProgress } from "@/types/progress";
import { InvalidReadingQuestionError } from "@/lib/reading/reinforcement/service";

const evidenceSchema = z.object({
  action: z.enum(["exposure", "detail-open"]),
  wordId: z.string().min(1).max(200)
}).strict();

const answerSchema = z.object({
  questionId: z.string().min(1).max(200),
  answer: z.string().min(1).max(300)
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

type StartResult = {kind: "session"; session: PublicSession} | {kind: "empty"; availableCount: 0} | {kind: "not-found"} | {kind: "unfinished"};

export function createReadingSessionStartPostHandler(dependencies: {
  requireViewer(): Promise<ViewerDTO | Response>;
  getService(): {startOrResume(userId: string, articleId: string): Promise<StartResult>};
}) {
  return async function POST(_request: Request, context: {params: Promise<{id: string}>}): Promise<Response> {
    const viewer = await dependencies.requireViewer();
    if (viewer instanceof Response) return viewer;
    try {
      const result = await dependencies.getService().startOrResume(viewer.userId, (await context.params).id);
      if (result.kind === "not-found") return Response.json({error: "READING_ARTICLE_NOT_AVAILABLE"}, {status: 404});
      if (result.kind === "unfinished") return Response.json({error: "READING_ARTICLE_NOT_FINISHED"}, {status: 409});
      return Response.json(result, {headers: {"cache-control": "private, no-store"}});
    } catch {
      return Response.json({error: "READING_SESSION_UNAVAILABLE"}, {status: 503});
    }
  };
}

export function createReadingSessionGetHandler(dependencies: {
  requireViewer(): Promise<ViewerDTO | Response>;
  getService(): {getOwnedSession(userId: string, sessionId: string): Promise<PublicSession | null>};
}) {
  return async function GET(_request: Request, context: {params: Promise<{sessionId: string}>}): Promise<Response> {
    const viewer = await dependencies.requireViewer();
    if (viewer instanceof Response) return viewer;
    try {
      const result = await dependencies.getService().getOwnedSession(viewer.userId, (await context.params).sessionId);
      if (!result) return Response.json({error: "READING_SESSION_NOT_FOUND"}, {status: 404});
      return Response.json({session: result}, {headers: {"cache-control": "private, no-store"}});
    } catch {
      return Response.json({error: "READING_SESSION_UNAVAILABLE"}, {status: 503});
    }
  };
}

export function createReadingAnswerPostHandler(dependencies: {
  requireViewer(): Promise<ViewerDTO | Response>;
  getService(): {submitAnswer(userId: string, sessionId: string, questionId: string, answer: string): Promise<
    {session: PublicSession; wordState: WordProgress | null} | "conflict" | null>};
}) {
  return async function POST(request: Request, context: {params: Promise<{sessionId: string}>}): Promise<Response> {
    const viewer = await dependencies.requireViewer();
    if (viewer instanceof Response) return viewer;
    let raw: unknown;
    try { raw = await request.json(); } catch { return Response.json({error: "INVALID_READING_ANSWER"}, {status: 400}); }
    const parsed = answerSchema.safeParse(raw);
    if (!parsed.success) return Response.json({error: "INVALID_READING_ANSWER"}, {status: 400});
    try {
      const result = await dependencies.getService().submitAnswer(viewer.userId, (await context.params).sessionId,
        parsed.data.questionId, parsed.data.answer);
      if (!result) return Response.json({error: "READING_SESSION_NOT_FOUND"}, {status: 404});
      if (result === "conflict") return Response.json({error: "READING_ANSWER_CONFLICT"}, {status: 409});
      return Response.json(result, {headers: {"cache-control": "private, no-store"}});
    } catch (error) {
      if (error instanceof InvalidReadingQuestionError) return Response.json({error: error.message}, {status: 400});
      return Response.json({error: "READING_ANSWER_UNAVAILABLE"}, {status: 503});
    }
  };
}
