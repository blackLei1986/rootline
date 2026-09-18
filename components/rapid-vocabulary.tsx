"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Brain, Check, Clock3, Eye, Gauge, RotateCcw, Sparkles, Trophy, X } from "lucide-react";
import { getPhrasesByWord, getSentencesByWord } from "@/data/learning-content";
import { getWordById } from "@/data/words";
import { completeLearningSession, markWordIntroduced, recordWordAnswer } from "@/lib/learning-actions";
import { generateQuiz } from "@/lib/quiz-generator";
import { advanceRapidContext, advanceRapidLearning, classifyRapidWord, clearRapidSession, createRapidSession, finishRapidSessionEarly, loadRapidSession, recordRapidQuizAnswer, saveRapidSession } from "@/lib/rapid-session";
import { recordVerificationResult, recordWordRecognition } from "@/lib/recognition-progress";
import { appendLearningEvent, loadProgress } from "@/lib/storage";
import type { RecognitionState, ReviewRating } from "@/types/progress";
import type { RapidLearningItem, RapidSession, RapidSessionSize } from "@/types/rapid-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { QuizCard } from "@/components/quiz-card";
import { cn } from "@/lib/utils";

const sizeOptions: Array<{ value: RapidSessionSize; label: string; detail: string }> = [
  { value: 20, label: "轻量", detail: "约 2 分钟扫描" },
  { value: 50, label: "标准", detail: "平衡速度与覆盖" },
  { value: 100, label: "冲刺", detail: "集中发现知识缺口" }
];
const timeOptions = [10, 20, 30] as const;

export function RapidVocabulary() {
  const [session, setSession] = useState<RapidSession | null>(null);
  const [size, setSize] = useState<RapidSessionSize>(50);
  const [minutes, setMinutes] = useState<10 | 20 | 30>(20);
  const [revealed, setRevealed] = useState(false);
  const cardStartedAt = useRef(0);

  useEffect(() => {
    const restored = loadRapidSession();
    cardStartedAt.current = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (restored) setSession(restored);
    setMinutes(loadProgress().settings.learningGoal.sessionMinutes);
  }, []);

  const persist = (next: RapidSession) => {
    saveRapidSession(next);
    setSession(next);
  };

  const start = () => {
    const next = createRapidSession(loadProgress(), size, minutes);
    clearRapidSession();
    saveRapidSession(next);
    cardStartedAt.current = Date.now();
    setRevealed(false);
    setSession(next);
  };

  const classify = useCallback((state: RecognitionState) => {
    if (!session || session.phase !== "scan") return;
    const wordId = session.wordIds[session.scanIndex];
    if (!wordId) return;
    const responseTimeMs = Date.now() - cardStartedAt.current;
    const next = classifyRapidWord(session, loadProgress(), state, responseTimeMs, revealed);
    const result = next.recognitionResults[wordId];
    if (!result) return;
    recordWordRecognition(wordId, state, responseTimeMs, result.verificationScheduled, session.id);
    persist(next);
    setRevealed(false);
    cardStartedAt.current = Date.now();
  }, [revealed, session]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!session || session.phase !== "scan") return;
      if (event.key === " ") {
        event.preventDefault();
        setRevealed(true);
      }
      if (event.key === "1") classify("known");
      if (event.key === "2") classify("fuzzy");
      if (event.key === "3") classify("unknown");
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [classify, session]);

  const finishEarly = () => {
    if (!session) return;
    const next = finishRapidSessionEarly(session);
    completeLearningSession(session.startedAt, new Date(), session.id);
    persist(next);
  };

  if (!session) return <RapidSetup size={size} minutes={minutes} onSize={setSize} onMinutes={setMinutes} onStart={start} />;
  if (session.phase === "summary") return <RapidSummary session={session} onRestart={() => { clearRapidSession(); setSession(null); }} />;

  const phaseProgress = session.phase === "scan"
    ? session.scanIndex / Math.max(1, session.wordIds.length)
    : session.phase === "learn"
      ? session.learningIndex / Math.max(1, session.learningQueue.length)
      : session.phase === "context"
        ? session.contextIndex / Math.max(1, session.learningQueue.length)
        : session.quizIndex / Math.max(1, session.quizWordIds.length);

  return (
    <div className="page-shell max-w-4xl py-7 sm:py-10">
      <div className="mb-5 flex items-center gap-4">
        <div className="flex-1"><Progress value={phaseProgress * 100} /></div>
        <Badge variant="secondary">{phaseLabel(session.phase)}</Badge>
        <Button variant="ghost" size="sm" onClick={finishEarly}><X className="size-4" />先到这里</Button>
      </div>
      {session.phase === "scan" && <RapidScanCard session={session} revealed={revealed} onReveal={() => setRevealed(true)} onClassify={classify} />}
      {session.phase === "learn" && <RapidLearningCard item={session.learningQueue[session.learningIndex]} onContinue={() => { const item = session.learningQueue[session.learningIndex]; if (item) markWordIntroduced(item.wordId); persist(advanceRapidLearning(session)); }} />}
      {session.phase === "context" && <RapidContextCard item={session.learningQueue[session.contextIndex]} onContinue={() => { const item = session.learningQueue[session.contextIndex]; if (item) appendLearningEvent({ id: `${Date.now()}-${item.wordId}-sentence`, type: "sentence_understood", timestamp: new Date().toISOString(), wordId: item.wordId, sessionId: session.id }); persist(advanceRapidContext(session)); }} />}
      {session.phase === "quiz" && <RapidQuiz key={`${session.id}-${session.quizIndex}`} session={session} onRated={(correct, rating) => {
        const wordId = session.quizWordIds[session.quizIndex];
        if (!wordId) return;
        const verification = session.verificationWordIds.includes(wordId);
        if (verification) { recordVerificationResult(wordId, correct, session.id); if (!correct) markWordIntroduced(wordId); }
        else recordWordAnswer(wordId, rating, correct);
        const next = recordRapidQuizAnswer(session, correct, rating);
        if (next.phase === "summary") completeLearningSession(session.startedAt, new Date(), session.id);
        persist(next);
      }} />}
    </div>
  );
}

function RapidSetup({ size, minutes, onSize, onMinutes, onStart }: { size: RapidSessionSize; minutes: 10 | 20 | 30; onSize: (size: RapidSessionSize) => void; onMinutes: (minutes: 10 | 20 | 30) => void; onStart: () => void; }) {
  return <div className="page-shell max-w-4xl py-10 sm:py-14"><div className="text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]"><Gauge className="size-6" /></span><p className="label-caps mt-5 text-xs font-bold text-[var(--primary)]">Rapid scan</p><h1 className="mt-2 text-4xl font-bold tracking-[-0.045em]">先筛选，再重点学。</h1><p className="mx-auto mt-3 max-w-xl leading-7 text-[var(--muted-foreground)]">快速跳过已经会的词，把时间留给模糊词和真正不会的高价值词。</p></div><Card className="mt-9 border-indigo-200 shadow-xl shadow-indigo-950/5"><CardContent className="p-6 sm:p-8"><p className="text-sm font-bold">这次扫描多少词？</p><div className="mt-4 grid gap-3 sm:grid-cols-3">{sizeOptions.map((option) => <button type="button" key={option.value} onClick={() => onSize(option.value)} className={cn("rounded-2xl border p-5 text-left transition", size === option.value ? "border-[var(--primary)] bg-[var(--primary-soft)] ring-2 ring-indigo-100" : "hover:border-indigo-200")}><span className="text-2xl font-bold">{option.value}</span><span className="ml-2 font-semibold">{option.label}</span><p className="mt-2 text-xs text-[var(--muted-foreground)]">{option.detail}</p></button>)}</div><p className="mt-7 text-sm font-bold">今天有多少时间？</p><div className="mt-3 flex gap-2">{timeOptions.map((value) => <Button key={value} variant={minutes === value ? "default" : "outline"} onClick={() => onMinutes(value)}>{value} 分钟</Button>)}</div><Button size="lg" className="mt-8 w-full" onClick={onStart}>开始快速识别 <ArrowRight className="size-4" /></Button></CardContent></Card></div>;
}

function RapidScanCard({ session, revealed, onReveal, onClassify }: { session: RapidSession; revealed: boolean; onReveal: () => void; onClassify: (state: RecognitionState) => void; }) {
  const word = getWordById(session.wordIds[session.scanIndex]);
  if (!word) return null;
  const phrase = getPhrasesByWord(word.id)[0];
  return <Card className="min-h-[540px] overflow-hidden border-indigo-200 shadow-xl shadow-indigo-950/5"><CardContent className="flex min-h-[540px] flex-col p-6 sm:p-10"><div className="flex items-center justify-between text-sm text-[var(--muted-foreground)]"><span>快速判断 · 不要求精确释义</span><span className="font-semibold">{session.scanIndex + 1} / {session.wordIds.length}</span></div><div className="flex flex-1 flex-col items-center justify-center text-center"><h1 className="text-5xl font-bold tracking-[-0.05em] sm:text-7xl">{word.word}</h1><p className="mt-3 text-lg text-[var(--muted-foreground)]">{word.phonetic || "音标待补充"}</p><p className="mt-2 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">{word.partOfSpeech.join(" · ")}</p>{revealed ? <div className="mt-8 w-full max-w-lg rounded-2xl bg-[var(--primary-soft)] p-6"><p className="text-2xl font-bold text-[var(--primary)]">{word.meaningZh[0]}</p><p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{word.meaningEn?.[0]}</p>{phrase && <p className="mt-4 border-t border-indigo-200 pt-4 font-semibold">{phrase.text}</p>}</div> : <Button variant="outline" className="mt-8" onClick={onReveal}><Eye className="size-4" />显示答案 <kbd className="ml-1 text-xs opacity-50">Space</kbd></Button>}</div><div className="grid gap-3 sm:grid-cols-3"><RecognitionButton label="认识" shortcut="1" tone="known" onClick={() => onClassify("known")} /><RecognitionButton label="模糊" shortcut="2" tone="fuzzy" onClick={() => onClassify("fuzzy")} /><RecognitionButton label="不会" shortcut="3" tone="unknown" onClick={() => onClassify("unknown")} /></div></CardContent></Card>;
}

function RecognitionButton({ label, shortcut, tone, onClick }: { label: string; shortcut: string; tone: RecognitionState; onClick: () => void }) {
  const colors = { known: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100", fuzzy: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100", unknown: "border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100" };
  return <button type="button" onClick={onClick} className={cn("flex h-16 items-center justify-center gap-3 rounded-2xl border text-lg font-bold transition", colors[tone])}>{label}<kbd className="rounded-md bg-white/70 px-2 py-1 text-xs">{shortcut}</kbd></button>;
}

function RapidLearningCard({ item, onContinue }: { item?: RapidLearningItem; onContinue: () => void }) {
  const word = item ? getWordById(item.wordId) : undefined;
  if (!item || !word) return null;
  const phrases = getPhrasesByWord(word.id);
  const sentences = getSentencesByWord(word.id);
  return <Card className="min-h-[560px] border-indigo-200 shadow-xl shadow-indigo-950/5"><CardContent className="flex min-h-[560px] flex-col justify-center p-7 sm:p-10"><div className="flex flex-wrap items-center justify-between gap-2"><Badge variant={item.depth === "deep" ? "warning" : "secondary"}>{item.depth === "deep" ? "深入学习" : item.depth === "standard" ? "重点理解" : "快速补充"}</Badge><span className="text-xs text-[var(--muted-foreground)]">原因：{item.reasons.map(reasonLabel).join(" + ")}</span></div><div className="mt-7"><h1 className="text-5xl font-bold tracking-[-0.05em]">{word.word}</h1><p className="mt-2 text-[var(--muted-foreground)]">{word.phonetic} · {word.partOfSpeech.join(" / ")}</p><p className="mt-5 text-2xl font-bold text-[var(--primary)]">{word.meaningZh[0]}</p><p className="mt-2 leading-7 text-[var(--muted-foreground)]">{word.meaningEn?.[0]}</p></div><div className="mt-7 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-[var(--primary-soft)] p-5"><p className="text-xs font-bold text-[var(--primary)]">构词</p><p className="mt-2 font-mono text-sm">{word.morphology}</p><p className="mt-2 text-sm text-[var(--muted-foreground)]">{word.literalMeaning}</p></div><div className="rounded-2xl bg-[var(--background)] p-5"><p className="text-xs font-bold text-[var(--muted-foreground)]">常用搭配</p><p className="mt-2 font-semibold leading-7">{phrases.slice(0, item.depth === "deep" ? 3 : 1).map((phrase) => phrase.text).join(" · ") || word.collocations.slice(0, 2).join(" · ")}</p></div></div>{item.depth === "deep" && <div className="mt-4 rounded-2xl border p-5"><p className="text-xs font-bold text-[var(--muted-foreground)]">记忆钩子与词族</p><p className="mt-2 text-sm leading-6">{word.memoryHook || word.semanticEvolution.join(" → ")}</p><p className="mt-3 text-sm font-semibold">{word.family.slice(0, 5).join(" · ")}</p>{sentences[0] && <p className="mt-4 border-t pt-4 text-sm leading-6">{sentences[0].text}</p>}</div>}<Button size="lg" className="mt-7" onClick={onContinue}>继续 <ArrowRight className="size-4" /></Button></CardContent></Card>;
}

function RapidContextCard({ item, onContinue }: { item?: RapidLearningItem; onContinue: () => void }) {
  const word = item ? getWordById(item.wordId) : undefined;
  if (!item || !word) return null;
  const phrase = getPhrasesByWord(word.id)[0];
  const sentence = getSentencesByWord(word.id)[0];
  return <Card className="min-h-[520px] border-indigo-200 shadow-xl shadow-indigo-950/5"><CardContent className="flex min-h-[520px] flex-col justify-center p-7 sm:p-10"><div className="text-center"><Badge><Sparkles className="mr-1 size-3.5" />语境强化</Badge><p className="mt-5 text-sm font-semibold text-[var(--muted-foreground)]">WORD → PHRASE → SENTENCE</p><h1 className="mt-3 text-4xl font-bold">{word.word}</h1></div><div className="mx-auto mt-8 w-full max-w-2xl space-y-4"><div className="rounded-2xl bg-[var(--primary-soft)] p-6"><p className="text-xs font-bold text-[var(--primary)]">常用搭配</p><p className="mt-2 text-2xl font-bold">{phrase?.text ?? word.collocations[0] ?? word.word}</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">{phrase?.meaningZh ?? word.meaningZh[0]}</p></div><div className="rounded-2xl border p-6"><p className="text-xs font-bold text-[var(--muted-foreground)]">一句最有价值的例句</p><p className="mt-3 text-lg font-semibold leading-8">{sentence?.text ?? word.examples[0]?.en ?? `This example uses ${word.word} in context.`}</p><p className="mt-2 text-sm text-[var(--muted-foreground)]">{sentence?.translationZh ?? word.examples[0]?.zh}</p></div></div><Button size="lg" className="mx-auto mt-7" onClick={onContinue}><Check className="size-4" />理解了</Button></CardContent></Card>;
}

function RapidQuiz({ session, onRated }: { session: RapidSession; onRated: (correct: boolean, rating: ReviewRating) => void }) {
  const wordId = session.quizWordIds[session.quizIndex];
  const word = getWordById(wordId);
  const question = useMemo(() => word ? generateQuiz({ word, mode: "word-to-meaning" }) : null, [word]);
  if (!question) return null;
  return <Card className="min-h-[560px] border-indigo-200 shadow-xl shadow-indigo-950/5"><CardContent className="flex min-h-[560px] flex-col justify-center p-7 sm:p-10">{session.verificationWordIds.includes(wordId) && <div className="mb-5 text-center"><Badge variant="warning">随机验证 · 不是重复学习</Badge></div>}<QuizCard question={question} onRated={onRated} /></CardContent></Card>;
}

function RapidSummary({ session, onRestart }: { session: RapidSession; onRestart: () => void }) {
  const results = Object.values(session.recognitionResults);
  const known = results.filter((result) => result.state === "known").length;
  const fuzzy = results.filter((result) => result.state === "fuzzy").length;
  const unknown = results.filter((result) => result.state === "unknown").length;
  const correct = session.quizAnswers.filter((answer) => answer.correct).length;
  const accuracy = session.quizAnswers.length ? Math.round(correct / session.quizAnswers.length * 100) : 0;
  const elapsed = Math.max(1, Math.round((new Date(session.completedAt ?? session.updatedAt).getTime() - new Date(session.startedAt).getTime()) / 60000));
  return <div className="page-shell max-w-4xl py-10 sm:py-14"><Card className="overflow-hidden border-indigo-200 shadow-xl shadow-indigo-950/5"><CardContent className="p-7 sm:p-10"><div className="text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><Trophy className="size-7" /></span><p className="label-caps mt-5 text-xs font-bold text-[var(--primary)]">Rapid session complete</p><h1 className="mt-2 text-3xl font-bold tracking-tight">把时间花在真正需要的词上。</h1><p className="mt-2 text-sm text-[var(--muted-foreground)]">已知词不会全部进入复习；模糊词和陌生词已按价值分流。</p></div><div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-5"><SummaryMetric icon={Gauge} label="扫描" value={results.length} /><SummaryMetric icon={Check} label="认识" value={known} /><SummaryMetric icon={Eye} label="模糊" value={fuzzy} /><SummaryMetric icon={Brain} label="不会" value={unknown} /><SummaryMetric icon={Clock3} label="用时" value={`${elapsed} 分钟`} /></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl bg-[var(--primary-soft)] p-5"><p className="text-sm font-semibold">重点学习</p><p className="mt-2 text-3xl font-bold text-[var(--primary)]">{session.learningQueue.length}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">模糊与陌生词经过搭配、句子强化</p></div><div className="rounded-2xl bg-[var(--background)] p-5"><p className="text-sm font-semibold">Mini Quiz</p><p className="mt-2 text-3xl font-bold">{session.quizAnswers.length ? `${accuracy}%` : "—"}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{session.quizAnswers.length} 道题 · {session.verificationWordIds.length} 个已知词抽查</p></div></div><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Button asChild size="lg"><Link href="/">返回首页</Link></Button><Button variant="outline" size="lg" onClick={onRestart}><RotateCcw className="size-4" />再来一轮</Button>{session.learningQueue[0] && <Button asChild variant="ghost" size="lg"><Link href={`/words/${session.learningQueue[0].wordId}`}>查看重点词 <ArrowRight className="size-4" /></Link></Button>}</div></CardContent></Card></div>;
}

function SummaryMetric({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string | number }) { return <div className="rounded-xl border p-4"><Icon className="size-4 text-[var(--primary)]" /><p className="mt-3 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{label}</p></div>; }
function phaseLabel(phase: RapidSession["phase"]): string { return { scan: "快速识别", learn: "重点学习", context: "语境强化", quiz: "Mini Quiz", summary: "总结" }[phase]; }
function reasonLabel(reason: RapidLearningItem["reasons"][number]): string { return { "known-verified": "已验证", "known-needs-verification": "待验证", "fuzzy-high-yield": "似懂非懂", "unknown-low-value": "陌生但低频", "unknown-high-value": "高价值陌生词", "exam-relevant": "考试相关", "repeated-errors": "多次答错", "weak-memory": "记忆较弱" }[reason]; }
