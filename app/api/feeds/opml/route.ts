import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVerifiedViewerHttp } from "@/lib/auth/http";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SupabaseFeedRepository } from "@/lib/repositories/supabase/feed-repository";
import { assertPublicHttpUrl, nodeHostResolver } from "@/lib/feeds/network-policy";
import { parseOpml, serializeOpml } from "@/lib/feeds/opml";

const importSchema = z.object({ xml: z.string().min(1).max(2 * 1024 * 1024) });

export async function GET() {
  const viewer = await requireVerifiedViewerHttp();
  if (viewer instanceof NextResponse) return viewer;
  const repository = new SupabaseFeedRepository(createAdminSupabaseClient());
  const sources = await repository.listSourcesForUser(viewer.userId);
  const xml = serializeOpml(sources.map((source) => ({
    title: source.title,
    feedUrl: source.feedUrl,
    siteUrl: source.siteUrl
  })));
  return new NextResponse(xml, {
    headers: {
      "content-type": "text/x-opml; charset=utf-8",
      "content-disposition": 'attachment; filename="rootline-subscriptions.opml"',
      "cache-control": "private, no-store"
    }
  });
}

export async function POST(request: Request) {
  const viewer = await requireVerifiedViewerHttp();
  if (viewer instanceof NextResponse) return viewer;
  const input = importSchema.parse(await request.json());
  const subscriptions = parseOpml(input.xml);
  const repository = new SupabaseFeedRepository(createAdminSupabaseClient());
  let imported = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      await assertPublicHttpUrl(new URL(subscription.feedUrl), nodeHostResolver);
      const sourceId = await repository.upsertSource(subscription.feedUrl, {
        title: subscription.title,
        feedUrl: subscription.feedUrl,
        siteUrl: subscription.siteUrl,
        description: null,
        entries: []
      });
      await repository.subscribe(viewer.userId, sourceId);
      imported += 1;
    } catch {
      failed += 1;
    }
  }
  return NextResponse.json({ imported, failed });
}
