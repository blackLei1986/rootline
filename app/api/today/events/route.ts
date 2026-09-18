import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVerifiedViewer } from "@/lib/auth/session";
import { createProductionTodayEventService } from "@/lib/today/server-service";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SupabaseTodayRepository } from "@/lib/repositories/supabase/today-repository";
import { SupabaseFeedRepository } from "@/lib/repositories/supabase/feed-repository";
import { recordArticleBundleEncounters } from "@/lib/reading/server-encounters";
import { getE2ETodaySession, recordE2ETodayEvent } from "@/lib/today/e2e-fixture";

const eventSchema = z.object({
  operationId: z.string().min(1).max(300),
  planId: z.uuid(),
  type: z.enum(["today_started", "stage_completed", "article_opened", "article_completed", "context_answered", "today_completed"]),
  stage: z.enum(["warmup", "scan", "learn", "reading", "context-quiz", "summary"]),
  occurredAt: z.iso.datetime({ offset: true }),
  questionId: z.string().min(1).optional(),
  correct: z.boolean().optional()
});

export async function GET(request: Request) {
  if (process.env.ROOTLINE_E2E_FIXTURES === "1") {
    return NextResponse.json(getE2ETodaySession(), { headers: { "cache-control": "private, no-store" } });
  }
  const viewer = await requireVerifiedViewer();
  const planId = new URL(request.url).searchParams.get("planId");
  if (!planId) return NextResponse.json({ message: "缺少 Today 计划。" }, { status: 400 });
  const session = await createProductionTodayEventService().getTodaySession(viewer.userId, planId);
  return NextResponse.json(session, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request) {
  if (process.env.ROOTLINE_E2E_FIXTURES === "1") {
    const event = eventSchema.parse(await request.json());
    return NextResponse.json(recordE2ETodayEvent(event), { headers: { "cache-control": "private, no-store" } });
  }
  const viewer = await requireVerifiedViewer();
  const event = eventSchema.parse(await request.json());
  const session = await createProductionTodayEventService().recordTodayEvent(viewer.userId, event);
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
