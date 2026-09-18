"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Brain, RefreshCcw, Trophy } from "lucide-react";
import { getWordById } from "@/data/words";
import { useLearningProgress } from "@/hooks/use-learning-progress";
import { recordWordAnswer } from "@/lib/learning-actions";
import { buildPracticeQueue, insertPracticeReinforcement, type PracticeItem } from "@/lib/quiz-practice";
import type { ReviewRating } from "@/types/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { QuizCard } from "@/components/quiz-card";

export function QuizPractice() {
  const storage = useLearningProgress();
  const learnedIds = Object.values(storage.words)
    .filter((progress) => progress.firstLearnedAt)
    .map((progress) => progress.wordId)
    .filter((wordId) => Boolean(getWordById(wordId)));
  const [queue, setQueue] = useState<PracticeItem[]>([]);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answerCount, setAnswerCount] = useState(0);
  const [repeatCounts, setRepeatCounts] = useState<Record<string, number>>({});
  const [finished, setFinished] = useState(false);

  const start = () => {
    setQueue(buildPracticeQueue(learnedIds, storage));
    setIndex(0);
    setCorrectCount(0);
    setAnswerCount(0);
    setRepeatCounts({});
    setFinished(false);
  };

  const handleRated = (correct: boolean, rating: ReviewRating) => {
    const current = queue[index];
    recordWordAnswer(current.sourceWordId, rating, correct);
    let nextQueue = queue;
    if (!correct && (repeatCounts[current.sourceWordId] ?? 0) < 3) {
      const count = (repeatCounts[current.sourceWordId] ?? 0) + 1;
      nextQueue = insertPracticeReinforcement(queue, index, count - 1);
      setQueue(nextQueue);
      setRepeatCounts((currentCounts) => ({ ...currentCounts, [current.sourceWordId]: count }));
    }
    setAnswerCount((count) => count + 1);
    if (correct) setCorrectCount((count) => count + 1);
    if (index + 1 >= nextQueue.length) setFinished(true);
    else setIndex((currentIndex) => currentIndex + 1);
  };

  if (!learnedIds.length) {
    return <div className="page-shell grid min-h-[68vh] place-items-center py-12"><Card className="max-w-xl"><CardContent className="p-8 text-center"><Brain className="mx-auto size-10 text-[var(--primary)]" /><h1 className="mt-5 text-2xl font-bold">先学几个词，再来挑战测验</h1><p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">测验会从你的已学词汇中生成，并把答错的词延迟放回本轮队列。</p><Button asChild size="lg" className="mt-7"><Link href="/learn">开始今日学习 <ArrowRight className="size-4" /></Link></Button></CardContent></Card></div>;
  }

  if (!queue.length) {
    return <div className="page-shell grid min-h-[68vh] place-items-center py-12"><Card className="max-w-xl"><CardContent className="p-8 text-center"><Brain className="mx-auto size-10 text-[var(--primary)]" /><p className="label-caps mt-4 text-xs font-bold text-[var(--primary)]">Mixed quiz</p><h1 className="mt-2 text-3xl font-bold tracking-tight">五种题型，检验真正记住了多少</h1><p className="mt-3 text-sm leading-6 text-[var(--muted-foreground)]">本轮最多 10 道基础题。到期词优先，答错词会在 2–5 题后再次出现。</p><Button size="lg" className="mt-7" onClick={start}>开始测验 <ArrowRight className="size-4" /></Button></CardContent></Card></div>;
  }

  if (finished) {
    const accuracy = answerCount ? Math.round((correctCount / answerCount) * 100) : 0;
    return <div className="page-shell grid min-h-[68vh] place-items-center py-12"><Card className="w-full max-w-2xl border-indigo-200"><CardContent className="p-8 text-center sm:p-10"><Trophy className="mx-auto size-12 text-amber-500" /><p className="label-caps mt-5 text-xs font-bold text-[var(--primary)]">Quiz complete</p><h1 className="mt-2 text-3xl font-bold">完成！正确率 {accuracy}%</h1><p className="mt-3 text-[var(--muted-foreground)]">共回答 {answerCount} 次，答对 {correctCount} 次；错题已经同步更新到复习计划。</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Button onClick={start}><RefreshCcw className="size-4" />再测一轮</Button><Button asChild variant="outline"><Link href="/review">查看复习队列</Link></Button></div></CardContent></Card></div>;
  }

  const current = queue[index];
  return <div className="page-shell max-w-4xl py-8 sm:py-12"><div className="mb-7 flex items-center gap-4"><Progress value={(index / queue.length) * 100} /><span className="shrink-0 text-sm font-semibold text-[var(--muted-foreground)]">{index + 1} / {queue.length}</span></div><Card className="min-h-[540px] shadow-xl shadow-indigo-950/5"><CardContent className="flex min-h-[540px] flex-col justify-center p-6 sm:p-10"><QuizCard key={current.id} question={current} onRated={handleRated} /></CardContent></Card><p className="mt-4 text-center text-xs text-[var(--muted-foreground)]">Space 显示答案 · Enter 提交 · 1–4 评分</p></div>;
}
