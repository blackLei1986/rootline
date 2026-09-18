import { NextResponse } from "next/server";
import { getServerEnv } from "@/lib/config/env";
import { authorizeCronRequest } from "@/lib/jobs/cron-auth";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SupabaseFeedRepository } from "@/lib/repositories/supabase/feed-repository";
import { createFeedRefreshJob } from "@/lib/jobs/feed-refresh";
import { analyzePendingArticles } from "@/lib/jobs/article-analysis";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const env = getServerEnv();
  if (!authorizeCronRequest(request.headers.get("authorization"), env.CRON_SECRET)) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const repository = new SupabaseFeedRepository(createAdminSupabaseClient());
  const sourceIds = await repository.listRefreshableSourceIds(10);
  const refresh = createFeedRefreshJob({ repository });
  const refreshResults = [];
  for (const sourceId of sourceIds) refreshResults.push(await refresh(sourceId));
  const analysis = await analyzePendingArticles(10, repository);

  return NextResponse.json(
    {
      sourcesConsidered: sourceIds.length,
      sourcesUpdated: refreshResults.filter((result) => result.status === "updated").length,
      articlesConsidered: analysis.considered,
      articlesAnalyzed: analysis.analyzed,
      articlesRejected: analysis.rejected
    },
    { headers: { "cache-control": "private, no-store" } }
  );
}

export { GET as POST };
