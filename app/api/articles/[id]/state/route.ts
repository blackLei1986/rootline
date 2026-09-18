import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVerifiedViewerHttp } from "@/lib/auth/http";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SupabaseFeedRepository } from "@/lib/repositories/supabase/feed-repository";
import { recordArticleBundleEncounters } from "@/lib/reading/server-encounters";

const schema = z.object({
  saved: z.boolean().optional(),
  hidden: z.boolean().optional(),
  completed: z.boolean().optional()
}).refine((value) => Object.keys(value).length > 0);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await requireVerifiedViewerHttp();
  if (viewer instanceof NextResponse) return viewer;
  const state = schema.parse(await request.json());
  const { id } = await params;
  const client = createAdminSupabaseClient();
  const repository = new SupabaseFeedRepository(client);
  const article = await repository.getAuthorizedArticle(viewer.userId, id);
  if (!article) return NextResponse.json({ message: "文章不可用。" }, { status: 404 });
  await repository.updateArticleState(viewer.userId, id, state);
  if (state.completed) {
    const bundle = await repository.getTodayArticleBundle(viewer.userId, id);
    if (bundle) await recordArticleBundleEncounters({
      client,
      userId: viewer.userId,
      articleId: id,
      sourceKey: article.sourceTitle,
      lexicalMatches: bundle.lexicalMatches,
      operationPrefix: `article-complete:${id}`,
      occurredAt: new Date().toISOString()
    });
  }
  return NextResponse.json({ ok: true });
}
