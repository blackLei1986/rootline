"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Eye, XCircle } from "lucide-react";
import { isQuizAnswerCorrect } from "@/lib/quiz-generator";
import { cn } from "@/lib/utils";
import type { QuizQuestion } from "@/types/quiz";
import type { ReviewRating } from "@/types/progress";
import { Button } from "@/components/ui/button";
import { ReviewButtons } from "@/components/review-buttons";

export function QuizCard({
  question,
  onRated
}: {
  question: QuizQuestion;
  onRated: (correct: boolean, rating: ReviewRating) => void;
}) {
  const [answer, setAnswer] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [correct, setCorrect] = useState(false);

  const reveal = (forceIncorrect = false) => {
    const result = !forceIncorrect && isQuizAnswerCorrect(question, answer);
    setCorrect(result);
    setRevealed(true);
  };

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (!revealed && event.key === " " && !isTyping) {
        event.preventDefault();
        reveal(true);
      }
      if (!revealed && event.key === "Enter") reveal(false);
      if (revealed && ["1", "2", "3", "4"].includes(event.key)) {
        const rating = ({ "1": "again", "2": "hard", "3": "good", "4": "easy" } as const)[event.key as "1" | "2" | "3" | "4"];
        onRated(correct, rating);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  });

  return (
    <div>
      <div className="text-center">
        <p className="label-caps text-xs font-bold text-[var(--primary)]">Active recall</p>
        <h2 className="mt-5 text-4xl font-bold tracking-[-0.045em] sm:text-5xl">{question.prompt}</h2>
        <p className="mt-4 text-base text-[var(--muted-foreground)]">{question.instruction}</p>
      </div>

      <div className="mx-auto mt-8 max-w-xl">
        {question.options ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {question.options.map((option, index) => (
              <button
                type="button"
                key={option}
                disabled={revealed}
                onClick={() => setAnswer(option)}
                className={cn(
                  "flex min-h-14 items-center gap-3 rounded-xl border bg-white px-4 text-left text-sm font-semibold transition-colors",
                  answer === option ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]" : "hover:border-indigo-200",
                  revealed && option === question.answer && "border-emerald-300 bg-emerald-50 text-emerald-700",
                  revealed && answer === option && option !== question.answer && "border-rose-300 bg-rose-50 text-rose-700"
                )}
              >
                <span className="grid size-7 place-items-center rounded-lg bg-black/5 text-xs">{String.fromCharCode(65 + index)}</span>{option}
              </button>
            ))}
          </div>
        ) : (
          <input
            value={answer}
            disabled={revealed}
            onChange={(event) => setAnswer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !revealed) {
                event.preventDefault();
                reveal(false);
              }
            }}
            autoFocus
            autoComplete="off"
            placeholder="输入答案…"
            className="h-14 w-full rounded-xl border bg-white px-4 text-center text-lg font-semibold outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-indigo-100"
          />
        )}

        {!revealed ? (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button className="flex-1" onClick={() => reveal(false)} disabled={!answer}>提交答案</Button>
            <Button variant="outline" className="flex-1" onClick={() => reveal(true)}><Eye className="size-4" />显示答案 <kbd className="ml-1 text-xs opacity-50">Space</kbd></Button>
          </div>
        ) : (
          <div className="mt-6">
            <div className={cn("rounded-2xl border p-5", correct ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50")}>
              <div className="flex items-center gap-2 font-bold">{correct ? <CheckCircle2 className="size-5 text-emerald-600" /> : <XCircle className="size-5 text-rose-600" />}{correct ? "回答正确" : `正确答案：${question.answer}`}</div>
              <p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{question.explanation}</p>
            </div>
            <p className="mb-3 mt-6 text-center text-sm font-medium text-[var(--muted-foreground)]">这次记忆感觉如何？</p>
            <ReviewButtons onRate={(rating) => onRated(correct, rating)} />
          </div>
        )}
      </div>
    </div>
  );
}
