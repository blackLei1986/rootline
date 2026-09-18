import { BookOpen, Check, Clock3, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TodayPlanDTO } from "@/types/today";

type Article = NonNullable<TodayPlanDTO["article"]>;

export function ArticleReadingStage({ article, onComplete }: { article: Article; onComplete: () => void }) {
  const paragraphs = article.text.split(/\n{2,}/u).map((value) => value.trim()).filter(Boolean);
  return <Card className="border-indigo-200 shadow-xl shadow-indigo-950/5"><CardContent className="p-7 sm:p-10">
    <div className="flex flex-wrap items-center gap-2"><Badge><BookOpen className="mr-1 size-3.5" />今日阅读</Badge><Badge variant="secondary"><Clock3 className="mr-1 size-3.5" />约 {article.estimatedMinutes} 分钟</Badge><span className="text-xs text-[var(--muted-foreground)]">{article.sourceTitle} · 覆盖度 {article.contentWordCoverage}%</span></div>
    <h1 className="mt-5 text-3xl font-bold tracking-[-0.03em]">{article.title}</h1>
    <div className="mt-7 space-y-5 text-lg leading-9 text-slate-800">{paragraphs.map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>)}</div>
    <div className="mt-8 flex flex-wrap gap-3"><Button size="lg" onClick={onComplete}><Check className="size-4" />完成阅读，开始语境题</Button><Button asChild variant="outline" size="lg"><a href={article.canonicalUrl} target="_blank" rel="noreferrer">查看原文 <ExternalLink className="size-4" /></a></Button></div>
  </CardContent></Card>;
}
