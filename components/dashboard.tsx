"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BookOpen, Brain, Clock3, Flame, Layers3, Sparkles, Target, TriangleAlert } from "lucide-react";
import { getRootById, roots } from "@/data/roots";
import { getWordById } from "@/data/words";
import { calculateStudyStreak } from "@/lib/progress-calculation";
import { getCurrentUnit, getNextMilestone, getRecommendedRoots, getStageProgress } from "@/lib/course-engine";
import { getDueWordIds, selectActiveRootId } from "@/lib/session-builder";
import { generalEnglishCore } from "@/data/course";
import { dateKey } from "@/lib/storage";
import { useLearningProgress } from "@/hooks/use-learning-progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatCard } from "@/components/stat-card";
import { DebugPanel } from "@/components/debug-panel";
import { calculateDailyLoad } from "@/lib/adaptive-load";

export function Dashboard() {
  const storage = useLearningProgress();
  const [now] = useState(() => new Date());
  const today = storage.dailyStats[dateKey(now)];
  const dueWordIds = getDueWordIds(storage, now);
  const learnedProgress = Object.values(storage.words).filter((item) => item.firstLearnedAt);
  const learnedLemmas = new Set(learnedProgress.map((item) => getWordById(item.wordId)?.lemma ?? item.wordId));
  const masteredLemmas = new Set(learnedProgress.filter((item) => item.status === "mastered").map((item) => getWordById(item.wordId)?.lemma ?? item.wordId));
  const masteredCount = masteredLemmas.size;
  const learnedRoots = Object.values(storage.roots).filter((item) => item.learnedWordIds.length > 0).length;
  const activeRootId = selectActiveRootId(storage);
  const activeRoot = getRootById(activeRootId) ?? roots[0];
  const dailyLoad = calculateDailyLoad(storage, now);
  const newRemaining = Math.max(0, dailyLoad.newWords - (today?.newWordsLearned ?? 0));
  const todayCompleted = (today?.newWordsLearned ?? 0) + (today?.reviewsCompleted ?? 0);
  const todayGoal = dailyLoad.newWords + Math.min(dailyLoad.reviewWords, dueWordIds.length);
  const progressPercent = todayGoal > 0 ? Math.min(100, Math.round((todayCompleted / todayGoal) * 100)) : 100;
  const estimate = dailyLoad.estimatedMinutes;
  const streak = calculateStudyStreak(storage.dailyStats, now);
  const reviewWords = dueWordIds.slice(0, 4).map(getWordById).filter(Boolean);
  const difficultWords = learnedProgress
    .filter((item) => item.difficulty > 65 || item.lapses >= 2 || item.memoryStrength < 30)
    .sort((a, b) => b.difficulty + b.lapses * 10 - (a.difficulty + a.lapses * 10))
    .slice(0, 4)
    .map((progress) => ({ progress, word: getWordById(progress.wordId) }))
    .filter((item) => item.word);
  const dateLabel = now.toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "long" });
  const pathProgress = getStageProgress(generalEnglishCore.stages[0], storage);
  const currentUnit = getCurrentUnit(storage);
  const recommendedRoots = getRecommendedRoots(storage, 2);

  return (
    <div className="page-shell py-9 sm:py-12">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="label-caps text-xs font-bold text-[var(--primary)]">{dateLabel}</p><h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">{todayCompleted > 0 ? "记忆正在变得更牢固。" : "今天，从最值得学的词开始。"}</h1><p className="mt-2 text-[var(--muted-foreground)]">高频优先 · 词根辅助 · 语境巩固 · 考试导向</p></div>
        <Badge variant="success" className="w-fit"><Flame className="mr-1.5 size-3.5" />连续学习 {streak} 天</Badge>
      </div>

      <section className="grid gap-6 lg:grid-cols-[1.45fr_0.85fr]">
        <Card className="relative overflow-hidden border-indigo-200 bg-[#1f2550] text-white shadow-xl shadow-indigo-950/10">
          <div className="absolute -right-16 -top-20 size-64 rounded-full border border-white/10" /><div className="absolute -right-6 top-8 size-40 rounded-full border border-white/10" />
          <CardContent className="relative p-7 sm:p-9">
            <div className="flex items-center justify-between"><span className="label-caps text-xs font-bold text-indigo-200">{dailyLoad.recoveryMode ? "Recovery mode" : "今日推荐"}</span><span className="flex items-center gap-1.5 text-sm text-indigo-200"><Clock3 className="size-4" />约 {estimate} 分钟</span></div>
            <div className="mt-9 grid grid-cols-3 gap-5"><div><p className="text-3xl font-bold">{newRemaining}</p><p className="mt-1 text-sm text-indigo-200">新词</p></div><div><p className="text-3xl font-bold">{dailyLoad.reviewWords}</p><p className="mt-1 text-sm text-indigo-200">本轮复习</p></div><div><p className="text-3xl font-bold">{dailyLoad.rapidScanSize}</p><p className="mt-1 text-sm text-indigo-200">快速扫描</p></div></div>
            <div className="mt-8 border-t border-white/15 pt-6"><div className="mb-4 flex items-center justify-between text-sm"><span className="text-indigo-200">今日进度</span><span className="font-semibold">{todayCompleted} / {Math.max(todayGoal, storage.settings.dailyNewWordGoal)}</span></div><Progress value={progressPercent} className="bg-white/15 [&>div]:bg-indigo-300" /></div>
            {dailyLoad.recoveryMode && <p className="mt-5 rounded-xl bg-white/10 px-4 py-3 text-sm text-indigo-100">积压较多，今天只处理最高优先级的 {dailyLoad.reviewWords} 个词，其他词自动延后。</p>}
            <Button asChild size="lg" className="mt-7 bg-white text-[#252a58] hover:bg-indigo-50"><Link href="/today">{todayCompleted ? "继续今日学习" : dailyLoad.recoveryMode ? "开始恢复复习" : "开始今日学习"} <ArrowRight className="size-4" /></Link></Button>
          </CardContent>
        </Card>

        <Card><CardHeader className="pb-4"><div className="flex items-center gap-2 text-[var(--primary)]"><Sparkles className="size-4" /><span className="label-caps text-xs font-bold">当前词根</span></div></CardHeader><CardContent><div className="rounded-2xl bg-[var(--primary-soft)] p-5"><div className="flex items-start justify-between"><div><p className="text-4xl font-bold tracking-[-0.04em]">{activeRoot.root}</p><p className="mt-2 font-semibold text-[var(--primary)]">{activeRoot.meaningEn.join(" / ")}</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">{activeRoot.meaningZh.join(" · ")}</p></div><Badge variant="outline" className="border-indigo-200 bg-white/70">{storage.roots[activeRoot.id]?.mastery ?? 0}%</Badge></div></div><p className="mt-5 text-sm leading-6 text-[var(--muted-foreground)]">{activeRoot.description}</p><Button asChild variant="outline" className="mt-5 w-full"><Link href={`/roots/${activeRoot.id}`}>查看词根详情</Link></Button></CardContent></Card>
      </section>

      <section className="mt-8"><Card className="overflow-hidden border-indigo-200 bg-gradient-to-r from-indigo-50 to-white"><CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7"><div><p className="label-caps text-xs font-bold text-[var(--primary)]">Read · Discover · Learn</p><h2 className="mt-2 text-xl font-bold">从真实文章里发现你的词汇缺口</h2><p className="mt-2 text-sm text-[var(--muted-foreground)]">粘贴 TOEFL、IELTS 或普通英文文章，找出最值得学的 10–15 个词。</p></div><Button asChild variant="outline" className="shrink-0"><Link href="/reading">分析一篇文章 <ArrowRight className="size-4" /></Link></Button></CardContent></Card></section>

      <section className="mt-8">
        <Card className="border-indigo-200"><CardContent className="p-6 sm:p-7"><div className="grid gap-6 lg:grid-cols-[1fr_1.2fr_auto] lg:items-center"><div><p className="label-caps text-xs font-bold text-[var(--primary)]">Learning path</p><h2 className="mt-2 text-xl font-bold">通用英语核心词根 · Stage 1</h2><p className="mt-1 text-sm text-[var(--muted-foreground)]">当前小节：{currentUnit.title}</p></div><div><div className="mb-2 flex justify-between text-sm"><span className="text-[var(--muted-foreground)]">阶段进度</span><span className="font-semibold">{pathProgress.percent}% · {pathProgress.learnedRoots}/{pathProgress.totalRoots} roots</span></div><Progress value={pathProgress.percent} /><p className="mt-2 text-xs text-[var(--muted-foreground)]">当前 {recommendedRoots[0]?.root ?? activeRoot.root} · 下一推荐 {recommendedRoots[1]?.root ?? recommendedRoots[0]?.root ?? activeRoot.root} · {getNextMilestone(storage)}</p></div><Button asChild variant="outline"><Link href="/course">查看学习路径 <ArrowRight className="size-4" /></Link></Button></div></CardContent></Card>
      </section>

      <section className="mt-10"><div className="mb-4 flex items-end justify-between"><div><p className="label-caps text-xs font-bold text-[var(--muted-foreground)]">Overview</p><h2 className="mt-1 text-xl font-bold">学习统计</h2></div><Link href="/progress" className="text-sm font-semibold text-[var(--primary)]">查看真实增长 <ArrowRight className="ml-1 inline size-3.5" /></Link></div><div className="grid grid-cols-2 gap-4 lg:grid-cols-5"><StatCard icon={Layers3} label="已学词根" value={learnedRoots} hint={`共 ${roots.length} 个`} /><StatCard icon={BookOpen} label="已学 Lemma" value={learnedLemmas.size} hint="仅统计已交互词汇" /><StatCard icon={Brain} label="已掌握" value={masteredCount} /><StatCard icon={Flame} label="连续学习" value={`${streak} 天`} /><StatCard icon={Target} label="今日完成" value={`${progressPercent}%`} /></div></section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>今日复习</CardTitle><p className="mt-1 text-sm text-[var(--muted-foreground)]">按逾期、错误和记忆强度排序。</p></div><Badge variant={dueWordIds.length ? "default" : "secondary"}>{dueWordIds.length} 个到期</Badge></CardHeader><CardContent className="space-y-2">{reviewWords.length ? reviewWords.map((word) => word && <Link key={word.id} href={`/words/${word.id}`} className="flex items-center justify-between rounded-xl border px-4 py-3 transition-colors hover:border-indigo-200 hover:bg-indigo-50/40"><div><span className="font-semibold">{word.word}</span><span className="ml-3 text-sm text-[var(--muted-foreground)]">{word.meaningZh[0]}</span></div><span className="flex items-center gap-2 text-xs font-semibold text-[var(--primary)]">{word.rootIds[0] ?? "高频词"}<ArrowRight className="size-3.5" /></span></Link>) : <div className="rounded-xl bg-[var(--background)] p-5 text-center text-sm text-[var(--muted-foreground)]">暂无到期复习，可以安心学几个新词。</div>}<Button asChild variant="outline" className="mt-3 w-full"><Link href="/review">查看复习队列</Link></Button></CardContent></Card>
        <Card><CardHeader className="flex-row items-center justify-between"><div><CardTitle>需要重点复习</CardTitle><p className="mt-1 text-sm text-[var(--muted-foreground)]">困难度高、多次答错或记忆较弱。</p></div><TriangleAlert className="size-5 text-amber-500" /></CardHeader><CardContent className="space-y-2">{difficultWords.length ? difficultWords.map(({ progress, word }) => word && <Link key={word.id} href={`/words/${word.id}`} className="flex items-center justify-between rounded-xl border px-4 py-3"><div><span className="font-semibold">{word.word}</span><span className="ml-3 text-sm text-[var(--muted-foreground)]">{word.meaningZh[0]}</span></div><span className="text-xs font-semibold text-amber-700">强度 {progress.memoryStrength}</span></Link>) : <div className="rounded-xl bg-[var(--background)] p-5 text-center text-sm text-[var(--muted-foreground)]">完成几轮学习后，难词会自动出现在这里。</div>}</CardContent></Card>
      </section>
      {process.env.NODE_ENV === "development" && <DebugPanel />}
    </div>
  );
}
