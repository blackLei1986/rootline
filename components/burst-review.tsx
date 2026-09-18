"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Clock3, Trophy, Zap } from "lucide-react";
import { getWordById } from "@/data/words";
import { useLearningProgress } from "@/hooks/use-learning-progress";
import { recordWordAnswer } from "@/lib/learning-actions";
import { buildPracticeQueue, type PracticeItem } from "@/lib/quiz-practice";
import { getDueWordIds } from "@/lib/session-builder";
import type { ReviewRating } from "@/types/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { QuizCard } from "@/components/quiz-card";

export function BurstReview() {
  const storage = useLearningProgress();
  const wordIds = useMemo(() => {
    const due = getDueWordIds(storage).slice(0, 15);
    if (due.length) return due;
    return Object.values(storage.words)
      .filter((progress) => progress.firstLearnedAt && getWordById(progress.wordId))
      .sort((a, b) => b.difficulty + b.lapses * 10 - (a.difficulty + a.lapses * 10))
      .slice(0, 15)
      .map((progress) => progress.wordId);
  }, [storage]);
  const [queue, setQueue] = useState<PracticeItem[]>([]);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);

  if (!wordIds.length) return <EmptyBurst />;
  if (!queue.length) return <div className="page-shell grid min-h-[68vh] place-items-center py-12"><Card className="max-w-xl border-indigo-200"><CardContent className="p-8 text-center sm:p-10"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-amber-50 text-amber-600"><Zap className="size-6" /></span><p className="label-caps mt-5 text-xs font-bold text-[var(--primary)]">Burst review</p><h1 className="mt-2 text-3xl font-bold">有 5 分钟？</h1><p className="mt-3 leading-7 text-[var(--muted-foreground)]">只复习最高优先级的 {Math.min(10, wordIds.length)} 个词。完成这一小批即可，不展示全部积压。</p><Button size="lg" className="mt-7" onClick={() => { setQueue(buildPracticeQueue(wordIds, storage)); setIndex(0); setCorrect(0); }}>开始快速复习 <ArrowRight className="size-4" /></Button></CardContent></Card></div>;

  if (index >= queue.length) {
    const accuracy = Math.round(correct / Math.max(1, queue.length) * 100);
    return <div className="page-shell grid min-h-[68vh] place-items-center py-12"><Card className="max-w-xl border-indigo-200"><CardContent className="p-8 text-center sm:p-10"><Trophy className="mx-auto size-12 text-amber-500" /><h1 className="mt-5 text-3xl font-bold">5 分钟复习完成</h1><p className="mt-3 text-[var(--muted-foreground)]">完成 {queue.length} 题，正确率 {accuracy}%。剩余复习已自动保留到之后。</p><div className="mt-7 flex justify-center gap-3"><Button asChild><Link href="/">返回首页</Link></Button><Button variant="outline" onClick={() => setQueue([])}>再来一轮</Button></div></CardContent></Card></div>;
  }

  const current = queue[index];
  const handleRated = (isCorrect: boolean, rating: ReviewRating) => {
    recordWordAnswer(current.sourceWordId, rating, isCorrect);
    if (isCorrect) setCorrect((value) => value + 1);
    setIndex((value) => value + 1);
  };
  return <div className="page-shell max-w-4xl py-8 sm:py-12"><div className="mb-7 flex items-center gap-4"><Progress value={index / queue.length * 100} /><span className="shrink-0 text-sm font-semibold text-[var(--muted-foreground)]">{index + 1} / {queue.length}</span><span className="hidden items-center gap-1 text-sm text-[var(--muted-foreground)] sm:flex"><Clock3 className="size-4" />约 5 分钟</span></div><Card className="min-h-[540px] shadow-xl shadow-indigo-950/5"><CardContent className="flex min-h-[540px] flex-col justify-center p-6 sm:p-10"><QuizCard key={current.id} question={current} onRated={handleRated} /></CardContent></Card></div>;
}

function EmptyBurst() {
  return <div className="page-shell grid min-h-[68vh] place-items-center py-12"><Card className="max-w-xl"><CardContent className="p-8 text-center"><Trophy className="mx-auto size-10 text-emerald-500" /><h1 className="mt-5 text-2xl font-bold">现在没有需要快速复习的词</h1><p className="mt-3 text-sm text-[var(--muted-foreground)]">先完成一轮学习，系统会自动挑选最值得复习的内容。</p><Button asChild className="mt-7"><Link href="/vocabulary">快速扫词 <ArrowRight className="size-4" /></Link></Button></CardContent></Card></div>;
}
