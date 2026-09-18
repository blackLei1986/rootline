"use client";

import { Trophy, Unlock, BookOpen } from "lucide-react";
import { useLearningProgress } from "@/hooks/use-learning-progress";
import { getRootRewards } from "@/lib/learning/root-learning";

/** No-currency reward summary: mastered roots + unlocked words. */
export function RootRewards() {
  const storage = useLearningProgress();
  const rewards = getRootRewards(storage);
  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="rounded-2xl border bg-white p-4 text-center">
        <Trophy className="mx-auto size-5 text-amber-500" />
        <p className="mt-2 text-xl font-bold">{rewards.masteredRoots}</p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">已掌握词根</p>
      </div>
      <div className="rounded-2xl border bg-white p-4 text-center">
        <BookOpen className="mx-auto size-5 text-[var(--primary)]" />
        <p className="mt-2 text-xl font-bold">{rewards.learningRoots}</p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">学习中词根</p>
      </div>
      <div className="rounded-2xl border bg-white p-4 text-center">
        <Unlock className="mx-auto size-5 text-emerald-500" />
        <p className="mt-2 text-xl font-bold">{rewards.unlockedWords}</p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">解锁单词</p>
      </div>
    </div>
  );
}
