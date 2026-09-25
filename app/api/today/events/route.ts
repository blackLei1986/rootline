import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVerifiedViewerHttp } from "@/lib/auth/http";
import { createProductionTodayEventService } from "@/lib/today/server-service";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SupabaseTodayRepository } from "@/lib/repositories/supabase/today-repository";
import { SupabaseFeedRepository } from "@/lib/repositories/supabase/feed-repository";
import { recordArticleBundleEncounters } from "@/lib/reading/server-encounters";
import { getE2ETodaySession, recordE2ETodayEvent } from "@/lib/today/e2e-fixture";
import {isLocalTodayFixtureEnabled} from "@/lib/today/fixture-env";
import { RepositoryError } from "@/lib/repositories/contracts";
import {TodayEventConflictError, TodayPlanNotFoundError} from "@/lib/today/events";

const eventSchema = z.object({
  operationId: z.string().min(1).max(300),
  planId: z.uuid(),
  type: z.enum([
    "today_started", "stage_completed", "article_opened", "article_completed", "context_answered",
    "target_recognized", "target_activity_completed", "review_answered", "mini_review_completed", "final_review_completed", "today_completed"
  ]),
  stage: z.enum(["warmup", "scan", "learn", "reading", "context-quiz", "summary"]),
  occurredAt: z.iso.datetime({ offset: true }),
  questionId: z.string().min(1).optional(),
  correct: z.boolean().optional(),
  targetId: z.string().min(1).optional(),
  block: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  recognitionState: z.enum(["known", "fuzzy", "unknown"]).optional(),
  activity: z.enum(["learning-card", "association", "cloze", "recall"]).optional(),
  reviewKind: z.enum(["mini", "final"]).optional(),
  expectedRevision: z.number().int().nonnegative().optional()
});

export async function GET(request: Request) {
  if (isLocalTodayFixtureEnabled(process.env)) {
    return NextResponse.json(getE2ETodaySession(), { headers: { "cache-control": "private, no-store" } });
  }
  const viewer = await requireVerifiedViewerHttp();
  if (viewer instanceof NextResponse) return viewer;
  const planId = new URL(request.url).searchParams.get("planId");
  if (!planId) return NextResponse.json({ message: "缺少 Today 计划。" }, { status: 400 });
  const operationId = new URL(request.url).searchParams.get("operationId");
  if (operationId && operationId.length > 300) return NextResponse.json({message: "操作编号无效。"}, {status: 400});
  let session;
  try {
    if (operationId) {
      const applied = await createProductionTodayEventService().wasTodayOperationApplied(viewer.userId, planId, operationId);
      return NextResponse.json({applied}, {headers: {"cache-control": "private, no-store"}});
    }
    session = await createProductionTodayEventService().getTodaySession(viewer.userId, planId);
  } catch (error) {
    if (error instanceof TodayPlanNotFoundError) {
      return NextResponse.json({message: "Today 计划不存在。"}, {status: 404});
    }
    throw error;
  }
  return NextResponse.json(session, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (isLocalTodayFixtureEnabled(process.env)) {
    const event = eventSchema.parse(await request.json());
    return NextResponse.json(recordE2ETodayEvent(event), { headers: { "cache-control": "private, no-store" } });
  }
  const viewer = await requireVerifiedViewerHttp();
  if (viewer instanceof NextResponse) return viewer;
  const event = eventSchema.parse(await request.json());
  let session;
  try {
    session = await createProductionTodayEventService().recordTodayEvent(viewer.userId, event);
  } catch (error) {
    if (error instanceof TodayPlanNotFoundError) {
      return NextResponse.json({message: "Today 计划不存在。"}, {status: 404});
    }
    if (error instanceof TodayEventConflictError || (error instanceof RepositoryError && typeof error.cause === "object"
      && error.cause !== null && "code" in error.cause && error.cause.code === "40001")) {
      return NextResponse.json({message: "今日进度已变化，请重新读取。"}, {status: 409});
    }
    throw error;
  }
  if (event.type === "article_completed") {
    const client = createAdminSupabaseClient();
    const plan = await new SupabaseTodayRepository(client).getOwnedPlan(viewer.userId, event.planId);
    if (plan?.article) {
      const bundle = await new SupabaseFeedRepository(client).getTodayArticleBundle(viewer.userId, plan.article.articleId);
      if (bundle) await recordArticleBundleEncounters({
        client,
        userId: viewer.userId,
        articleId: plan.article.articleId,
        sourceKey: plan.article.sourceTitle,
        lexicalMatches: bundle.lexicalMatches,
        operationPrefix: event.operationId,
        occurredAt: event.occurredAt
      });
    }
  }
  return NextResponse.json(session, { headers: { "cache-control": "private, no-store" } });
}
