import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DailyReadingArticle } from "@/components/reading/daily-reading-article";
import { getOptionalViewer } from "@/lib/auth/session";
import { loadDailyReadingArticlePageData } from "@/lib/reading/server-daily-reading-article-page";

export const metadata: Metadata = { title: "今日阅读文章", description: "阅读今日推荐摘要，并查看相关词汇。" };

export default async function DailyReadingArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getOptionalViewer();
  if (!viewer?.emailVerified) redirect(`/login?next=${encodeURIComponent(`/reading/daily/${id}`)}`);
  const data = await loadDailyReadingArticlePageData(viewer.userId, id);
  if (!data) notFound();
  return <DailyReadingArticle article={data.article} words={data.words} initialState={data.initialState} />;
}
