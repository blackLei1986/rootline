"use client";

import { Check, ChevronRight } from "lucide-react";
import { useLearningProgress } from "@/hooks/use-learning-progress";
import { ROOT_STAGES, selectRootQuestionType, type RootStudyStage } from "@/lib/learning/root-learning";
import { recordRootStage } from "@/lib/learning-actions";
import { getRootById } from "@/data/roots";
import { getWordsByRoot } from "@/data/words";
import { WordBreakdown } from "@/components/word-breakdown";
import { WordCard } from "@/components/word-card";
import { InferenceChallenge } from "@/components/inference-challenge";
import { Button } from "@/components/ui/button";

const skillLabel = { recognition: "识别", derivation: "拆解", inference: "推断" } as const;

/** The 4-stage root study flow: recognise -> decompose -> expand -> test. */
export function RootStudyFlow({ rootId }: { rootId: string }) {
  const storage = useLearningProgress();
  const root = getRootById(rootId);
  const progress = storage.roots[rootId];
  const currentStage = progress?.lastStage ? (Math.min(4, progress.lastStage + 1) as RootStudyStage) : 1;
  const weakest = selectRootQuestionType(progress);

  if (!root) return null;

  function advance(stage: RootStudyStage) {
    recordRootStage(rootId, stage);
  }

  const coreWords = getWordsByRoot(rootId).filter((word) => word.rootTier === "core").slice(0, 3);
  const familyWords = getWordsByRoot(rootId).filter((word) => word.rootTier === "core" || word.rootTier === "extension").slice(0, 5);

  return (
    <div>
      {/* stage rail */}
      <div className="grid grid-cols-4 gap-2">
        {ROOT_STAGES.map((stage) => {
          const done = (progress?.lastStage ?? 0) >= stage.id;
          const active = currentStage === stage.id;
          return (
            <div
              key={stage.id}
              className={[
                "rounded-xl border p-3 text-center transition-colors",
                active ? "border-[var(--primary)] bg-[var(--primary-soft)]" : done ? "border-emerald-200 bg-emerald-50" : "border-[var(--border)] bg-white"
              ].join(" ")}
            >
              <div className="mx-auto grid size-6 place-items-center rounded-full text-xs font-bold">
                {done ? <Check className="size-4 text-emerald-600" /> : <span className={active ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}>{stage.id}</span>}
              </div>
              <p className={`mt-1.5 text-xs font-semibold ${active ? "text-[var(--primary)]" : "text-[var(--muted-foreground)]"}`}>{stage.title}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-6">
        <h3 className="text-lg font-bold">{ROOT_STAGES[currentStage - 1].title}</h3>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">{ROOT_STAGES[currentStage - 1].description}</p>
        <p className="mt-1 text-xs text-slate-400">目标：{ROOT_STAGES[currentStage - 1].goal}</p>
      </div>

      {/* stage content */}
      <div className="mt-5">
        {currentStage === 1 && (
          <div className="rounded-2xl border bg-white p-6">
            <p className="font-mono text-5xl font-bold tracking-[-0.04em] text-[var(--primary)]">{root.root}</p>
            <p className="mt-3 text-xl font-semibold">{root.meaningEn.join(" / ")}</p>
            <p className="mt-1 text-[var(--muted-foreground)]">{root.meaningZh.join(" · ")}</p>
            <p className="mt-5 text-sm leading-7 text-[var(--muted-foreground)]">{root.description}</p>
            {root.mnemonic && (
              <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                <span className="font-semibold">记忆提示：</span>{root.mnemonic}
              </div>
            )}
            <div className="mt-4 text-sm text-[var(--muted-foreground)]">来源：<span className="font-medium text-[var(--foreground)]">{root.origin ?? "暂未收录"}</span></div>
          </div>
        )}

        {currentStage === 2 && (
          <div className="grid gap-4">
            {coreWords.map((word) => (
              <div key={word.id} className="rounded-2xl border bg-white p-6">
                <p className="mb-3 font-mono text-lg font-bold">{word.word}</p>
                <WordBreakdown word={word} />
              </div>
            ))}
          </div>
        )}

        {currentStage === 3 && (
          <div className="grid gap-4 md:grid-cols-2">
            {familyWords.map((word) => <WordCard key={word.id} word={word} />)}
          </div>
        )}

        {currentStage === 4 && (
          <div className="grid gap-4">
            <p className="text-sm text-[var(--muted-foreground)]">当前最薄弱技能：<span className="font-semibold text-[var(--primary)]">{skillLabel[weakest]}</span>，优先练习。</p>
            <InferenceChallenge rootId={rootId} />
          </div>
        )}
      </div>

      {/* advance */}
      {currentStage < 4 && (
        <Button className="mt-6" onClick={() => advance(currentStage)}>
          完成本阶段，进入「{ROOT_STAGES[currentStage].title}」<ChevronRight className="size-4" />
        </Button>
      )}
    </div>
  );
}
