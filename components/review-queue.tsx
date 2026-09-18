"use client";

import Link from "next/link";
import { ArrowRight, CircleCheckBig, Clock3, TriangleAlert } from "lucide-react";
import { getWordById } from "@/data/words";
import { useLearningProgress } from "@/hooks/use-learning-progress";
import { getDueWordIds } from "@/lib/session-builder";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ReviewQueue() {
  const storage = useLearningProgress();
  const due = getDueWordIds(storage).map(getWordById).filter(Boolean);
  const difficult = Object.values(storage.words)
    .filter((item) => item.firstLearnedAt && (item.difficulty > 65 || item.lapses >= 2 || item.memoryStrength < 30))
    .sort((a, b) => b.difficulty - a.difficulty)
    .map((progress) => ({ progress, word: getWordById(progress.wordId) }))
    .filter((item) => item.word);
  return <div className="page-shell py-10 sm:py-14"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="label-caps text-xs font-bold text-[var(--primary)]">Review queue</p><h1 className="mt-2 text-3xl font-bold tracking-tight">今天该复习什么？</h1><p className="mt-2 text-[var(--muted-foreground)]">到期词优先，困难词会反复回到队列。</p></div>{due.length > 0 && <Button asChild size="lg"><Link href="/learn">开始复习 <ArrowRight className="size-4" /></Link></Button>}</div><div className="mt-9 grid gap-6 lg:grid-cols-2"><QueueSection title={`已到期 · ${due.length}`} icon={Clock3}>{due.length ? due.map((word) => word && <WordRow key={word.id} wordId={word.id} label={word.word} detail={`${word.meaningZh[0]} · ${word.rootIds[0] ?? "高频核心词"}`} />) : <EmptyState text="当前没有到期单词。" />}</QueueSection><QueueSection title={`需要重点复习 · ${difficult.length}`} icon={TriangleAlert}>{difficult.length ? difficult.map(({ progress, word }) => word && <WordRow key={word.id} wordId={word.id} label={word.word} detail={`记忆 ${progress.memoryStrength} · 难度 ${progress.difficulty} · 失误 ${progress.lapses}`} />) : <EmptyState text="还没有识别出明显困难词。" />}</QueueSection></div></div>;
}

function QueueSection({ title, icon: Icon, children }: { title: string; icon: typeof Clock3; children: React.ReactNode }) { return <Card><CardContent className="p-6"><h2 className="flex items-center gap-2 font-bold"><Icon className="size-5 text-[var(--primary)]" />{title}</h2><div className="mt-5 space-y-2">{children}</div></CardContent></Card>; }
function WordRow({ wordId, label, detail }: { wordId: string; label: string; detail: string }) { return <Link href={`/words/${wordId}`} className="flex items-center justify-between rounded-xl border px-4 py-3 transition-colors hover:border-indigo-200"><div><p className="font-semibold">{label}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{detail}</p></div><ArrowRight className="size-4 text-[var(--muted-foreground)]" /></Link>; }
function EmptyState({ text }: { text: string }) { return <div className="rounded-xl bg-[var(--background)] p-6 text-center"><CircleCheckBig className="mx-auto size-6 text-emerald-500" /><p className="mt-2 text-sm text-[var(--muted-foreground)]">{text}</p></div>; }
