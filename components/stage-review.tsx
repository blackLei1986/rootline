"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, BrainCircuit, CheckCircle2, XCircle } from "lucide-react";
import { generalEnglishCore } from "@/data/course";
import { getRootById, roots } from "@/data/roots";
import { transferChallenges } from "@/data/transfer-challenges";
import { recordTransferResult } from "@/lib/learning-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type ReviewQuestion = { id: string; prompt: string; context?: string; options: string[]; answer: string; explanation: string; transfer?: boolean };

export function StageReview({ unitId }: { unitId: string }) {
  const unit = generalEnglishCore.stages[0].units.find((item) => item.id === unitId);
  const questions = useMemo<ReviewQuestion[]>(() => {
    if (!unit) return [];
    const rootQuestions = unit.rootIds.slice(0, 4).map((rootId, index) => {
      const root = getRootById(rootId)!;
      const distractors = roots.filter((item) => item.id !== rootId).slice(index, index + 3).map((item) => item.meaningZh[0]);
      return { id: `root-${rootId}`, prompt: `${root.root} 的核心含义是？`, options: [root.meaningZh[0], ...distractors], answer: root.meaningZh[0], explanation: `${root.root} = ${root.meaningEn.join(" / ")} · ${root.meaningZh.join(" / ")}` };
    });
    const transfer = transferChallenges.find((item) => item.unitId === unitId);
    return transfer ? [...rootQuestions, { id: transfer.id, prompt: transfer.prompt, context: `${transfer.morphology} · ${transfer.clue}`, options: transfer.options, answer: transfer.answer, explanation: transfer.explanation, transfer: true }] : rootQuestions;
  }, [unit, unitId]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  if (!unit || !questions.length) return <div className="page-shell py-16">未找到该课程小节。</div>;
  if (index >= questions.length) return <div className="page-shell grid min-h-[68vh] place-items-center py-12"><Card className="max-w-xl"><CardContent className="p-9 text-center"><CheckCircle2 className="mx-auto size-12 text-emerald-500" /><p className="label-caps mt-5 text-xs font-bold text-[var(--primary)]">Unit review complete</p><h1 className="mt-2 text-3xl font-bold">{score} / {questions.length}</h1><p className="mt-3 text-[var(--muted-foreground)]">你已经完成词根意义与陌生词构词推理的混合检查。</p><div className="mt-7 flex justify-center gap-3"><Button asChild><Link href="/course">返回课程</Link></Button><Button variant="outline" onClick={() => { setIndex(0); setSelected(null); setScore(0); }}>再测一次</Button></div></CardContent></Card></div>;
  const question = questions[index];
  const correct = selected === question.answer;
  const next = () => { if (selected === question.answer) setScore((value) => value + 1); if (question.transfer && selected) recordTransferResult(correct); setSelected(null); setIndex((value) => value + 1); };
  return <div className="page-shell max-w-3xl py-10"><div className="mb-6 flex items-center gap-4"><Progress value={(index / questions.length) * 100} /><span className="shrink-0 text-sm font-semibold">{index + 1}/{questions.length}</span></div><Card className="min-h-[520px]"><CardContent className="flex min-h-[520px] flex-col justify-center p-7 sm:p-10"><div className="text-center">{question.transfer && <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700"><BrainCircuit className="size-3.5" />陌生词推理</span>}<h1 className="mt-5 text-3xl font-bold">{question.prompt}</h1>{question.context && <p className="mt-3 font-mono text-sm text-[var(--primary)]">{question.context}</p>}</div><div className="mx-auto mt-8 grid w-full max-w-xl gap-3 sm:grid-cols-2">{question.options.map((option) => <button key={option} type="button" disabled={Boolean(selected)} onClick={() => setSelected(option)} className={`rounded-xl border p-4 text-left font-semibold ${selected && option === question.answer ? "border-emerald-300 bg-emerald-50" : selected === option ? "border-rose-300 bg-rose-50" : "bg-white hover:border-indigo-200"}`}>{option}</button>)}</div>{selected && <div className={`mx-auto mt-6 w-full max-w-xl rounded-xl border p-4 ${correct ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"}`}><p className="flex items-center gap-2 font-bold">{correct ? <CheckCircle2 className="size-5 text-emerald-600" /> : <XCircle className="size-5 text-rose-600" />}{correct ? "推理正确" : `正确答案：${question.answer}`}</p><p className="mt-2 text-sm text-[var(--muted-foreground)]">{question.explanation}</p><Button className="mt-4 w-full" onClick={next}>下一题 <ArrowRight className="size-4" /></Button></div>}</CardContent></Card></div>;
}
