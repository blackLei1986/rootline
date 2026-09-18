import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BookOpenCheck, Languages, Lightbulb, MapPin, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WordCard } from "@/components/word-card";
import { WordFamilyTree } from "@/components/word-family-tree";
import { RootStudyFlow } from "@/components/root-study-flow";
import { getRootById, roots } from "@/data/roots";
import { getWordsByRoot } from "@/data/words";
import { RootLearningSummary } from "@/components/root-learning-summary";

export function generateStaticParams() { return roots.map((root) => ({ root: root.id })); }

export async function generateMetadata({ params }: { params: Promise<{ root: string }> }): Promise<Metadata> {
  const { root: id } = await params;
  const root = getRootById(id);
  return root ? { title: `${root.root} 词根`, description: root.description } : {};
}

export default async function RootDetailPage({ params }: { params: Promise<{ root: string }> }) {
  const { root: id } = await params;
  const root = getRootById(id);
  if (!root) notFound();
  const rootWords = getWordsByRoot(root.id);
  const groups = [
    { id: "core", title: "核心词", description: "高频、实用、构词关系清晰，优先进入每日学习。", words: rootWords.filter((word) => word.rootTier === "core") },
    { id: "extension", title: "扩展词", description: "核心词稳定后，用于扩大表达范围。", words: rootWords.filter((word) => word.rootTier === "extension") },
    { id: "advanced", title: "高级词", description: "默认不会过早进入基础学习。", words: rootWords.filter((word) => word.rootTier === "advanced") }
  ];
  return (
    <div className="page-shell py-9 sm:py-12">
      <Button asChild variant="ghost" size="sm" className="-ml-3 mb-7"><Link href="/roots"><ArrowLeft className="size-4" />返回词根库</Link></Button>
      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="overflow-hidden border-indigo-200 bg-[#1f2550] text-white">
          <CardContent className="p-7 sm:p-10">
            <div className="flex flex-wrap items-center gap-2"><Badge className="bg-white/10 text-indigo-100">推荐优先级：{root.rootValueScore >= 85 ? "高" : root.rootValueScore >= 70 ? "中" : "基础"}</Badge><Badge className="bg-white/10 text-indigo-100">Value {root.rootValueScore}</Badge><Badge className="bg-white/10 text-indigo-100">{root.difficulty}</Badge></div>
            <h1 className="mt-8 text-6xl font-bold tracking-[-0.055em] sm:text-7xl">{root.root}</h1>
            <p className="mt-4 text-2xl font-semibold text-indigo-200">{root.meaningEn.join(" / ")}</p>
            <p className="mt-2 text-lg text-indigo-100">{root.meaningZh.join(" · ")}</p>
            <p className="mt-8 max-w-xl border-t border-white/15 pt-6 text-base leading-7 text-indigo-100/80">{root.description}</p>
          </CardContent>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Card><CardContent className="flex items-start gap-4 p-5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"><MapPin className="size-5" /></span><div><p className="text-sm font-semibold">来源</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">{root.origin ?? "暂未收录"}</p></div></CardContent></Card>
          <Card><CardContent className="flex items-start gap-4 p-5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"><BookOpenCheck className="size-5" /></span><div><p className="text-sm font-semibold">词汇数</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">{rootWords.length} 个精选高频词</p></div></CardContent></Card>
          <Card className="sm:col-span-2 lg:col-span-1"><CardContent className="flex items-start gap-4 p-5"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><Lightbulb className="size-5" /></span><div><p className="text-sm font-semibold">记忆提示</p><p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{root.mnemonic}</p></div></CardContent></Card>
        </div>
      </section>

      <section className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]"><Card><CardContent className="p-6"><div className="flex items-center gap-2 font-bold"><Sparkles className="size-5 text-[var(--primary)]" />为什么值得学</div><p className="mt-3 text-sm leading-7 text-[var(--muted-foreground)]">{root.learningRationale}</p></CardContent></Card><RootLearningSummary rootId={root.id} /></section>

      <section className="mt-12">
        <div className="mb-6"><div className="flex items-center gap-2 text-[var(--primary)]"><Languages className="size-4" /><span className="label-caps text-xs font-bold">Word family tree</span></div><h2 className="mt-2 text-2xl font-bold">词族树</h2></div>
        <WordFamilyTree rootId={root.id} />
      </section>

      <section className="mt-12">
        <div className="mb-6"><div className="flex items-center gap-2 text-[var(--primary)]"><Sparkles className="size-4" /><span className="label-caps text-xs font-bold">Study flow</span></div><h2 className="mt-2 text-2xl font-bold">词根学习流程</h2></div>
        <RootStudyFlow rootId={root.id} />
      </section>

      <section className="mt-12">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2 text-[var(--primary)]"><Languages className="size-4" /><span className="label-caps text-xs font-bold">Word tree</span></div><h2 className="mt-2 text-2xl font-bold">词根单词树</h2></div><p className="text-sm text-[var(--muted-foreground)]">按使用频率优先展示</p></div>
        <div className="space-y-9">{groups.map((group) => group.words.length > 0 && <div key={group.id}><div className="mb-4"><h3 className="text-lg font-bold">{group.title} <span className="text-sm font-normal text-[var(--muted-foreground)]">· {group.words.length}</span></h3><p className="mt-1 text-sm text-[var(--muted-foreground)]">{group.description}</p></div><div className="grid gap-4 md:grid-cols-2">{group.words.map((word) => <WordCard key={word.id} word={word} />)}</div></div>)}</div>
      </section>
    </div>
  );
}
