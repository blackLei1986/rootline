import type { Metadata } from "next";
import { RootCard } from "@/components/root-card";
import { RootRecommendations } from "@/components/root-recommendations";
import { RootRewards } from "@/components/root-rewards";
import { RootChallenge } from "@/components/root-challenge";
import { roots } from "@/data/roots";

export const metadata: Metadata = { title: "词根库" };

export default function RootsPage() {
  const sortedRoots = [...roots].sort((a, b) => a.priority - b.priority);
  return (
    <div className="page-shell py-10 sm:py-14">
      <div className="max-w-2xl">
        <p className="label-caps text-xs font-bold text-[var(--primary)]">Root library · {roots.length} roots</p>
        <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-5xl">从词根，看见词汇的结构。</h1>
        <p className="mt-4 text-base leading-7 text-[var(--muted-foreground)]">按学习价值排序。选择一个词根，先理解核心含义，再认识它构成的高频单词。</p>
      </div>

      <div className="mt-8"><RootRewards /></div>
      <RootRecommendations />

      <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {sortedRoots.map((root, index) => <RootCard key={root.id} root={root} index={index} />)}
      </div>
      <div className="mt-8 rounded-2xl border border-dashed bg-white/50 p-5 text-center text-sm text-[var(--muted-foreground)]">Stage 1 已收录 20 个核心词根；排序综合课程位置、学习价值与个人进度。</div>

      <RootChallenge />
    </div>
  );
}
