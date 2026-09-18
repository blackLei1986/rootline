import Link from "next/link";
import { BookOpen, LogIn, Plus, Rss } from "lucide-react";
import { ArticleCandidateCard } from "@/components/reading/article-candidate-card";
import { Button } from "@/components/ui/button";
import type { ArticleCandidate } from "@/types/articles";

export function ForYou({
  authenticated,
  candidates
}: {
  authenticated: boolean;
  candidates: ArticleCandidate[];
}) {
  const visible = candidates.slice(0, 3);
  if (visible.length > 0) {
    return <div className="grid gap-4 lg:grid-cols-3">{visible.map((candidate) => <ArticleCandidateCard key={candidate.articleId} candidate={candidate} />)}</div>;
  }

  if (!authenticated) {
    return (
      <div className="rounded-3xl border border-dashed bg-white px-6 py-12 text-center">
        <LogIn className="mx-auto size-8 text-[var(--primary)]" />
        <h2 className="mt-4 text-2xl font-bold">每天只选最适合你的 1–3 篇</h2>
        <p className="mx-auto mt-2 max-w-xl text-[var(--muted-foreground)]">登录后，系统会根据词汇掌握度、文章覆盖率和今天可用时间挑选候选文章。</p>
        <Button asChild className="mt-6"><Link href="/login?next=%2Freading">登录后获取推荐</Link></Button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-dashed bg-white px-6 py-12 text-center">
      <BookOpen className="mx-auto size-8 text-[var(--primary)]" />
      <h2 className="mt-4 text-2xl font-bold">还没有合适的候选文章</h2>
      <p className="mx-auto mt-2 max-w-xl text-[var(--muted-foreground)]">添加少量高质量来源，或导入一篇你想读的文章。系统会在分析后挑选最合适的内容。</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button asChild><Link href="/reading/sources"><Rss className="size-4" />管理订阅源</Link></Button>
        <Button asChild variant="outline"><Link href="/reading/import"><Plus className="size-4" />导入文章</Link></Button>
      </div>
    </div>
  );
}
