"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, BookOpen, Brain, Clock3, Gauge, LoaderCircle, Sparkles, Target } from "lucide-react";
import { useLearningProgress } from "@/hooks/use-learning-progress";
import { calculateContextUnderstanding, calculateMasterySummary, calculateRetention } from "@/lib/mastery-engine";
import { readingStorage } from "@/lib/reading-storage";
import { unpackSearchRow, type VocabularySearchRow, type VocabularySearchResult } from "@/lib/production-vocabulary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const DAY = 86_400_000;

export function ProgressDashboard() {
  const storage = useLearningProgress();
  const [catalog, setCatalog] = useState<VocabularySearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const now = useMemo(() => new Date(), []);
  const mastery = useMemo(() => calculateMasterySummary(storage, now), [now, storage]);
  const retention7 = useMemo(() => calculateRetention(storage, 7, now), [now, storage]);
  const retention30 = useMemo(() => calculateRetention(storage, 30, now), [now, storage]);
  const context = useMemo(() => calculateContextUnderstanding(storage), [storage]);

  useEffect(() => {
    fetch("/vocabulary-data/index.json")
      .then((response) => response.json() as Promise<VocabularySearchRow[]>)
      .then((rows) => setCatalog(rows.map(unpackSearchRow)))
      .finally(() => setLoading(false));
  }, []);

  const coverage = useMemo(() => {
    const rows = [
      { label: "Core 1000", items: catalog.filter((entry) => entry.frequencyRank <= 1_000) },
      { label: "Core 2000", items: catalog.filter((entry) => entry.frequencyRank <= 2_000) },
      { label: "Core 3000", items: catalog.filter((entry) => entry.frequencyRank <= 3_000) },
      { label: "Core 5000", items: catalog.filter((entry) => entry.frequencyRank <= 5_000) },
      { label: "8000 Vocabulary", items: [...catalog].sort((a, b) => a.frequencyRank - b.frequencyRank).slice(0, 8_000) },
      { label: "IELTS-oriented", items: catalog.filter((entry) => entry.coverageTags.includes("ielts")) },
      { label: "TOEFL-oriented", items: catalog.filter((entry) => entry.coverageTags.includes("toefl")) },
      { label: "Academic", items: catalog.filter((entry) => entry.coverageTags.includes("academic")) }
    ];
    return rows.map((row) => {
      const recognized = row.items.filter((entry) => mastery.byWordId[entry.id]?.recognized).length;
      const stable = row.items.filter((entry) => mastery.byWordId[entry.id]?.stable).length;
      return { label: row.label, total: row.items.length, recognized, stable, recognizedPercent: row.items.length ? Math.round(recognized / row.items.length * 100) : 0, stablePercent: row.items.length ? Math.round(stable / row.items.length * 100) : 0 };
    });
  }, [catalog, mastery.byWordId]);

  const weekly = useMemo(() => {
    const cutoff = now.getTime() - 7 * DAY;
    const daily = Object.values(storage.dailyStats).filter((item) => new Date(`${item.date}T00:00:00`).getTime() >= cutoff);
    const minutes = daily.reduce((sum, item) => sum + item.studyMinutes, 0);
    const recognizedIds = new Set(storage.events.filter((event) => event.type === "recognition_known" && new Date(event.timestamp).getTime() >= cutoff).map((event) => event.wordId).filter(Boolean));
    const stableIds = Object.values(storage.words).filter((progress) => mastery.byWordId[progress.wordId]?.stable && progress.lastReviewedAt && new Date(progress.lastReviewedAt).getTime() >= cutoff).map((progress) => progress.wordId);
    const documents = readingStorage.listDocuments().filter((document) => new Date(document.createdAt).getTime() >= cutoff);
    const difficult = Object.values(storage.words).sort((a, b) => b.lapses + b.wrongCount - (a.lapses + a.wrongCount)).filter((item) => item.lapses + item.wrongCount > 0).slice(0, 5);
    return { minutes, recognized: recognizedIds.size, stable: stableIds.length, documents: documents.length, stablePerHour: minutes ? Math.round(stableIds.length / minutes * 60 * 10) / 10 : null, difficult };
  }, [mastery.byWordId, now, storage.dailyStats, storage.events, storage.words]);

  const readingTrend = (() => {
    const documents = readingStorage.listDocuments().slice(0, 10).reverse();
    if (!documents.length) return null;
    const values = documents.map((document) => readingStorage.getProgress(document.id)?.coverageAfter ?? document.coverage.contentWordCoverage);
    const split = Math.max(1, Math.floor(values.length / 2));
    const earlier = Math.round(values.slice(0, split).reduce((sum, value) => sum + value, 0) / split);
    const recentValues = values.slice(split);
    const recent = recentValues.length ? Math.round(recentValues.reduce((sum, value) => sum + value, 0) / recentValues.length) : earlier;
    return { earlier, recent, count: values.length };
  })();

  return <div className="page-shell py-10 sm:py-14">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="label-caps text-xs font-bold text-[var(--primary)]">Progress</p><h1 className="mt-2 text-4xl font-bold tracking-[-0.04em]">看见真正的词汇增长。</h1><p className="mt-3 max-w-2xl leading-7 text-[var(--muted-foreground)]">“看过”不等于“稳定掌握”。这里的稳定词需要至少 24 小时后的延迟验证。</p></div><Button asChild><Link href="/today">继续今日学习 <ArrowRight className="size-4" /></Link></Button></div>

    <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4"><MasteryCard icon={BookOpen} label="Recognized" value={mastery.recognized} detail="看到能识别，仍需验证" /><MasteryCard icon={Target} label="Stable" value={mastery.stable} detail="延迟复习后仍正确" /><MasteryCard icon={Brain} label="Active" value={mastery.active} detail="可主动回忆或填空" /><MasteryCard icon={Gauge} label="Fluent" value={mastery.fluent} detail="快速、准确且保留稳定" /></section>

    <section className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]"><Card><CardHeader><CardTitle>词汇覆盖</CardTitle><p className="text-sm text-[var(--muted-foreground)]">深色为稳定覆盖，浅色为已识别覆盖。考试路径只表示词汇倾向，不是分数预测。</p></CardHeader><CardContent className="grid gap-x-8 gap-y-5 md:grid-cols-2">{loading ? <div className="flex items-center gap-2 py-8 text-sm text-[var(--muted-foreground)]"><LoaderCircle className="size-4 animate-spin" />正在计算 9000 lemma 覆盖</div> : coverage.map((row) => <div key={row.label}><div className="mb-2 flex items-center justify-between text-sm"><span className="font-semibold">{row.label}</span><span className="text-[var(--muted-foreground)]">识别 {row.recognizedPercent}% · 稳定 {row.stablePercent}%</span></div><div className="relative"><Progress value={row.recognizedPercent} className="[&>div]:bg-indigo-200" /><Progress value={row.stablePercent} className="absolute inset-0 bg-transparent [&>div]:bg-[var(--primary)]" /></div></div>)}</CardContent></Card>
      <Card><CardHeader><CardTitle>保留与语境</CardTitle></CardHeader><CardContent className="space-y-4"><MetricRow label="7 日保留率" value={retention7.percent === null ? "待积累" : `${retention7.percent}%`} hint={`${retention7.attempts} 次延迟复习`} /><MetricRow label="30 日保留率" value={retention30.percent === null ? "待积累" : `${retention30.percent}%`} hint={`${retention30.attempts} 次延迟复习`} /><MetricRow label="语境理解" value={context === null ? "待积累" : `${context}%`} hint="句子识别与 Cloze" />{readingTrend && <MetricRow label="阅读覆盖趋势" value={`${readingTrend.earlier}% → ${readingTrend.recent}%`} hint={`最近 ${readingTrend.count} 篇文章`} />}</CardContent></Card></section>

    <section className="mt-8"><Card><CardHeader className="flex-row items-start justify-between"><div><p className="label-caps text-xs font-bold text-[var(--primary)]">Weekly review</p><CardTitle className="mt-1">这周到底有没有进步？</CardTitle></div><Badge variant="secondary">近 7 天</Badge></CardHeader><CardContent><div className="grid grid-cols-2 gap-4 sm:grid-cols-5"><WeeklyMetric icon={Clock3} label="有效学习" value={`${weekly.minutes} 分钟`} /><WeeklyMetric icon={BookOpen} label="新增识别" value={weekly.recognized} /><WeeklyMetric icon={Target} label="新增稳定" value={weekly.stable} /><WeeklyMetric icon={Activity} label="阅读文章" value={weekly.documents} /><WeeklyMetric icon={Sparkles} label="稳定效率" value={weekly.stablePerHour === null ? "待积累" : `${weekly.stablePerHour}/小时`} /></div>{weekly.difficult.length > 0 && <div className="mt-6 border-t pt-5"><p className="text-sm font-semibold">本周难词</p><div className="mt-3 flex flex-wrap gap-2">{weekly.difficult.map((item) => <Badge key={item.wordId} variant="warning">{item.wordId}</Badge>)}</div></div>}<p className="mt-5 text-sm text-[var(--muted-foreground)]">{weekly.stable > 0 ? `本周有 ${weekly.stable} 个词通过了延迟验证，这才计入稳定增长。` : "稳定增长需要隔天验证；今天首次看到的词不会立即算作掌握。"}</p></CardContent></Card></section>
  </div>;
}

function MasteryCard({ icon: Icon, label, value, detail }: { icon: typeof BookOpen; label: string; value: number; detail: string }) { return <Card><CardContent className="p-5"><Icon className="size-5 text-[var(--primary)]" /><p className="mt-4 text-3xl font-bold">{value}</p><p className="mt-1 font-semibold">{label}</p><p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">{detail}</p></CardContent></Card>; }
function MetricRow({ label, value, hint }: { label: string; value: string; hint: string }) { return <div className="rounded-xl bg-[var(--background)] p-4"><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">{label}</span><span className="font-bold text-[var(--primary)]">{value}</span></div><p className="mt-1 text-xs text-[var(--muted-foreground)]">{hint}</p></div>; }
function WeeklyMetric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string | number }) { return <div className="rounded-xl border p-4"><Icon className="size-4 text-[var(--primary)]" /><p className="mt-3 text-xl font-bold">{value}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{label}</p></div>; }
