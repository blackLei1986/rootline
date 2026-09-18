"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, LoaderCircle, Search } from "lucide-react";
import { searchVocabulary, tierLabel, type VocabularySearchRow } from "@/lib/production-vocabulary";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export function VocabularySearch() {
  const [rows, setRows] = useState<VocabularySearchRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/vocabulary-data/index.json", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("词库索引加载失败");
        return response.json() as Promise<VocabularySearchRow[]>;
      })
      .then(setRows)
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "词库索引加载失败"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  const results = useMemo(() => searchVocabulary(rows, query), [query, rows]);

  return <div className="page-shell max-w-4xl py-10 sm:py-14">
    <div className="mx-auto max-w-2xl text-center">
      <p className="label-caps text-xs font-bold text-[var(--primary)]">Master Vocabulary</p>
      <h1 className="mt-2 text-4xl font-bold tracking-[-0.04em]">查一个词，不必面对整座词库。</h1>
      <p className="mt-3 leading-7 text-[var(--muted-foreground)]">后台已覆盖 9000 个通过验收的 lemma；这里只在你主动搜索时加载轻量索引。</p>
    </div>
    <div className="relative mx-auto mt-8 max-w-2xl">
      <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[var(--muted-foreground)]" />
      <input value={query} onChange={(event) => setQuery(event.target.value)} autoFocus placeholder="输入英文或中文释义" className="h-14 w-full rounded-2xl border bg-white pl-12 pr-4 text-lg outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100" />
    </div>
    <div className="mx-auto mt-7 max-w-2xl space-y-3">
      {loading && <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--muted-foreground)]"><LoaderCircle className="size-4 animate-spin" />正在加载搜索索引</div>}
      {error && <Card><CardContent className="p-6 text-center text-sm text-rose-700">{error}</CardContent></Card>}
      {!loading && query.trim() && !results.length && <Card><CardContent className="p-8 text-center text-sm text-[var(--muted-foreground)]">没有找到匹配的 accepted lemma。</CardContent></Card>}
      {results.map((entry) => <Link key={entry.id} href={`/vocabulary/catalog/${encodeURIComponent(entry.id)}`} className="group block rounded-2xl border bg-white p-5 transition hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-950/5">
        <div className="flex items-center justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold">{entry.word}</h2><span className="text-xs text-[var(--muted-foreground)]">{entry.partOfSpeech.join(" · ")}</span></div><p className="mt-2 truncate text-sm text-[var(--muted-foreground)]">{entry.meaningZh}</p><div className="mt-3 flex flex-wrap gap-1.5"><Badge variant="secondary">{tierLabel(entry.tier)}</Badge>{entry.coverageTags.slice(0, 3).map((tag) => <Badge key={tag} variant="outline">{tag.toUpperCase()}</Badge>)}</div></div><ArrowRight className="size-5 shrink-0 text-[var(--primary)] transition group-hover:translate-x-1" /></div>
      </Link>)}
    </div>
  </div>;
}
