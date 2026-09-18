import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArticleReader } from "@/components/reading/article-reader";
import { getOptionalViewer } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SupabaseFeedRepository } from "@/lib/repositories/supabase/feed-repository";

export const metadata: Metadata = { title: "Reading 文章" };

export default async function ReadingArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await getOptionalViewer();
  const { id } = await params;
  if (!viewer?.emailVerified) redirect(`/login?next=${encodeURIComponent(`/reading/articles/${id}`)}`);
  const article = await new SupabaseFeedRepository(createAdminSupabaseClient())
    .getAuthorizedArticle(viewer.userId, id);
  if (!article) notFound();
  return <div className="page-shell py-10 sm:py-14"><ArticleReader article={article} /></div>;
}
