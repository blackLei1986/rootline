"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { TodayPlanDTO, TodaySessionDTO } from "@/types/today";

export function DashboardTodayGoal() {
  const [plan, setPlan] = useState<TodayPlanDTO | null>(null);
  const [session, setSession] = useState<TodaySessionDTO | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/today", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return null;
      return response.json() as Promise<TodayPlanDTO>;
    }).then(async (value) => {
      if (!active || !value) return;
      setPlan(value);
      const response = await fetch("/api/today/events?planId=" + encodeURIComponent(value.id), { cache: "no-store" });
      if (response.ok && active) setSession(await response.json() as TodaySessionDTO);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);
  const targets = plan?.dailyTargets ?? [];
  const completed = session?.completedTargetIds?.length ?? 0;
  const percent = targets.length ? completed / targets.length * 100 : 0;
  const hasDaily30 = Boolean(plan?.dailyTargets);
  const action = session?.status === "active" ? "继续今日学习" : session?.status === "complete" ? "查看今日完成" : "开始今日学习";
  return <section className="mb-7">
    <Card className="overflow-hidden border-indigo-200 bg-[#1f2550] text-white shadow-xl shadow-indigo-950/10">
      <CardContent className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="label-caps text-xs font-bold text-indigo-200">TODAY’S GOAL</p><h2 className="mt-2 text-2xl font-bold">{hasDaily30 ? "今日 30 词" : "今日学习计划"}</h2></div><Badge variant="success"><Clock3 className="mr-1 size-3.5" />约 {plan?.estimatedMinutes ?? 20} 分钟</Badge></div>
        <div className="mt-5 flex items-center justify-between text-sm"><span className="text-indigo-200">今日进度</span><strong>{hasDaily30 ? `${completed} / ${targets.length}` : "现有计划保持不变"}</strong></div>
        <Progress value={percent} className="mt-2 bg-white/15 [&>div]:bg-indigo-300" />
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-indigo-200">{hasDaily30 ? `Root Core ${targets.filter((word) => word.source === "root-core" || word.originSource === "root-core").length} · Support ${targets.filter((word) => word.source === "support" || word.originSource === "support").length}` : "新学习日将启用每日 30 词"}</span><Button asChild size="lg" className="bg-white text-[#252a58] hover:bg-indigo-50"><Link href="/today">{action}<ArrowRight className="size-4" /></Link></Button></div>
      </CardContent>
    </Card>
    <div className="mt-3 grid grid-cols-2 gap-3"><Link href="/roots" className="rounded-xl border bg-white p-4 text-sm font-semibold transition hover:border-indigo-200">今日词根 <span className="block pt-1 text-xs font-normal text-[var(--muted-foreground)]">查看 Root Core 词根</span></Link><Link href="/progress" className="rounded-xl border bg-white p-4 text-sm font-semibold transition hover:border-indigo-200">复习状态 <span className="block pt-1 text-xs font-normal text-[var(--muted-foreground)]">查看记忆与到期情况</span></Link></div>
  </section>;
}
