"use client";

import Link from "next/link";
import { ArrowRight, Flame, Zap } from "lucide-react";
import { useLearningProgress } from "@/hooks/use-learning-progress";
import { recommendTodayRoots } from "@/lib/learning/root-learning";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

/** Today's ranked root picks — a small set, never the whole library. */
export function RootRecommendations() {
  const storage = useLearningProgress();
  const picks = recommendTodayRoots(storage, 3);
  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center gap-2">
        <Flame className="size-5 text-[var(--primary)]" />
        <h2 className="text-lg font-bold">今日推荐词根</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {picks.map((root, index) => (
          <Link key={root.id} href={`/roots/${root.id}`} className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
            <Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:border-indigo-200 group-hover:shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <Badge variant={index === 0 ? "default" : "secondary"}>
                    <Zap className="mr-1 size-3" />推荐 {index + 1}
                  </Badge>
                  <ArrowRight className="size-4 text-slate-300 transition-colors group-hover:text-[var(--primary)]" />
                </div>
                <h3 className="mt-4 text-3xl font-bold tracking-[-0.04em]">{root.root}</h3>
                <p className="mt-1 text-sm font-semibold text-[var(--primary)]">{root.meaningEn.join(" / ")}</p>
                <p className="mt-1 text-sm text-[var(--muted-foreground)]">{root.meaningZh.join(" · ")}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
