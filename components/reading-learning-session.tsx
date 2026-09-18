"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Eye, RotateCcw, Sparkles, X } from "lucide-react";
import { getWordById } from "@/data/words";
import { analyzeReadingDocument } from "@/lib/reading/analyze";
import { markWordIntroduced, recordWordAnswer } from "@/lib/learning-actions";
import { readingStorage } from "@/lib/reading-storage";
import { recordVerificationResult, recordWordRecognition } from "@/lib/recognition-progress";
import { loadProgress } from "@/lib/storage";
import type { ReadingDocument, ReadingLearningItem } from "@/types/reading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type Phase = "check" | "learn" | "cloze" | "done";

export function ReadingLearningSession() {
  const params = useParams<{ id: string }>();
  const [document, setDocument] = useState<ReadingDocument | null>(null);
  const [items, setItems] = useState<ReadingLearningItem[]>([]);
  const [phase, setPhase] = useState<Phase>("check");
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const [learned, setLearned] = useState<string[]>([]);
  const [beforeCoverage, setBeforeCoverage] = useState(0);
  const [afterCoverage, setAfterCoverage] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const found = readingStorage.getDocument(params.id); if (!found) return;
      let queue = readingStorage.getQueue(params.id).filter((item) => item.status !== "completed");
      if (!queue.length) {
        const recommended = found.vocabulary.filter((item) => item.recommendation === "must-learn" || item.recommendation === "worth-learning").slice(0, 12);
        readingStorage.enqueue(recommended.map((item) => ({ documentId: found.id, wordId: item.wordId, contextSentence: item.contextSentence, contextImportance: item.contextImportance, recommendationScore: item.recommendationScore, status: "pending" })));
        queue = readingStorage.getQueue(params.id).filter((item) => item.status !== "completed");
      }
      setDocument(found); setItems(queue.slice(0, 15)); setBeforeCoverage(found.coverage.contentWordCoverage);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [params.id]);

  const current = items[index];
  const word = current ? getWordById(current.wordId) : undefined;
  const cloze = useMemo(() => current && word ? current.contextSentence.replace(new RegExp(`\\b${word.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"), "______") : "", [current, word]);
  const phaseOffset = phase === "check" ? 0 : phase === "learn" ? items.length : phase === "cloze" ? items.length * 2 : items.length * 3;
  const progress = items.length ? Math.round(((phaseOffset + index + (phase === "done" ? 0 : 1)) / (items.length * 3)) * 100) : 0;

  function next(nextPhase?: Phase) {
    setRevealed(false); setAnswer(""); setResult(null);
    if (index + 1 < items.length) setIndex(index + 1);
    else if (phase === "cloze") finishSession();
    else { setIndex(0); setPhase(nextPhase ?? (phase === "check" ? "learn" : "cloze")); }
  }

  function checkRecognition(state: "known" | "fuzzy" | "unknown") {
    if (!current) return;
    recordWordRecognition(current.wordId, state, 1200, state === "known", `reading-${params.id}`);
    next();
  }

  function finishLearningCard() {
    if (!current) return;
    markWordIntroduced(current.wordId);
    setLearned((value) => [...new Set([...value, current.wordId])]);
    next();
  }

  function checkCloze() {
    if (!word || result !== null) return;
    const correct = answer.trim().toLowerCase() === word.word.toLowerCase();
    setResult(correct); recordWordAnswer(word.id, correct ? "good" : "again", correct);
    if (correct) recordVerificationResult(word.id, true, `reading-${params.id}`);
  }

  function finishSession() {
    if (!document) return;
    readingStorage.completeQueue(document.id, learned);
    const refreshed = analyzeReadingDocument({ id: document.id, text: document.text, title: document.title, sourceType: document.sourceType, storage: loadProgress(), now: new Date(document.createdAt) });
    readingStorage.saveDocument(refreshed); setAfterCoverage(refreshed.coverage.contentWordCoverage); setPhase("done");
    const readingProgress = readingStorage.getProgress(document.id);
    if (readingProgress) readingStorage.saveProgress({ ...readingProgress, learnedWordIds: [...new Set([...readingProgress.learnedWordIds, ...learned])], coverageAfter: refreshed.coverage.contentWordCoverage, unknownAfter: refreshed.coverage.unknownContentWords });
  }

  if (!document) return <div className="page-shell py-20 text-center"><p className="font-semibold">没有找到文章学习队列。</p><Button asChild className="mt-5"><Link href="/reading">返回阅读分析</Link></Button></div>;
  if (!items.length) return <div className="page-shell py-20 text-center"><Check className="mx-auto size-10 text-emerald-600" /><h1 className="mt-4 text-2xl font-bold">这篇文章暂时没有待学推荐词</h1><Button asChild className="mt-6"><Link href={`/reading/${document.id}`}>回到文章</Link></Button></div>;

  if (phase === "done") return <div className="page-shell py-14"><Card className="mx-auto max-w-2xl border-emerald-200"><CardContent className="p-8 text-center sm:p-12"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700"><Check className="size-7" /></div><p className="mt-5 label-caps text-xs font-bold text-emerald-700">Reading loop complete</p><h1 className="mt-2 text-3xl font-bold">现在，再读一次这篇文章。</h1><p className="mt-3 text-[var(--muted-foreground)]">重点词已进入统一 SRS。内容词覆盖率从 <strong>{beforeCoverage}%</strong> 更新为 <strong>{afterCoverage || beforeCoverage}%</strong>。</p><div className="mt-7 grid grid-cols-2 gap-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-2xl font-bold">{learned.length}</p><p className="text-xs text-[var(--muted-foreground)]">学习词汇</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-2xl font-bold">+{Math.max(0, (afterCoverage || beforeCoverage) - beforeCoverage).toFixed(1)}%</p><p className="text-xs text-[var(--muted-foreground)]">Coverage Gain</p></div></div><div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row"><Button asChild><Link href={`/reading/${document.id}`}><Eye className="size-4" />Read Again</Link></Button><Button asChild variant="outline"><Link href="/review"><RotateCcw className="size-4" />查看长期复习</Link></Button></div></CardContent></Card></div>;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#f7f8fb] py-7"><div className="mx-auto w-[min(720px,calc(100%-32px))]"><div className="flex items-center justify-between"><Link href={`/reading/${document.id}`} className="flex items-center gap-2 text-sm font-semibold text-[var(--muted-foreground)]"><ArrowLeft className="size-4" />退出学习</Link><Badge variant="outline">{phase === "check" ? "1 · Quick Check" : phase === "learn" ? "2 · 重点词" : "3 · Context Cloze"}</Badge></div><Progress value={Math.min(100, progress)} className="mt-5" />
      <Card className="mt-6 overflow-hidden border-indigo-200 shadow-xl shadow-indigo-950/5"><CardContent className="p-7 sm:p-10"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">{index + 1} / {items.length}</p><span className="text-xs text-[var(--muted-foreground)]">推荐分 {current.recommendationScore}</span></div>
        {phase === "check" && <div className="py-10 text-center"><p className="text-4xl font-bold tracking-tight">{word?.word}</p><p className="mt-3 text-sm text-[var(--muted-foreground)]">先凭直觉判断，不需要想太久。</p>{revealed ? <div className="mt-8 rounded-2xl bg-indigo-50 p-5 text-left"><p className="text-lg font-semibold">{word?.meaningZh.join("；")}</p><p className="mt-2 text-sm leading-6 text-slate-600">{current.contextSentence}</p></div> : <Button className="mt-8" variant="outline" onClick={() => setRevealed(true)}><Eye className="size-4" />显示语境</Button>}<div className="mt-8 grid grid-cols-3 gap-2"><Button variant="outline" onClick={() => checkRecognition("known")}><Check className="size-4" />认识</Button><Button variant="outline" onClick={() => checkRecognition("fuzzy")}><Sparkles className="size-4" />模糊</Button><Button variant="outline" onClick={() => checkRecognition("unknown")}><X className="size-4" />不会</Button></div></div>}
        {phase === "learn" && <div className="py-4"><p className="text-3xl font-bold">{word?.word}</p><p className="mt-2 text-xl font-semibold text-indigo-700">{word?.meaningZh[0]}</p><div className="mt-6 rounded-2xl bg-slate-50 p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">文章原句</p><p className="mt-3 text-lg leading-8">{current.contextSentence}</p></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border p-4"><p className="text-xs font-bold text-[var(--muted-foreground)]">常用搭配</p><p className="mt-2 font-semibold">{word?.collocations.slice(0, 2).join(" · ") || "语境优先"}</p></div><div className="rounded-2xl border p-4"><p className="text-xs font-bold text-[var(--muted-foreground)]">词根推理</p><p className="mt-2 font-semibold">{word?.morphology || word?.word}</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">{word?.literalMeaning}</p></div></div><Button className="mt-7 w-full" onClick={finishLearningCard}>继续 <ArrowRight className="size-4" /></Button></div>}
        {phase === "cloze" && <div className="py-5"><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">用原句回忆</p><p className="mt-5 rounded-2xl bg-slate-50 p-5 text-xl leading-9">{cloze}</p><input value={answer} disabled={result !== null} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") checkCloze(); }} className="mt-5 h-12 w-full rounded-xl border px-4 text-lg outline-none focus:border-indigo-400" placeholder="输入缺少的词" />{result !== null && <div className={`mt-4 rounded-xl p-4 text-sm font-semibold ${result ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{result ? "正确，语境记忆已记录。" : `答案是 ${word?.word}。这次会更早进入复习。`}</div>}<Button className="mt-5 w-full" onClick={result === null ? checkCloze : () => next()} disabled={!answer.trim()}>{result === null ? "检查答案" : index + 1 === items.length ? "完成学习" : "下一题"}<ArrowRight className="size-4" /></Button></div>}
      </CardContent></Card></div></div>
  );
}
