import type { Metadata } from "next";
import { BookOpen } from "lucide-react";
import { DailyReadingList, DailyReadingSignInPrompt } from "@/components/reading/daily-reading-list";
import { getOptionalViewer } from "@/lib/auth/session";
import { createProductionDailyReadingRecommendationsService } from "@/lib/reading/server-recommendations";

export const metadata: Metadata = { title: "今日阅读", description: "用今日推荐的短文，在真实语境中再次遇见熟悉的词。" };

export default async function ReadingPage() {
  const viewer = await getOptionalViewer();
  const verified = Boolean(viewer?.emailVerified);
  let recommendations = [] as Awaited<ReturnType<ReturnType<typeof createProductionDailyReadingRecommendationsService>["getForToday"]>>["recommendations"];
  let unavailable = false;
  if (verified && viewer) {
    try {
      recommendations = (await createProductionDailyReadingRecommendationsService().getForToday(viewer.userId)).recommendations;
    } catch {
      unavailable = true;
    }
  }

  return (
    <div className="page-shell py-10 sm:py-14">
      <div className="flex items-center gap-2 text-[var(--primary)]"><BookOpen aria-hidden="true" className="size-4" /><p className="label-caps text-xs font-bold">Daily-3 Reading</p></div>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold tracking-[-0.04em] sm:text-5xl">今日阅读</h1>
          <p className="mt-3 max-w-2xl text-lg leading-8 text-[var(--muted-foreground)]">每天最多三篇，沿着今天的词汇继续读一点。阅读是 Daily 30 之外的可选巩固，不影响今日学习完成。</p>
        </div>
      </div>
      <div className="mt-9">
        {!verified ? <DailyReadingSignInPrompt /> : unavailable ? (
          <section role="alert" className="rounded-3xl border border-dashed bg-white px-6 py-12 text-center">
            <h2 className="text-xl font-bold">阅读推荐暂时不可用，请稍后重试。</h2>
            <a href="/reading" className="mt-4 inline-flex rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">重试</a>
          </section>
        ) : <DailyReadingList recommendations={recommendations} />}
      </div>
    </div>
  );
}
