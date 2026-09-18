"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, MessageSquareText } from "lucide-react";
import { sentences } from "@/data/learning-content";
import { getWordById } from "@/data/words";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function DailySentences() {
  const daily = useMemo(() => [...sentences].sort((a, b) => b.qualityScore - a.qualityScore).slice(0, 10), []);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const sentence = daily[index];
  if (!sentence) return <div className="page-shell py-12"><p>暂无通过质量门的句子。</p></div>;
  const target = getWordById(sentence.targetWordIds[0]);
  const cloze = target ? sentence.text.replace(new RegExp(`\\b${target.word}\\b`, "i"), "______") : sentence.text;
  return <div className="page-shell max-w-4xl py-9 sm:py-12">
    <div className="mb-7"><p className="label-caps text-xs font-bold text-[var(--primary)]">Daily sentences</p><h1 className="mt-2 text-3xl font-bold tracking-tight">今天的 10 个高频句子</h1><p className="mt-2 text-[var(--muted-foreground)]">同一条高质量句子，复用于理解、完形和搭配学习。</p></div>
    <Progress value={(index + 1) / daily.length * 100} />
    <Card className="mt-5 border-indigo-200"><CardContent className="p-7 sm:p-10"><div className="flex flex-wrap items-center gap-2"><Badge>{sentence.topic}</Badge><Badge variant="secondary">{sentence.level}</Badge><Badge variant="outline">质量 {sentence.qualityScore}</Badge></div><MessageSquareText className="mt-8 size-7 text-[var(--primary)]" /><p className="mt-5 text-2xl font-semibold leading-relaxed sm:text-3xl">{revealed ? sentence.text : cloze}</p>{revealed && <div className="mt-6 rounded-2xl bg-[var(--background)] p-5"><p className="leading-7">{sentence.translationZh}</p>{target && <p className="mt-2 text-sm font-semibold text-[var(--primary)]">目标词：{target.word} · {target.meaningZh[0]}</p>}</div>}<div className="mt-8 flex gap-3">{!revealed ? <Button size="lg" onClick={() => setRevealed(true)}>显示答案</Button> : <Button size="lg" onClick={() => { setIndex((value) => (value + 1) % daily.length); setRevealed(false); }}><CheckCircle2 className="size-4" />下一句 <ArrowRight className="size-4" /></Button>}</div></CardContent></Card>
  </div>;
}
