"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getHighlightLabel, type DailyReadingHighlightMatch, type HighlightLevel, type SummaryToken } from "@/lib/reading/daily-reading-highlights";
import { DailyReadingSummary } from "@/components/reading/daily-reading-summary";
import { DailyReadingWordDetail, type DailyReadingWordDetailData } from "@/components/reading/daily-reading-word-detail";
import type { DailyReadingRecommendation } from "@/types/reading-recommendations";
import type { ReinforcementAvailability, ReadingEvidenceAction } from "@/lib/reading/reinforcement/service";

export interface DailyReadingArticleWord extends DailyReadingWordDetailData, DailyReadingHighlightMatch {}
export interface DailyReadingArticleState { openedAt: string | null; completedAt: string | null }
type StatePatch = { opened?: true; completed?: true };

type PendingEvidence = {action: ReadingEvidenceAction; wordId: string};

export function DailyReadingArticle({ article, words, summaryTokens, initialState, reinforcement }: { article: DailyReadingRecommendation; words: DailyReadingArticleWord[]; summaryTokens: readonly SummaryToken[]; initialState?: DailyReadingArticleState; reinforcement?: ReinforcementAvailability | null }) {
  const router = useRouter();
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [readState, setReadState] = useState<DailyReadingArticleState>(initialState ?? { openedAt: null, completedAt: null });
  const [readStateError, setReadStateError] = useState("");
  const [pendingPatch, setPendingPatch] = useState<StatePatch | null>(null);
  const [stateBusy, setStateBusy] = useState(false);
  const [evidencePending, setEvidencePending] = useState<PendingEvidence[]>([]);
  const [confirmedOpenedIds, setConfirmedOpenedIds] = useState(() => new Set(reinforcement?.openedWordIds ?? []));
  const [practiceBusy, setPracticeBusy] = useState(false);
  const [practiceError, setPracticeError] = useState("");
  const openRequestSent = useRef<string | null>(null);
  const exposureSent = useRef(new Set<string>());
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const selectedWord = words.find((word) => word.wordId === selectedWordId) ?? null;
  useEffect(() => { if (selectedWord) dialogRef.current?.focus(); }, [selectedWord]);
  function closeDetails() { setSelectedWordId(null); requestAnimationFrame(() => triggerRef.current?.focus()); }
  const saveEvidence = useCallback(async (action: ReadingEvidenceAction, wordId: string) => {
    const key = `${action}:${wordId}`;
    try {
      const response = await fetch(`/api/reading/articles/${encodeURIComponent(article.articleId)}/evidence`, {
        method: "POST", headers: {"content-type": "application/json"}, body: JSON.stringify({action, wordId})
      });
      if (!response.ok) throw new Error("Reading evidence failed.");
      setEvidencePending((items) => items.filter((item) => `${item.action}:${item.wordId}` !== key));
      if (action === "detail-open") setConfirmedOpenedIds((ids) => new Set([...ids, wordId]));
    } catch {
      setEvidencePending((items) => items.some((item) => `${item.action}:${item.wordId}` === key)
        ? items : [...items, {action, wordId}]);
    }
  }, [article.articleId]);
  useEffect(() => {
    if (!article.summary?.trim()) return;
    for (const token of summaryTokens) {
      if (!token.wordId || exposureSent.current.has(token.wordId)) continue;
      exposureSent.current.add(token.wordId);
      void saveEvidence("exposure", token.wordId);
    }
  }, [article.summary, summaryTokens, saveEvidence]);

  async function startPractice() {
    if (practiceBusy) return;
    setPracticeBusy(true);
    setPracticeError("");
    try {
      const response = await fetch(`/api/reading/articles/${encodeURIComponent(article.articleId)}/reinforcement`, {method: "POST"});
      if (!response.ok) throw new Error("Reading practice failed.");
      const body = await response.json() as {kind: string; session?: {id: string}};
      if (body.kind !== "session" || !body.session?.id) throw new Error("No safe practice session.");
      router.push(`/reading/reinforcement/${encodeURIComponent(body.session.id)}`);
    } catch {
      setPracticeError("巩固练习暂时无法开始，请稍后重试。阅读完成状态已保存。");
    } finally { setPracticeBusy(false); }
  }
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
  const encounteredToday = new Set(summaryTokens.filter((token) => token.level === "today" && token.wordId).map((token) => token.wordId)).size;
  return <main className="page-shell max-w-4xl py-8 sm:py-12">
    <Link href="/reading" className="inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"><ArrowLeft aria-hidden="true" className="size-4" />返回今日阅读</Link>
    <header className="mt-7"><div className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted-foreground)]"><span className="font-semibold text-[var(--foreground)]">{article.sourceTitle}</span><span aria-hidden="true">·</span><span>{article.attribution}</span>{article.publishedAt && <time dateTime={article.publishedAt}>{formatDate(article.publishedAt)}</time>}</div><h1 className="mt-3 text-3xl font-bold leading-tight tracking-[-0.035em] sm:text-4xl">{article.title}</h1><p className="mt-3 text-sm text-[var(--muted-foreground)]">今日词 {article.matchedTodayWordIds.length} 词 · {article.matchedRecent7DayWordIds === undefined ? "近期词" : "近 7 日词"} {recentIds.length} 词</p><div className="mt-5 flex flex-wrap gap-2" aria-label="词汇标记说明"><span className="rounded-full border px-3 py-1 text-xs underline decoration-2 underline-offset-2">今日词</span><span className="rounded-full border px-3 py-1 text-xs underline decoration-dotted decoration-2 underline-offset-2">{getHighlightLabel(recentLevel)}</span></div></header>
    {article.summary?.trim() ? <DailyReadingSummary tokens={summaryTokens} onSelectWord={(wordId, trigger) => { triggerRef.current = trigger; setSelectedWordId(wordId); void saveEvidence("detail-open", wordId); }} /> : <section className="mt-8 rounded-3xl border border-dashed bg-white px-5 py-8 sm:px-8" aria-label="文章摘要不可用"><p className="text-base leading-7 text-[var(--muted-foreground)]">发布方没有提供可展示的摘要。你仍可前往发布方阅读原文。</p></section>}
    <div className="mt-6 flex flex-col items-start gap-3"><a href={article.publisherUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">前往发布方阅读原文 <ExternalLink aria-hidden="true" className="size-4" /></a>
      {readState.completedAt ? <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">已完成阅读</p> : <button type="button" disabled={stateBusy} onClick={() => void saveState({ completed: true })} className="min-h-11 rounded-xl bg-[var(--primary)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]">{stateBusy ? "正在保存…" : "完成阅读"}</button>}
      {readStateError && <div role="alert" className="text-sm text-rose-700">{readStateError}{pendingPatch && <button type="button" onClick={() => void saveState(pendingPatch)} disabled={stateBusy} className="ml-2 underline">重试保存</button>}</div>}
      {readState.completedAt && <section aria-label="阅读巩固结果" className="w-full rounded-2xl border bg-white p-4">
        <h2 className="font-bold">本篇阅读</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <p>今日词再次遇到：{encounteredToday}</p>
          <p>主动查看：{confirmedOpenedIds.size}</p>
          <p>巩固练习：{reinforcement?.practiced ?? 0}</p>
          <p>答对：{reinforcement?.correct ?? 0}</p>
        </div>
      </section>}
      {readState.completedAt && reinforcement && reinforcement.availableCount > 0 && <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-white p-4">
        {reinforcement.sessionId ? <Link href={`/reading/reinforcement/${encodeURIComponent(reinforcement.sessionId)}`} className="rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white">快速巩固 {reinforcement.availableCount} 个词</Link>
          : <button type="button" disabled={practiceBusy} onClick={() => void startPractice()} className="rounded-xl bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">快速巩固 {reinforcement.availableCount} 个词</button>}
        <span className="text-sm text-[var(--muted-foreground)]">可选练习，也可以稍后返回。</span>
      </div>}
      {practiceError && <p role="alert" className="text-sm text-rose-700">{practiceError}</p>}
    </div>
    {selectedWord && <DailyReadingWordDetail word={selectedWord} level={selectedWord.level} onClose={closeDetails} dialogRef={dialogRef} />}
    {evidencePending.length > 0 && <div role="status" className="fixed bottom-4 left-4 z-[60] max-w-sm rounded-xl border bg-white p-4 text-sm shadow-lg">阅读词汇记录保存失败，词汇详情仍可查看。<button type="button" className="ml-2 underline" onClick={() => { for (const item of evidencePending) void saveEvidence(item.action, item.wordId); }}>重试词汇记录</button></div>}
  </main>;
}

function formatDate(value: string): string { const date = new Date(value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeZone: "Asia/Shanghai" }).format(date) : ""; }
