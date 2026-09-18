"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Brain, Check, Eye, Gauge, LoaderCircle, RotateCcw, Trophy } from "lucide-react";
import { ArticleContextQuiz } from "@/components/today/article-context-quiz";
import { ArticleReadingStage } from "@/components/today/article-reading-stage";
import { TodaySetup } from "@/components/today/today-setup";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { markWordIntroduced, recordWordAnswer } from "@/lib/learning-actions";
import { recordWordRecognition } from "@/lib/recognition-progress";
import { cn } from "@/lib/utils";
import { queueSyncPayload } from "@/lib/sync/offline-queue";
import type { RecognitionState } from "@/types/progress";
import type { TodayPlanDTO, TodayStage } from "@/types/today";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

type Phase = "setup" | TodayStage;
interface Result { id: string; state: RecognitionState }
interface TodayStageEvent { type: string; stage: TodayStage; questionId?: string; correct?: boolean }

export function TodayLearningFlow({ initialPlan, onEvent }: { initialPlan?: TodayPlanDTO; onEvent?: (event: TodayStageEvent) => void | Promise<void> }) {
  const [plan, setPlan] = useState<TodayPlanDTO | null>(initialPlan ?? null);
  const [phase, setPhase] = useState<Phase>("setup");
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [quizCorrect, setQuizCorrect] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(!initialPlan);
  const [error, setError] = useState("");
  const itemStartedAt = useRef(0);
  const eventChain = useRef(Promise.resolve());

  useEffect(() => {
    if (initialPlan) return;
    let active = true;
    fetch("/api/today", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("今日计划加载失败");
        return response.json() as Promise<TodayPlanDTO>;
      })
      .then(async (value) => {
        if (!active) return;
        setPlan(value);
        const response = await fetch(`/api/today/events?planId=${encodeURIComponent(value.id)}`, { cache: "no-store" });
        if (!response.ok) return;
        const session = await response.json() as { status: string; currentStage: TodayStage; completedQuestionIds: string[] };
        if (!active || session.status === "not-started") return;
        setPhase(session.status === "complete" ? "summary" : session.currentStage);
        if (session.currentStage === "context-quiz") setIndex(session.completedQuestionIds.length);
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "今日计划加载失败"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [initialPlan]);

  const focused = useMemo(() => {
    if (!plan) return [];
    return results.filter((result) => result.state !== "known")
      .slice(0, plan.focusedLearningTarget)
      .map((result) => plan.rapidScanEntries.find((entry) => entry.id === result.id))
      .filter((entry): entry is ProductionVocabularyEntry => Boolean(entry));
  }, [plan, results]);

  const emit = (event: TodayStageEvent) => {
    if (!plan) return;
    if (onEvent) {
      eventChain.current = eventChain.current.then(() => onEvent(event)).then(() => undefined);
      return;
    }
    const operationId = crypto.randomUUID();
    const payload = { ...event, operationId, planId: plan.id, occurredAt: new Date().toISOString() };
    eventChain.current = eventChain.current.then(async () => {
      const response = await fetch("/api/today/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error("Today event could not be saved.");
    }).catch(() => {
      queueSyncPayload("today-event", plan.id, payload);
    });
  };

  const move = (next: TodayStage) => {
    setPhase(next);
    setIndex(0);
    setRevealed(false);
    itemStartedAt.current = Date.now();
    if (next === "reading") emit({ type: "article_opened", stage: "reading" });
  };
  const nextAfter = (current: TodayStage): TodayStage => {
    if (!plan) return "summary";
    const position = plan.stages.indexOf(current);
    return plan.stages[position + 1] ?? "summary";
  };
  const finishStage = (current: TodayStage) => {
    emit({ type: "stage_completed", stage: current });
    move(nextAfter(current));
  };
  const start = () => {
    if (!plan) return;
    const first = plan.warmupReviewEntries.length ? "warmup" : "scan";
    emit({ type: "today_started", stage: first });
    move(first);
  };
  const rateWarmup = (correct: boolean) => {
    if (!plan) return;
    const entry = plan.warmupReviewEntries[index];
    if (!entry) return;
    recordWordAnswer(entry.id, correct ? "good" : "again", correct, new Date(), { mode: "warmup-recall" });
    if (index + 1 >= plan.warmupReviewEntries.length) finishStage("warmup");
    else { setIndex(index + 1); setRevealed(false); }
  };
  const classify = (state: RecognitionState) => {
    if (!plan) return;
    const entry = plan.rapidScanEntries[index];
    if (!entry) return;
    recordWordRecognition(entry.id, state, Date.now() - itemStartedAt.current, state === "known", plan.id);
    const next = [...results, { id: entry.id, state }];
    setResults(next);
    if (index + 1 >= plan.rapidScanEntries.length) finishStage("scan");
    else { setIndex(index + 1); setRevealed(false); itemStartedAt.current = Date.now(); }
  };
  const finishLearning = () => {
    const entry = focused[index];
    if (entry) markWordIntroduced(entry.id);
    if (index + 1 >= focused.length) finishStage("learn");
    else setIndex(index + 1);
  };
  const finishReading = () => {
    emit({ type: "article_completed", stage: "reading" });
    finishStage("reading");
  };
  const answerContext = (correct: boolean) => {
    if (!plan) return;
    const question = plan.contextQuestions[index];
    if (!question) return;
    if (correct) setQuizCorrect((value) => value + 1);
    emit({ type: "context_answered", stage: "context-quiz", questionId: question.id, correct });
    if (index + 1 >= plan.contextQuestions.length) setPhase("summary");
    else setIndex(index + 1);
  };

  if (loading) return <div className="page-shell flex min-h-[65vh] items-center justify-center gap-2 text-sm text-[var(--muted-foreground)]"><LoaderCircle className="size-4 animate-spin" />正在从 9000 词中编排今日候选词</div>;
  if (error || !plan) return <div className="page-shell py-20 text-center"><h1 className="text-2xl font-bold">今日计划暂时无法加载</h1><p className="mt-3 text-sm text-rose-700">{error}</p></div>;
  if (phase === "setup") return <TodaySetup plan={plan} onStart={start} />;
  if (phase === "summary") return <TodaySummary plan={plan} results={results} focused={focused} quizCorrect={quizCorrect} onRestart={() => { setResults([]); setQuizCorrect(0); setPhase("setup"); }} />;

  const phaseNumber = Math.max(0, plan.stages.indexOf(phase));
  return <div className="page-shell max-w-4xl py-7 sm:py-10">
    <div className="mb-5 flex items-center gap-4"><Progress value={phaseNumber / Math.max(1, plan.stages.length - 1) * 100} /><Badge variant="secondary">{phaseLabel(phase)}</Badge></div>
    {phase === "warmup" && <RecallCard entry={plan.warmupReviewEntries[index]} index={index} total={plan.warmupReviewEntries.length} revealed={revealed} onReveal={() => setRevealed(true)} onRate={rateWarmup} />}
    {phase === "scan" && <ScanCard entry={plan.rapidScanEntries[index]} index={index} total={plan.rapidScanEntries.length} revealed={revealed} onReveal={() => setRevealed(true)} onClassify={classify} />}
    {phase === "learn" && (focused.length ? <LearnCard entry={focused[index]} onContinue={finishLearning} /> : <EmptyStage title="这批候选词你都认识" detail="不额外塞入新词，继续完成今天的计划。" onContinue={() => finishStage("learn")} />)}
    {phase === "reading" && plan.article && <ArticleReadingStage article={plan.article} onComplete={finishReading} />}
    {phase === "context-quiz" && <ArticleContextQuiz question={plan.contextQuestions[index]} index={index} total={plan.contextQuestions.length} onAnswer={answerContext} />}
  </div>;
}

function RecallCard({ entry, index, total, revealed, onReveal, onRate }: { entry?: ProductionVocabularyEntry; index: number; total: number; revealed: boolean; onReveal: () => void; onRate: (correct: boolean) => void }) {
  if (!entry) return null;
  return <StageCard eyebrow={`热身复习 ${index + 1} / ${total}`} icon={RotateCcw}><h1 className="text-5xl font-bold">{entry.word}</h1><p className="mt-3 text-[var(--muted-foreground)]">先在心里回想含义</p>{revealed ? <div className="mt-7 rounded-2xl bg-[var(--primary-soft)] p-6"><p className="text-2xl font-bold text-[var(--primary)]">{entry.coreMeaningZh}</p><p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{entry.example}</p></div> : <Button variant="outline" className="mt-7" onClick={onReveal}><Eye className="size-4" />显示答案</Button>}<div className="mt-7 grid grid-cols-2 gap-3"><Button variant="outline" size="lg" onClick={() => onRate(false)}>没想起来</Button><Button size="lg" onClick={() => onRate(true)}><Check className="size-4" />想起来了</Button></div></StageCard>;
}

function ScanCard({ entry, index, total, revealed, onReveal, onClassify }: { entry?: ProductionVocabularyEntry; index: number; total: number; revealed: boolean; onReveal: () => void; onClassify: (state: RecognitionState) => void }) {
  if (!entry) return null;
  return <StageCard eyebrow={`快速扫词 ${index + 1} / ${total}`} icon={Gauge}><h1 className="text-6xl font-bold tracking-[-0.05em]">{entry.word}</h1><p className="mt-3 text-[var(--muted-foreground)]">{entry.phonetic || entry.partOfSpeech.join(" · ")}</p>{revealed ? <div className="mt-7 rounded-2xl bg-[var(--primary-soft)] p-6"><p className="text-2xl font-bold text-[var(--primary)]">{entry.coreMeaningZh}</p></div> : <Button variant="outline" className="mt-7" onClick={onReveal}><Eye className="size-4" />显示释义</Button>}<div className="mt-8 grid gap-3 sm:grid-cols-3"><ClassifyButton state="known" label="认识" onClick={onClassify} /><ClassifyButton state="fuzzy" label="模糊" onClick={onClassify} /><ClassifyButton state="unknown" label="不会" onClick={onClassify} /></div></StageCard>;
}

function LearnCard({ entry, onContinue }: { entry?: ProductionVocabularyEntry; onContinue: () => void }) {
  if (!entry) return null;
  return <StageCard eyebrow="重点学习" icon={Brain}><h1 className="text-5xl font-bold">{entry.word}</h1><p className="mt-2 text-sm text-[var(--muted-foreground)]">{entry.phonetic} · {entry.partOfSpeech.join(" / ")}</p><div className="mt-7 rounded-2xl bg-[var(--primary-soft)] p-6"><p className="text-2xl font-bold text-[var(--primary)]">{entry.coreMeaningZh}</p><p className="mt-3 leading-7 text-[var(--muted-foreground)]">{entry.coreDefinitionEn}</p></div><p className="mt-6 rounded-xl border p-5 text-left leading-7">{entry.example}</p><Button size="lg" className="mt-7" onClick={onContinue}>继续 <ArrowRight className="size-4" /></Button></StageCard>;
}

function TodaySummary({ plan, results, focused, quizCorrect, onRestart }: { plan: TodayPlanDTO; results: Result[]; focused: ProductionVocabularyEntry[]; quizCorrect: number; onRestart: () => void }) {
  const recognized = results.filter((result) => result.state === "known").length;
  return <div className="page-shell max-w-4xl py-10 sm:py-14"><Card className="border-indigo-200 shadow-xl shadow-indigo-950/5"><CardContent className="p-7 text-center sm:p-10"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><Trophy className="size-7" /></span><p className="label-caps mt-5 text-xs font-bold text-[var(--primary)]">Today complete</p><h1 className="mt-2 text-3xl font-bold">今天的最佳学习组合已完成。</h1><div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4"><SummaryMetric label="复习完成" value={plan.warmupReviewEntries.length} /><SummaryMetric label="已认识" value={recognized} /><SummaryMetric label="重点学习" value={focused.length} /><SummaryMetric label="语境题正确" value={`${quizCorrect}/${plan.contextQuestions.length}`} /></div><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild size="lg"><Link href="/progress">查看词汇增长 <ArrowRight className="size-4" /></Link></Button><Button variant="outline" size="lg" onClick={onRestart}><RotateCcw className="size-4" />重新查看计划</Button></div></CardContent></Card></div>;
}

function StageCard({ eyebrow, icon: Icon, children }: { eyebrow: string; icon: typeof Gauge; children: React.ReactNode }) { return <Card className="min-h-[560px] border-indigo-200 shadow-xl shadow-indigo-950/5"><CardContent className="flex min-h-[560px] flex-col justify-center p-7 text-center sm:p-10"><div className="mb-7 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--primary)]"><Icon className="size-4" />{eyebrow}</div>{children}</CardContent></Card>; }
function ClassifyButton({ state, label, onClick }: { state: RecognitionState; label: string; onClick: (state: RecognitionState) => void }) { const colors = { known: "border-emerald-200 bg-emerald-50 text-emerald-800", fuzzy: "border-amber-200 bg-amber-50 text-amber-800", unknown: "border-rose-200 bg-rose-50 text-rose-800" }; return <button type="button" onClick={() => onClick(state)} className={cn("h-16 rounded-2xl border text-lg font-bold transition hover:brightness-95", colors[state])}>{label}</button>; }
function SummaryMetric({ label, value }: { label: string; value: string | number }) { return <div className="rounded-xl bg-[var(--background)] p-4"><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{label}</p></div>; }
function EmptyStage({ title, detail, onContinue }: { title: string; detail: string; onContinue: () => void }) { return <StageCard eyebrow="Adaptive skip" icon={Check}><h2 className="text-3xl font-bold">{title}</h2><p className="mt-3 text-[var(--muted-foreground)]">{detail}</p><Button className="mx-auto mt-7" onClick={onContinue}>继续</Button></StageCard>; }
function phaseLabel(phase: TodayStage): string { return { warmup: "热身复习", scan: "快速扫词", learn: "重点学习", reading: "文章阅读", "context-quiz": "语境题", summary: "总结" }[phase]; }
