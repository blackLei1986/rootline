"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getHighlightLabel, type DailyReadingHighlightMatch, type HighlightLevel } from "@/lib/reading/daily-reading-highlights";
import { DailyReadingSummary } from "@/components/reading/daily-reading-summary";
import { DailyReadingWordDetail, type DailyReadingWordDetailData } from "@/components/reading/daily-reading-word-detail";
import type { DailyReadingRecommendation } from "@/types/reading-recommendations";

export interface DailyReadingArticleWord extends DailyReadingWordDetailData, DailyReadingHighlightMatch {}
export interface DailyReadingArticleState { openedAt: string | null; completedAt: string | null }
type StatePatch = { opened?: true; completed?: true };

export function DailyReadingArticle({ article, words, initialState }: { article: DailyReadingRecommendation; words: DailyReadingArticleWord[]; initialState?: DailyReadingArticleState }) {
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [readState, setReadState] = useState<DailyReadingArticleState>(initialState ?? { openedAt: null, completedAt: null });
  const [readStateError, setReadStateError] = useState("");
  const [pendingPatch, setPendingPatch] = useState<StatePatch | null>(null);
  const [stateBusy, setStateBusy] = useState(false);
  const openRequestSent = useRef<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedWord = words.find((word) => word.wordId === selectedWordId) ?? null;
  useEffect(() => { if (selectedWord) dialogRef.current?.focus(); }, [selectedWord]);
  function closeDetails() { setSelectedWordId(null); requestAnimationFrame(() => triggerRef.current?.focus()); }
  const saveState = useCallback(async (patch: StatePatch) => {
    setStateBusy(true);
    setReadStateError("");
    try {
      const response = await fetch(`/api/reading/articles/${encodeURIComponent(article.articleId)}/state`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(patch)
      });
      if (!response.ok) throw new Error("Reading state update failed.");
      const payload = await response.json() as { state: DailyReadingArticleState };
      setReadState(payload.state);
      setPendingPatch(null);
    } catch {
      setPendingPatch(patch);
      setReadStateError("阅读状态保存失败，请检查网络后重试。");
    } finally {
      setStateBusy(false);
    }
  }, [article.articleId]);
  useEffect(() => {
    if (!initialState) return;
    if (initialState.openedAt || initialState.completedAt || openRequestSent.current === article.articleId) return;
    openRequestSent.current = article.articleId;
    void saveState({ opened: true });
  }, [article.articleId, initialState, saveState]);

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
    <div className="mt-6 flex flex-col items-start gap-3"><a href={article.publisherUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">前往发布方阅读原文 <ExternalLink aria-hidden="true" className="size-4" /></a>
      {readState.completedAt ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">已完成阅读</p> : <button type="button" disabled={stateBusy} onClick={() => void saveState({ completed: true })} className="min-h-11 rounded-xl bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">{stateBusy ? "正在保存…" : "完成阅读"}</button>}
      {readStateError && <div role="alert" className="text-sm text-rose-700">{readStateError}{pendingPatch && <button type="button" onClick={() => void saveState(pendingPatch)} disabled={stateBusy} className="ml-2 underline">重试保存</button>}</div>}
    </div>
    {selectedWord && <DailyReadingWordDetail word={selectedWord} level={selectedWord.level} onClose={closeDetails} dialogRef={dialogRef} />}
  </main>;
}

function formatDate(value: string): string { const date = new Date(value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeZone: "Asia/Shanghai" }).format(date) : ""; }
