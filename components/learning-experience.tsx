"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpenCheck, Brain, Clock3, RotateCcw, Trophy } from "lucide-react";
import { getRootById } from "@/data/roots";
import { getWordById } from "@/data/words";
import { getPhrasesByWord, getSentencesByWord } from "@/data/learning-content";
import { completeLearningSession, markRootStarted, markWordIntroduced, recordRootRating, recordWordAnswer } from "@/lib/learning-actions";
import { generateQuiz } from "@/lib/quiz-generator";
import { insertReinforcementItem } from "@/lib/reinforcement";
import { buildOrchestratedSession } from "@/lib/session-orchestrator";
import { appendLearningEvent, clearActiveSession, loadActiveSession, loadProgress, saveActiveSession } from "@/lib/storage";
import type { ReviewRating } from "@/types/progress";
import type { LearningSession, SessionAnswer } from "@/types/session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { QuizCard } from "@/components/quiz-card";
import { WordBreakdown } from "@/components/word-breakdown";

export function LearningExperience() {
  const [session, setSession] = useState<LearningSession | null>(null);

  useEffect(() => {
    const restored = loadActiveSession();
    const next = restored && !restored.completedAt
      ? restored
      : buildOrchestratedSession({ storage: loadProgress() });
    saveActiveSession(next);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSession(next);
  }, []);

  const item = session?.items[session.currentIndex];
  const root = item?.rootId ? getRootById(item.rootId) : undefined;
  const word = item?.wordId ? getWordById(item.wordId) : undefined;
  const question = useMemo(() => {
    if (!item?.mode || (!root && !word)) return null;
    return generateQuiz({ word, root, mode: item.mode });
  }, [item, root, word]);

  if (!session) {
    return <div className="grid min-h-[70vh] place-items-center"><p className="text-sm text-[var(--muted-foreground)]">正在准备今日学习…</p></div>;
  }

  const finishSession = (next: LearningSession) => {
    const now = new Date();
    completeLearningSession(next.startedAt, now, next.id);
    clearActiveSession();
    setSession({ ...next, completedAt: now.toISOString() });
  };

  const advance = (base: LearningSession = session) => {
    const next = { ...base, currentIndex: base.currentIndex + 1 };
    if (next.currentIndex >= next.items.length) {
      finishSession(next);
      return;
    }
    saveActiveSession(next);
    setSession(next);
  };

  const handleIntro = () => {
    if (item?.rootId && item.stage === "root-intro") markRootStarted(item.rootId);
    if (item?.wordId && item.stage === "word-intro") markWordIntroduced(item.wordId);
    if (item?.wordId && item.stage === "sentence-reinforcement") {
      appendLearningEvent({ id: `${Date.now()}-${item.wordId}-sentence`, type: "sentence_understood", timestamp: new Date().toISOString(), wordId: item.wordId, sessionId: session.id });
    }
    advance();
  };

  const handleRated = (correct: boolean, rating: ReviewRating) => {
    if (!item) return;
    if (item.wordId) recordWordAnswer(item.wordId, rating, correct);
    if (item.rootId && !item.wordId) recordRootRating(item.rootId, rating, correct);
    const answer: SessionAnswer = {
      itemId: item.id,
      wordId: item.wordId,
      rootId: item.rootId,
      correct,
      rating,
      answeredAt: new Date().toISOString()
    };
    let next = { ...session, answers: [...session.answers, answer] };
    if (!correct && item.wordId) next = insertReinforcementItem(next, item);
    advance(next);
  };

  if (session.completedAt || !item) {
    return <SessionSummary session={session} onRestart={() => {
      const next = buildOrchestratedSession({ storage: loadProgress() });
      saveActiveSession(next);
      setSession(next);
    }} />;
  }

  const progressValue = Math.round((session.currentIndex / Math.max(1, session.items.length)) * 100);
  return (
    <div className="page-shell max-w-4xl py-7 sm:py-10">
      <div className="mb-7 flex items-center gap-4">
        <div className="flex-1"><Progress value={progressValue} /></div>
        <span className="text-sm font-semibold text-[var(--muted-foreground)]">{session.currentIndex + 1} / {session.items.length}</span>
      </div>
      <Card className="min-h-[560px] shadow-xl shadow-indigo-950/5">
        <CardContent className="flex min-h-[560px] flex-col justify-center p-6 sm:p-10">
          {item.stage === "root-intro" && root && (
            <div className="mx-auto max-w-2xl text-center">
              <Badge>今日词根</Badge>
              <h1 className="mt-7 text-7xl font-bold tracking-[-0.06em] sm:text-8xl">{root.root}</h1>
              <p className="mt-5 text-2xl font-semibold text-[var(--primary)]">{root.meaningEn.join(" / ")}</p>
              <p className="mt-2 text-lg text-[var(--muted-foreground)]">{root.meaningZh.join(" · ")}</p>
              <div className="mt-8 rounded-2xl bg-[var(--primary-soft)] p-5 text-left text-sm leading-7 text-[var(--muted-foreground)]">{root.mnemonic}</div>
              <Button size="lg" className="mt-8" onClick={handleIntro}>继续 <ArrowRight className="size-4" /></Button>
            </div>
          )}
          {item.stage === "word-intro" && word && (
            <div>
              <div className="text-center"><Badge variant="secondary">新词</Badge><h1 className="mt-5 text-5xl font-bold tracking-[-0.05em]">{word.word}</h1><p className="mt-2 text-[var(--muted-foreground)]">{word.phonetic} · {word.partOfSpeech.join(" / ")}</p></div>
              <div className="mx-auto mt-8 max-w-2xl"><WordBreakdown word={word} />{(word.examples[0] || word.collocations.length > 0) && <details className="mt-5 rounded-xl border p-4"><summary className="cursor-pointer text-sm font-semibold">词族与更多用法</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">{word.examples[0] && <div><p className="text-xs font-bold text-[var(--muted-foreground)]">典型例句</p><p className="mt-2 text-sm font-medium leading-6">{word.examples[0].en}</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">{word.examples[0].zh}</p></div>}{word.collocations.length > 0 && <div><p className="text-xs font-bold text-[var(--muted-foreground)]">高频搭配</p><p className="mt-2 text-sm leading-7">{word.collocations.slice(0, 3).join(" · ")}</p></div>}</div></details>}</div>
              <div className="text-center"><Button size="lg" className="mt-7" onClick={handleIntro}>我理解了 <ArrowRight className="size-4" /></Button></div>
            </div>
          )}
          {item.stage === "phrase-reinforcement" && word && (
            <ContextLearningCard kind="phrase" wordId={word.id} onContinue={handleIntro} />
          )}
          {item.stage === "sentence-reinforcement" && word && (
            <ContextLearningCard kind="sentence" wordId={word.id} onContinue={handleIntro} />
          )}
          {(item.stage === "root-recall" || item.stage === "word-recall" || item.stage === "review-recall" || item.stage === "mixed-quiz") && question && (
            <QuizCard key={item.id} question={question} onRated={handleRated} />
          )}
        </CardContent>
      </Card>
      <p className="mt-4 text-center text-xs text-[var(--muted-foreground)]">Space 显示答案 · Enter 提交 · 1–4 评分</p>
    </div>
  );
}

function ContextLearningCard({ kind, wordId, onContinue }: { kind: "phrase" | "sentence"; wordId: string; onContinue: () => void }) {
  const word = getWordById(wordId);
  if (!word) return null;
  const phrase = getPhrasesByWord(wordId)[0];
  const sentence = getSentencesByWord(wordId)[0];
  return <div className="mx-auto w-full max-w-2xl text-center"><Badge variant="secondary">{kind === "phrase" ? "Phrase reinforcement" : "Sentence reinforcement"}</Badge><p className="mt-5 text-sm font-semibold text-[var(--muted-foreground)]">{word.word} · {word.meaningZh[0]}</p>{kind === "phrase" ? <div className="mt-7 rounded-2xl bg-[var(--primary-soft)] p-8"><p className="text-3xl font-bold text-[var(--primary)]">{phrase?.text ?? word.collocations[0]}</p><p className="mt-3 text-sm text-[var(--muted-foreground)]">{phrase?.meaningZh}</p></div> : <div className="mt-7 rounded-2xl border p-8 text-left"><p className="text-xl font-semibold leading-9">{sentence?.text ?? word.examples[0]?.en}</p><p className="mt-3 text-sm text-[var(--muted-foreground)]">{sentence?.translationZh ?? word.examples[0]?.zh}</p></div>}<Button size="lg" className="mt-7" onClick={onContinue}>继续 <ArrowRight className="size-4" /></Button></div>;
}

function SessionSummary({ session, onRestart }: { session: LearningSession; onRestart: () => void }) {
  const answers = session.answers.filter((answer) => answer.wordId);
  const correct = answers.filter((answer) => answer.correct).length;
  const wrong = answers.length - correct;
  const accuracy = answers.length ? Math.round((correct / answers.length) * 100) : 0;
  const hardWords = [...new Set(answers.filter((answer) => !answer.correct || answer.rating === "again" || answer.rating === "hard").map((answer) => answer.wordId).filter(Boolean))] as string[];
  const started = new Date(session.startedAt).getTime();
  const ended = new Date(session.completedAt ?? session.startedAt).getTime();
  const minutes = Math.max(1, Math.round((ended - started) / 60_000));
  const storage = loadProgress();
  const rootId = session.rootIds[0];
  const before = session.rootMasteryBefore[rootId] ?? 0;
  const after = storage.roots[rootId]?.mastery ?? before;
  const nextReviews = session.newWordIds
    .map((wordId) => storage.words[wordId]?.nextReviewAt)
    .filter(Boolean)
    .sort();
  return (
    <div className="page-shell max-w-4xl py-10 sm:py-14">
      <Card className="overflow-hidden border-indigo-200 shadow-xl shadow-indigo-950/5">
        <CardContent className="p-7 sm:p-10">
          <div className="text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><Trophy className="size-7" /></span><p className="label-caps mt-5 text-xs font-bold text-[var(--primary)]">Session complete</p><h1 className="mt-2 text-3xl font-bold tracking-tight">今天的记忆已经开始生长。</h1></div>
          <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-5"><SummaryMetric icon={Clock3} label="学习时长" value={`${minutes} 分钟`} /><SummaryMetric icon={BookOpenCheck} label="新词" value={session.newWordIds.length} /><SummaryMetric icon={RotateCcw} label="复习词" value={session.reviewWordIds.length} /><SummaryMetric icon={Brain} label="回答" value={answers.length} /><SummaryMetric icon={Trophy} label="正确率" value={`${accuracy}%`} /></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border bg-[var(--background)] p-5"><p className="text-sm font-semibold">词根 {rootId}</p><p className="mt-2 text-2xl font-bold text-[var(--primary)]">{before}% → {after}%</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">掌握度综合记忆强度与学习覆盖率</p></div><div className="rounded-2xl border bg-[var(--background)] p-5"><p className="text-sm font-semibold">需要重点复习</p><p className="mt-2 text-sm leading-7 text-[var(--muted-foreground)]">{hardWords.length ? hardWords.join(" · ") : "这一轮没有明显困难词"}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{wrong} 次错误</p></div></div>
          {nextReviews[0] && <p className="mt-5 text-center text-sm text-[var(--muted-foreground)]">最近一次复习：{new Date(nextReviews[0]).toLocaleString("zh-CN")}</p>}
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild size="lg"><Link href="/">返回首页</Link></Button><Button variant="outline" size="lg" onClick={onRestart}>继续学习</Button>{hardWords[0] && <Button asChild variant="ghost" size="lg"><Link href={`/words/${hardWords[0]}`}>查看困难词</Link></Button>}</div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryMetric({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string | number }) {
  return <div className="rounded-xl border p-4"><Icon className="size-4 text-[var(--primary)]" /><p className="mt-3 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{label}</p></div>;
}
