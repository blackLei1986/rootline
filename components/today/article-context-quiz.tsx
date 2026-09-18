import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ContextQuestion } from "@/types/context-question";

export function ArticleContextQuiz({ question, index, total, onAnswer }: { question?: ContextQuestion; index: number; total: number; onAnswer: (correct: boolean) => void }) {
  if (!question) return null;
  return <Card className="min-h-[560px] border-indigo-200 shadow-xl shadow-indigo-950/5"><CardContent className="flex min-h-[560px] flex-col justify-center p-7 sm:p-10">
    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--primary)]"><Sparkles className="size-4" />语境题 {index + 1} / {total}</div>
    <h2 className="mt-6 text-xl font-bold">{question.prompt}</h2>
    <p className="mt-6 rounded-2xl bg-[var(--primary-soft)] p-6 text-xl font-semibold leading-9">{question.sentence}</p>
    <div className="mt-7 grid gap-3">{question.choices.map((choice) => <button key={choice} type="button" onClick={() => onAnswer(choice === question.correctChoice)} className="rounded-xl border bg-white p-4 text-left font-semibold transition hover:border-indigo-300 hover:bg-indigo-50">{choice}</button>)}</div>
  </CardContent></Card>;
}
