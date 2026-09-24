"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getHighlightLabel, type DailyReadingHighlightMatch, type HighlightLevel } from "@/lib/reading/daily-reading-highlights";
import { DailyReadingSummary } from "@/components/reading/daily-reading-summary";
import { DailyReadingWordDetail, type DailyReadingWordDetailData } from "@/components/reading/daily-reading-word-detail";
import type { DailyReadingRecommendation } from "@/types/reading-recommendations";

export interface DailyReadingArticleWord extends DailyReadingWordDetailData, DailyReadingHighlightMatch {}

export function DailyReadingArticle({ article, words }: { article: DailyReadingRecommendation; words: DailyReadingArticleWord[] }) {
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedWord = words.find((word) => word.wordId === selectedWordId) ?? null;
  useEffect(() => { if (selectedWord) dialogRef.current?.focus(); }, [selectedWord]);
  function closeDetails() { setSelectedWordId(null); requestAnimationFrame(() => triggerRef.current?.focus()); }

  const recentIds = article.matchedRecent7DayWordIds ?? article.matchedRecentWordIds;
  const recentLevel: HighlightLevel = article.matchedRecent7DayWordIds === undefined ? "recent-legacy" : "recent-7-day";
  const todayIds = new Set(article.matchedTodayWordIds);
  const frozenIds = new Set([...todayIds, ...recentIds]);
  const matches: DailyReadingHighlightMatch[] = words.flatMap(({ wordId, lemma, surfaceForms }) => {
    if (!frozenIds.has(wordId)) return [];
    return [{ wordId, lemma, surfaceForms, level: todayIds.has(wordId) ? "today" : recentLevel }];
  });
  return <main className="page-shell max-w-4xl py-8 sm:py-12">
    <Link href="/reading" className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"><ArrowLeft aria-hidden="true" className="size-4" />返回今日阅读</Link>
    <header className="mt-7"><div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted-foreground)]"><span className="font-semibold text-[var(--foreground)]">{article.sourceTitle}</span><span aria-hidden="true">·</span><span>{article.attribution}</span>{article.publishedAt && <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>}</div><h1 className="mt-3 text-3xl font-bold leading-tight tracking-[-0.035em] sm:text-4xl">{article.title}</h1><p className="mt-3 text-sm text-[var(--muted-foreground)]">今日词 {article.matchedTodayWordIds.length} 词 · {article.matchedRecent7DayWordIds === undefined ? "近期词" : "近 7 日词"} {recentIds.length} 词</p><div className="mt-5 flex flex-wrap gap-2" aria-label="词汇标记说明"><span className="rounded-full border px-3 py-1 text-xs underline decoration-2 underline-offset-2">今日词</span><span className="rounded-full border px-3 py-1 text-xs underline decoration-dotted decoration-2 underline-offset-2">{getHighlightLabel(recentLevel)}</span></div></header>
    {article.summary?.trim() ? <DailyReadingSummary summary={article.summary} matches={matches} onSelectWord={(wordId, trigger) => { triggerRef.current = trigger; setSelectedWordId(wordId); }} /> : <section className="mt-8 rounded-3xl border border-dashed bg-white px-5 py-8 sm:px-8" aria-label="文章摘要不可用"><p className="text-base leading-7 text-[var(--muted-foreground)]">发布方没有提供可展示的摘要。你仍可前往发布方阅读原文。</p></section>}
    <div className="mt-6"><a href={article.publisherUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">前往发布方阅读原文 <ExternalLink aria-hidden="true" className="size-4" /></a></div>
    {selectedWord && <DailyReadingWordDetail word={selectedWord} level={selectedWord.level} onClose={closeDetails} dialogRef={dialogRef} />}
  </main>;
}

function formatDate(value: string): string { const date = new Date(value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeZone: "Asia/Shanghai" }).format(date) : ""; }
