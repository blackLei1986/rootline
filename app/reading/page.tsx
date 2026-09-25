import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { DailyReadingList, DailyReadingSignInPrompt } from "@/components/reading/daily-reading-list";
import { getOptionalViewer } from "@/lib/auth/session";
import { createProductionDailyReadingRecommendationsService } from "@/lib/reading/server-recommendations";
import { listActiveReadingReinforcementSessions } from "@/lib/reading/reinforcement/server";
import type { PublicSession } from "@/lib/reading/reinforcement/types";
import { shouldEmphasizeToday } from "@/lib/reading/today-priority";
import { ProductState } from "@/components/product-state";

export const metadata: Metadata = { title: "今日阅读", description: "用今日推荐的短文，在真实语境中再次遇见熟悉的词。" };

export default async function ReadingPage() {
  await connection();
  const viewer = await getOptionalViewer();
  const verified = Boolean(viewer?.emailVerified);
  let recommendations = [] as Awaited<ReturnType<ReturnType<typeof createProductionDailyReadingRecommendationsService>["getForToday"]>>["recommendations"];
  let unavailable = false;
  let activePractice: PublicSession[] = [];
  let todayNeedsAttention = false;
  if (verified && viewer) {
    try { todayNeedsAttention = await shouldEmphasizeToday(viewer.userId, new Date()); }
    catch { todayNeedsAttention = true; }
    try {
      recommendations = (await createProductionDailyReadingRecommendationsService().getForToday(viewer.userId)).recommendations;
    } catch {
      unavailable = true;
    }
    try { activePractice = await listActiveReadingReinforcementSessions(viewer.userId); }
    catch { /* The optional practice list cannot block Daily-3. */ }
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
      {todayNeedsAttention && <Link href="/today" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">先完成今日学习 →</Link>}
      <div className="mt-9">
        {!verified ? <DailyReadingSignInPrompt /> : unavailable ? <ProductState title="阅读推荐暂时不可用，请稍后重试。" description="请检查网络后重试；今日学习记录不会受影响。" actionHref="/reading" actionLabel="重试" variant="error" /> : <DailyReadingList recommendations={recommendations} />}
      </div>
      {activePractice.length > 0 && <section aria-label="继续词汇巩固" className="mt-10 rounded-3xl border bg-white p-6">
        <h2 className="text-xl font-bold">继续词汇巩固</h2>
        <ul className="mt-4 grid gap-3">{activePractice.slice(0, 3).map((session) => <li key={session.id}>
          <Link href={`/reading/reinforcement/${encodeURIComponent(session.id)}`} className="inline-flex min-h-11 items-center rounded-xl border px-4 py-2 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">继续练习 · {session.practiced}/{session.total} 词</Link>
        </li>)}</ul>
      </section>}
    </div>
  );
}
