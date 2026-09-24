import { BookOpen, LogIn } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DailyReadingCard } from "@/components/reading/daily-reading-card";
import type { DailyReadingRecommendation } from "@/types/reading-recommendations";

export function DailyReadingList({ recommendations }: { recommendations: DailyReadingRecommendation[] }) {
  const visible = recommendations.slice(0, 3);
  if (visible.length === 0) {
    return (
      <section className="rounded-3xl border border-dashed bg-white px-6 py-12 text-center" aria-labelledby="daily-reading-empty-title">
        <BookOpen aria-hidden="true" className="mx-auto size-8 text-[var(--primary)]" />
        <h2 id="daily-reading-empty-title" className="mt-4 text-2xl font-bold">今天还没有可推荐的短文。</h2>
        <p className="mx-auto mt-2 max-w-xl text-[var(--muted-foreground)]">有合适的文章时，会在这里出现最多三篇今日阅读。</p>
      </section>
    );
  }
  return <section aria-label="今日阅读推荐" className="grid gap-4 lg:grid-cols-3">{visible.map((item) => <DailyReadingCard key={item.articleId} recommendation={item} />)}</section>;
}

export function DailyReadingSignInPrompt() {
  return (
    <section className="rounded-3xl border border-dashed bg-white px-6 py-12 text-center" aria-labelledby="daily-reading-sign-in-title">
      <LogIn aria-hidden="true" className="mx-auto size-8 text-[var(--primary)]" />
      <h2 id="daily-reading-sign-in-title" className="mt-4 text-2xl font-bold">登录后查看今日阅读</h2>
      <p className="mx-auto mt-2 max-w-xl text-[var(--muted-foreground)]">今日阅读会根据你当前冻结的 Daily-3 推荐呈现。</p>
      <Button asChild className="mt-6"><Link href="/login?next=%2Freading">登录</Link></Button>
    </section>
  );
}
