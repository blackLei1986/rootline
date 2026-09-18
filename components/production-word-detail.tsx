"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, LoaderCircle } from "lucide-react";
import { loadVocabularyEntry, tierLabel } from "@/lib/production-vocabulary";
import type { ProductionVocabularyEntry } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ProductionWordDetail({ id }: { id: string }) {
  const [entry, setEntry] = useState<ProductionVocabularyEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVocabularyEntry(id).then(setEntry).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="page-shell flex min-h-[60vh] items-center justify-center gap-2 text-sm text-[var(--muted-foreground)]"><LoaderCircle className="size-4 animate-spin" />正在按需加载词条</div>;
  if (!entry) return <div className="page-shell py-20 text-center"><h1 className="text-2xl font-bold">没有找到这个 accepted lemma</h1><Button asChild variant="outline" className="mt-6"><Link href="/vocabulary/search">返回搜索</Link></Button></div>;

  return <div className="page-shell max-w-4xl py-10 sm:py-14">
    <Button asChild variant="ghost" size="sm"><Link href="/vocabulary/search"><ArrowLeft className="size-4" />返回搜索</Link></Button>
    <Card className="mt-5 overflow-hidden border-indigo-200 shadow-xl shadow-indigo-950/5"><CardContent className="p-7 sm:p-10">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-5xl font-bold tracking-[-0.05em]">{entry.word}</h1><p className="mt-3 text-[var(--muted-foreground)]">{entry.phonetic || "音标待补充"} · {entry.partOfSpeech.join(" / ")}</p></div><Badge>{tierLabel(entry.contentTier)}</Badge></div>
      <div className="mt-8 rounded-2xl bg-[var(--primary-soft)] p-6"><p className="text-2xl font-bold text-[var(--primary)]">{entry.coreMeaningZh}</p><p className="mt-3 leading-7 text-[var(--muted-foreground)]">{entry.coreDefinitionEn}</p></div>
      <div className="mt-8"><div className="flex items-center gap-2"><BookOpen className="size-4 text-[var(--primary)]" /><h2 className="font-bold">语境例句</h2></div><div className="mt-4 space-y-3">{entry.examples.map((example, index) => <p key={`${entry.id}-${index}`} className="rounded-xl border bg-white p-4 leading-7">{example}</p>)}</div></div>
      <div className="mt-8 grid gap-4 sm:grid-cols-3"><Metric label="频率层级" value={entry.frequencyBand} /><Metric label="学习价值" value={entry.learningValueScore} /><Metric label="Surface forms" value={entry.surfaceForms.length} /></div>
      <p className="mt-7 text-xs leading-5 text-[var(--muted-foreground)]">来源：{entry.sourceMetadata.frequencySources.map((source) => source.name).join(" · ")} · Open English WordNet。词根仅在有可靠教学价值时展示。</p>
    </CardContent></Card>
  </div>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl bg-[var(--background)] p-4"><p className="text-xs text-[var(--muted-foreground)]">{label}</p><p className="mt-2 font-bold">{value}</p></div>; }
