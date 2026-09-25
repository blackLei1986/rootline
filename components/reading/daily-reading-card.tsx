import Link from "next/link";
import { ArrowRight, BookOpen, Clock3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DailyReadingRecommendation } from "@/types/reading-recommendations";

export function DailyReadingCard({ recommendation }: { recommendation: DailyReadingRecommendation }) {
  const recentWordIds = recommendation.matchedRecent7DayWordIds ?? recommendation.matchedRecentWordIds;
  const recentLabel = recommendation.matchedRecent7DayWordIds === undefined ? "近期词" : "近 7 日词";
  const coveragePercent = recommendation.estimatedUnknownCoverage.percent;
  const difficulty = coveragePercent < 10 ? "较容易" : coveragePercent < 25 ? "适中" : "有挑战";
  const summaryWordCount = recommendation.summary?.trim().match(/\S+/g)?.length ?? 0;
  const summaryMinutes = summaryWordCount ? Math.max(1, Math.ceil(summaryWordCount / 200)) : null;

  return (
    <Card className="h-full overflow-hidden border-[var(--border)] bg-white shadow-sm">
      <CardContent className="flex h-full flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <span className="font-semibold text-[var(--foreground)]">{recommendation.sourceTitle}</span>
          <span aria-hidden="true">·</span>
          <span>{recommendation.attribution}</span>
          {recommendation.publishedAt && <time dateTime={recommendation.publishedAt}>{formatPublishedDate(recommendation.publishedAt)}</time>}
        </div>
        <h2 className="mt-4 text-xl font-bold leading-7 tracking-tight">{recommendation.title}</h2>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-800">Today 命中 {recommendation.matchedTodayWordIds.length} 词</span>
          <span className="rounded-full bg-sky-50 px-3 py-1 font-medium text-sky-800">{recentLabel} {recentWordIds.length} 词</span>
          <span className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-900">{difficulty}</span>
        </div>
        {summaryMinutes ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-[var(--muted-foreground)]"><Clock3 aria-hidden="true" className="size-4" />摘要约 {summaryMinutes} 分钟</p>
        ) : (
          <p className="mt-4 text-sm text-[var(--muted-foreground)]">暂无摘要，可前往发布方阅读原文。</p>
        )}
        <Link
          href={`/reading/daily/${encodeURIComponent(recommendation.articleId)}`}
          className="mt-auto flex items-center justify-between rounded-xl bg-[var(--primary-soft)] px-4 py-3 text-sm font-semibold text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
        >
          <span className="flex items-center gap-2"><BookOpen aria-hidden="true" className="size-4" />开始阅读</span>
          <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </CardContent>
    </Card>
  );
}

function formatPublishedDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeZone: "Asia/Shanghai" }).format(date);
}
