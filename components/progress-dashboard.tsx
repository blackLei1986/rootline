"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, BookOpen, Clock3, Flag, Target } from "lucide-react";
import { useLearningProgress } from "@/hooks/use-learning-progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const GOAL = 10_000;

export function ProgressDashboard() {
  const storage = useLearningProgress();
  const now = useMemo(() => new Date(), []);

  const metrics = useMemo(() => {
    const words = Object.values(storage.words);
    const learned = words.filter((word) => word.reviewCount > 0 || word.firstLearnedAt != null).length;
    const mastered = words.filter((word) => word.status === "mastered").length;
    const due = words.filter((word) => word.nextReviewAt && new Date(word.nextReviewAt).getTime() <= now.getTime()).length;
    return { learned, mastered, due };
  }, [now, storage.words]);

  const goalPercent = Math.min(100, Math.round(metrics.learned / GOAL * 100));

  return (
    <div className="page-shell py-10 sm:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="label-caps text-xs font-bold text-[var(--primary)]">Progress</p>
          <h1 className="mt-2 text-4xl font-bold tracking-[-0.04em]">词汇增长</h1>
          <p className="mt-3 max-w-2xl leading-7 text-[var(--muted-foreground)]">目标：掌握 10,000 个核心英语单词。</p>
        </div>
        <Button asChild><Link href="/today">继续今日学习 <ArrowRight className="size-4" /></Link></Button>
      </div>

      <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard icon={BookOpen} label="Learned Words" value={metrics.learned} detail="已学过 / 已识别" />
        <MetricCard icon={Target} label="Mastered Words" value={metrics.mastered} detail="达到掌握标准" />
        <MetricCard icon={Clock3} label="Due Reviews" value={metrics.due} detail="今天待复习" />
        <MetricCard icon={Flag} label="Goal" value={GOAL} detail="核心词汇目标" />
      </section>

      <section className="mt-8">
        <Card>
          <CardContent className="p-6">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-semibold">目标进度</span>
              <span className="text-[var(--muted-foreground)]">{metrics.learned.toLocaleString()} / {GOAL.toLocaleString()}（{goalPercent}%）</span>
            </div>
            <Progress value={goalPercent} />
            <p className="mt-3 text-sm text-[var(--muted-foreground)]">每天学一点，稳步向 10,000 词靠近。</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof BookOpen; label: string; value: number; detail: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <Icon className="size-5 text-[var(--primary)]" />
        <p className="mt-4 text-3xl font-bold">{value.toLocaleString()}</p>
        <p className="mt-1 font-semibold">{label}</p>
        <p className="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">{detail}</p>
      </CardContent>
    </Card>
  );
}
