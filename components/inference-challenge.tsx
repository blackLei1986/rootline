"use client";

import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { useLearningProgress } from "@/hooks/use-learning-progress";
import { buildInferenceChallenge } from "@/lib/learning/root-learning";
import { recordInferenceResult } from "@/lib/learning-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Inference challenge: guess an unseen word's meaning from its root + affixes.
 * Tracks accuracy via root_learning_progress.inference_score (localStorage).
 */
export function InferenceChallenge({ rootId }: { rootId: string }) {
  const storage = useLearningProgress();
  const [attempted, setAttempted] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<number | null>(null);

  const challenge = useMemo(
    () => buildInferenceChallenge(rootId, storage, attempted),
    [rootId, storage, attempted]
  );

  const answered = selected !== null;
  const correct = answered && challenge !== null && selected === challenge.correctIndex;

  function answer(index: number) {
    if (answered || !challenge) return;
    setSelected(index);
    recordInferenceResult(rootId, index === challenge.correctIndex);
  }

  function next() {
    if (!challenge) return;
    setAttempted((prev) => new Set(prev).add(challenge.wordId));
    setSelected(null);
  }

  if (!challenge) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-[var(--muted-foreground)]">
          这个词根的词族都学过了，去挑战别的词根吧。
        </CardContent>
      </Card>
    );
  }

  const progress = storage.roots[rootId];
  const accuracy = progress?.inferenceAttempts
    ? Math.round((progress.inferenceCorrect / progress.inferenceAttempts) * 100)
    : null;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold">推断挑战</h3>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">根据词根猜出这个生词的意思</p>
          </div>
          {accuracy !== null && (
            <span className="text-sm font-semibold text-[var(--muted-foreground)]">正确率 {accuracy}%</span>
          )}
        </div>

        <div className="mt-5 rounded-xl bg-[var(--primary-soft)] p-4">
          <p className="text-2xl font-bold tracking-tight">{challenge.word}</p>
          <p className="mt-2 text-sm">
            词根 <span className="font-mono font-semibold text-[var(--primary)]">{challenge.root}</span> = {challenge.rootMeaningZh.join(" / ")}
          </p>
          {challenge.affixHints.length > 0 && (
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{challenge.affixHints.join(" · ")}</p>
          )}
        </div>

        <div className="mt-4 grid gap-2">
          {challenge.choices.map((choice, index) => {
            const isCorrect = index === challenge.correctIndex;
            const isSelected = index === selected;
            const showState = answered && (isCorrect || isSelected);
            return (
              <button
                key={choice}
                type="button"
                onClick={() => answer(index)}
                disabled={answered}
                className={[
                  "flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors",
                  showState
                    ? isCorrect
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : "border-rose-300 bg-rose-50 text-rose-800"
                    : "border-[var(--border)] bg-white hover:border-indigo-200 hover:bg-[var(--muted)]",
                  answered ? "cursor-default" : "cursor-pointer"
                ].join(" ")}
              >
                <span>{choice}</span>
                {showState && (isCorrect ? <Check className="size-4" /> : <X className="size-4" />)}
              </button>
            );
          })}
        </div>

        {answered && (
          <Button className="mt-4 w-full" onClick={next}>下一题</Button>
        )}
      </CardContent>
    </Card>
  );
}
