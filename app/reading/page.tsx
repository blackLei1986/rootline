import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus2, Rss, Sparkles } from "lucide-react";
import { ForYou } from "@/components/reading/for-you";
import { Button } from "@/components/ui/button";
import { getOptionalViewer } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { SupabaseFeedRepository } from "@/lib/repositories/supabase/feed-repository";

export const metadata: Metadata = { title: "阅读分析", description: "从真实英文文章中发现值得学习的词汇缺口。" };

export default async function ReadingPage() {
  const viewer = await getOptionalViewer();
  const candidates = viewer?.emailVerified
    ? await new SupabaseFeedRepository(createAdminSupabaseClient()).listCandidatesForUser(viewer.userId)
    : [];

  return (
    <div className="page-shell py-10 sm:py-14">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-[var(--primary)]"><Sparkles className="size-4" /><p className="label-caps text-xs font-bold">Reading for today</p></div>
          <h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">今天最值得读的文章</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--muted-foreground)]">系统从你的来源中挑选覆盖度合适、只包含少量高价值新词的 1–3 篇。文章池很大，但今天只需要面对最合适的内容。</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="outline"><Link href="/reading/sources"><Rss className="size-4" />订阅源</Link></Button>
          <Button asChild variant="outline"><Link href="/reading/import"><FilePlus2 className="size-4" />导入</Link></Button>
        </div>
      </div>
      <div className="mt-9"><ForYou authenticated={Boolean(viewer?.emailVerified)} candidates={candidates} /></div>
    </div>
  );
}
