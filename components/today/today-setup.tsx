import { ArrowRight, Clock3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TodayPlanDTO } from "@/types/today";
import { ReadingUnavailable } from "@/components/today/reading-unavailable";

export function TodaySetup({ plan, onStart }: { plan: TodayPlanDTO; onStart: () => void }) {
  return <div className="page-shell py-10 sm:py-14">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="label-caps text-xs font-bold text-[var(--primary)]">Today</p><h1 className="mt-2 text-4xl font-bold tracking-[-0.04em]">今天只处理最值得学的内容。</h1><p className="mt-3 text-[var(--muted-foreground)]">9000 词是后台能力；你今天只面对系统挑好的这一小组。</p></div><Badge variant="success" className="w-fit"><Clock3 className="mr-1 size-3.5" />约 {plan.estimatedMinutes} 分钟</Badge></div>
    <Card className="mt-8 overflow-hidden border-indigo-200 bg-[#1f2550] text-white shadow-xl shadow-indigo-950/10"><CardContent className="p-7 sm:p-9"><div className="grid grid-cols-2 gap-5 sm:grid-cols-5"><PlanMetric label="复习" value={plan.warmupReviewIds.length} /><PlanMetric label="快速扫词" value={plan.rapidScanEntries.length} /><PlanMetric label="重点词" value={plan.focusedLearningTarget} /><PlanMetric label="文章" value={plan.article ? 1 : 0} /><PlanMetric label="语境题" value={plan.contextQuestions.length} /></div><Button size="lg" className="mt-8 bg-white text-[#252a58] hover:bg-indigo-50" onClick={onStart}>开始今日学习 <ArrowRight className="size-4" /></Button></CardContent></Card>
    {!plan.article && <ReadingUnavailable reason={plan.degradationReason} />}
    <p className="mt-5 text-center text-xs text-[var(--muted-foreground)]">编排比例：复习 {plan.mix.review}% · 新词 {plan.mix.newVocabulary}% · 阅读 {plan.mix.reading}% · 语境 {plan.mix.sentence}%</p>
  </div>;
}

function PlanMetric({ label, value }: { label: string; value: number }) { return <div><p className="text-3xl font-bold">{value}</p><p className="mt-1 text-sm text-indigo-200">{label}</p></div>; }
