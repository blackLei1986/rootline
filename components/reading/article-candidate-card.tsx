import Link from "next/link";
import { ArrowRight, BookOpen, Clock3, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ArticleCandidate } from "@/types/articles";

const explanations: Record<string, string> = {
  "coverage-fit": "覆盖度适合巩固与拓展",
  "valuable-new-words": "包含少量高价值新词",
  "time-fit": "适合今天的阅读时间",
  "path-fit": "与你的学习方向匹配",
  "source-diversity-penalty": "近期已多次阅读这个来源"
};

export function ArticleCandidateCard({ candidate }: { candidate: ArticleCandidate }) {
  const primaryReason = candidate.explanationCodes
    .map((code) => explanations[code])
    .find(Boolean) ?? "适合当前学习阶段";

  return (
    <Card data-testid="article-candidate" className="overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg">
      <CardContent className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{candidate.sourceTitle}</Badge>
          <span className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
            <Clock3 className="size-3.5" />{candidate.estimatedMinutes} 分钟
          </span>
        </div>
        <h3 className="mt-4 text-xl font-bold leading-7">{candidate.title}</h3>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">
            {formatCoverage(candidate.contentWordCoverage)}% 覆盖
          </span>
          <span className="rounded-lg bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
            {candidate.valuableUnknownWordIds.length} 个高价值新词
          </span>
        </div>
        <p className="mt-4 flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Sparkles className="size-4 text-[var(--primary)]" />{primaryReason}
        </p>
        <Link
          href={`/reading/articles/${candidate.articleId}`}
          className="mt-5 flex items-center justify-between rounded-xl bg-[var(--primary-soft)] px-4 py-3 text-sm font-semibold text-[var(--primary)]"
        >
          <span className="flex items-center gap-2"><BookOpen className="size-4" />开始阅读</span>
          <ArrowRight className="size-4" />
        </Link>
      </CardContent>
    </Card>
  );
}

function formatCoverage(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
