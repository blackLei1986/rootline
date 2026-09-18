"use client";

import Link from "next/link";
import { ArrowUpRight, BookOpen, Circle, CircleCheckBig, Clock3 } from "lucide-react";
import type { Root } from "@/types";
import { getWordsByRoot } from "@/data/words";
import { useLearningProgress } from "@/hooks/use-learning-progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const difficultyLabel = { easy: "Easy", medium: "Medium", hard: "Hard" } as const;

export function RootCard({ root, index }: { root: Root; index: number }) {
  const storage = useLearningProgress();
  const wordCount = getWordsByRoot(root.id).length;
  const progress = storage.roots[root.id];
  const status = progress?.status ?? "new";
  const statusConfig = {
    new: { label: "未学习", icon: Circle, variant: "secondary" as const },
    learning: { label: "学习中", icon: BookOpen, variant: "default" as const },
    review: { label: "复习中", icon: Clock3, variant: "outline" as const },
    mastered: { label: "已掌握", icon: CircleCheckBig, variant: "success" as const }
  }[status];
  const StatusIcon = statusConfig.icon;
  return (
    <Link href={`/roots/${root.id}`} className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] rounded-2xl">
      <Card className="h-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-indigo-200 group-hover:shadow-lg group-hover:shadow-indigo-950/5">
        <CardContent className="p-6">
          <div className="mb-7 flex items-start justify-between">
            <span className="text-xs font-semibold text-[var(--muted-foreground)]">0{index + 1}</span>
            <ArrowUpRight className="size-5 text-slate-300 transition-colors group-hover:text-[var(--primary)]" />
          </div>
          <h2 className="text-4xl font-bold tracking-[-0.04em]">{root.root}</h2>
          <p className="mt-2 text-base font-semibold text-[var(--primary)]">{root.meaningEn.join(" / ")}</p>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">{root.meaningZh.join(" · ")}</p>
          <div className="my-6 h-px bg-[var(--border)]" />
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusConfig.variant}><StatusIcon className="mr-1 size-3" />{statusConfig.label}{status !== "new" ? ` · ${progress?.mastery ?? 0}%` : ""}</Badge>
            <Badge variant="outline"><BookOpen className="mr-1 size-3" />{wordCount} words</Badge>
            <Badge variant="outline">{difficultyLabel[root.difficulty]}</Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
