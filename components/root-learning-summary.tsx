"use client";

import { useLearningProgress } from "@/hooks/use-learning-progress";
import { getRootLearningMetrics } from "@/lib/progress-calculation";
import { Progress } from "@/components/ui/progress";

export function RootLearningSummary({ rootId }: { rootId: string }) {
  const storage = useLearningProgress();
  const metrics = getRootLearningMetrics(rootId, storage);
  return <div className="rounded-2xl border bg-white p-5"><div className="grid grid-cols-3 gap-3 text-center"><div><p className="text-xl font-bold">{metrics.learnedCore}/{metrics.totalCore}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">核心词覆盖</p></div><div><p className="text-xl font-bold">{metrics.stableCore}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">复习稳定</p></div><div><p className="text-xl font-bold">{metrics.mastery}%</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">综合掌握</p></div></div><Progress value={metrics.mastery} className="mt-4" /></div>;
}
