import { NextResponse } from "next/server";
import { z } from "zod";
import { requireVerifiedViewer } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SupabaseFeedRepository } from "@/lib/repositories/supabase/feed-repository";
import { safeFetchText } from "@/lib/feeds/safe-fetch";
import { extractArticle } from "@/lib/articles/extract";
import { fingerprintArticle } from "@/lib/articles/fingerprint";

const schema = z.object({ url: z.url() });

export async function POST(request: Request) {
  const viewer = await requireVerifiedViewer();
  const input = schema.parse(await request.json());
  const response = await safeFetchText(input.url, "article");
  const article = extractArticle(response.text, response.finalUrl);
  const repository = new SupabaseFeedRepository(createAdminSupabaseClient());
  const articleId = await repository.saveImportedArticle(
    viewer.userId,
    article,
    fingerprintArticle(article)
  );
  return NextResponse.json({ articleId }, { status: 201 });
}
