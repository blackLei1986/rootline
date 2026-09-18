import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVerifiedViewerHttp } from "@/lib/auth/http";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SupabaseFeedRepository } from "@/lib/repositories/supabase/feed-repository";
import { safeFetchText } from "@/lib/feeds/safe-fetch";
import { parseFeed } from "@/lib/feeds/parser";

const subscribeSchema = z.object({ url: z.url() });

export async function GET() {
  const viewer = await requireVerifiedViewerHttp();
  if (viewer instanceof NextResponse) return viewer;
  const repository = new SupabaseFeedRepository(createAdminSupabaseClient());
  return NextResponse.json(
    { sources: await repository.listSourcesForUser(viewer.userId) },
    { headers: { "cache-control": "private, no-store" } }
  );
}

export async function POST(request: Request) {
  const viewer = await requireVerifiedViewerHttp();
  if (viewer instanceof NextResponse) return viewer;
  const input = subscribeSchema.parse(await request.json());
  const response = await safeFetchText(input.url, "feed");
  const feed = parseFeed(response.text, response.finalUrl);
  const repository = new SupabaseFeedRepository(createAdminSupabaseClient());
  const sourceId = await repository.upsertSource(response.finalUrl, feed);
  await repository.subscribe(viewer.userId, sourceId);
  const counts = await repository.saveEntries(sourceId, feed.entries);
  return NextResponse.json({ sourceId, ...counts }, { status: 201 });
}

export async function DELETE(request: Request) {
  const viewer = await requireVerifiedViewerHttp();
  if (viewer instanceof NextResponse) return viewer;
  const sourceId = new URL(request.url).searchParams.get("sourceId");
  if (!sourceId) return NextResponse.json({ message: "缺少订阅源。" }, { status: 400 });
  const repository = new SupabaseFeedRepository(createAdminSupabaseClient());
  await repository.unsubscribe(viewer.userId, sourceId);
  return new NextResponse(null, { status: 204 });
}
