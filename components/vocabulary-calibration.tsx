"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Eye, Gauge } from "lucide-react";
import { buildCalibrationSample, calculateCalibrationResult, type CalibrationAnswer } from "@/lib/calibration";
import { recordWordRecognition } from "@/lib/recognition-progress";
import { loadProgress, saveProgress } from "@/lib/storage";
import type { RecognitionState } from "@/types/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const bandLabels = { "core-1000": "Core 1000", "core-2000": "Core 2000", "core-3000": "Core 3000", "core-5000": "Core 5000", academic: "Academic", advanced: "Advanced" };

export function VocabularyCalibration() {
  const [sample] = useState(() => buildCalibrationSample());
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<CalibrationAnswer[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof calculateCalibrationResult> | null>(null);
  const startedAt = useRef(0);
  const word = sample[index];

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const classify = (state: RecognitionState) => {
    if (!word) return;
    const nextAnswers = [...answers, { wordId: word.id, state }];
    recordWordRecognition(word.id, state, Date.now() - startedAt.current, false, "calibration");
    if (index + 1 >= sample.length) {
      const nextResult = calculateCalibrationResult(nextAnswers);
      const storage = loadProgress();
      saveProgress({ ...storage, calibration: nextResult, settings: { ...storage.settings, learningGoal: { ...storage.settings.learningGoal, vocabularyBand: nextResult.estimatedBand } } });
      setResult(nextResult);
    } else {
      setAnswers(nextAnswers);
      setIndex((value) => value + 1);
      setRevealed(false);
      startedAt.current = Date.now();
    }
  };

  if (result) return <div className="page-shell grid min-h-[68vh] place-items-center py-12"><Card className="w-full max-w-2xl border-indigo-200"><CardContent className="p-8 text-center sm:p-10"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><Check className="size-7" /></span><p className="label-caps mt-5 text-xs font-bold text-[var(--primary)]">Calibration complete</p><h1 className="mt-2 text-3xl font-bold">建议从 {bandLabels[result.estimatedBand]} 开始</h1><p className="mt-3 text-[var(--muted-foreground)]">认识 {result.knownCount} · 模糊 {result.fuzzyCount} · 不会 {result.unknownCount}。这只是起点，系统会继续根据真实表现调整。</p><div className="mt-8 flex justify-center gap-3"><Button asChild size="lg"><Link href="/vocabulary">开始快速扫词 <ArrowRight className="size-4" /></Link></Button><Button asChild variant="outline" size="lg"><Link href="/">返回首页</Link></Button></div></CardContent></Card></div>;

  if (!word) return null;
  return <div className="page-shell max-w-4xl py-8 sm:py-12"><div className="mb-6 flex items-center gap-4"><Progress value={index / sample.length * 100} /><span className="shrink-0 text-sm font-semibold text-[var(--muted-foreground)]">{index + 1} / {sample.length}</span></div><Card className="min-h-[540px] border-indigo-200 shadow-xl shadow-indigo-950/5"><CardContent className="flex min-h-[540px] flex-col p-7 sm:p-10"><div className="flex items-center justify-between"><Badge><Gauge className="mr-1 size-3.5" />词汇校准</Badge><span className="text-xs text-[var(--muted-foreground)]">不是考试，可以凭第一感觉</span></div><div className="flex flex-1 flex-col items-center justify-center text-center"><h1 className="text-6xl font-bold tracking-[-0.05em]">{word.word}</h1><p className="mt-3 text-[var(--muted-foreground)]">{word.phonetic} · {word.partOfSpeech.join(" / ")}</p>{revealed ? <div className="mt-8 rounded-2xl bg-[var(--primary-soft)] px-8 py-6"><p className="text-2xl font-bold text-[var(--primary)]">{word.meaningZh[0]}</p><p className="mt-2 text-sm text-[var(--muted-foreground)]">{word.meaningEn?.[0]}</p></div> : <Button variant="outline" className="mt-8" onClick={() => setRevealed(true)}><Eye className="size-4" />显示答案</Button>}</div><div className="grid gap-3 sm:grid-cols-3"><Button size="lg" variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800" onClick={() => classify("known")}>认识</Button><Button size="lg" variant="outline" className="border-amber-200 bg-amber-50 text-amber-800" onClick={() => classify("fuzzy")}>模糊</Button><Button size="lg" variant="outline" className="border-rose-200 bg-rose-50 text-rose-800" onClick={() => classify("unknown")}>不会</Button></div></CardContent></Card></div>;
}
