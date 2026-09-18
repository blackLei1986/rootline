import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, Layers3 } from "lucide-react";
import { learningPaths, getLearningPath } from "@/data/learning-paths";
import { words } from "@/data/words";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function generateStaticParams() { return learningPaths.map((path) => ({ track: path.id })); }
export default async function LearningPathPage({ params }: { params: Promise<{ track: string }> }) {
  const { track } = await params;
  const path = getLearningPath(track);
  if (!path) notFound();
  const catalog = words.filter((word) => word.coverageTags.includes(path.tag)).sort((a, b) => b.priorityScore - a.priorityScore);
  return <div className="page-shell py-9 sm:py-12">
    <div className="flex flex-wrap gap-2">{learningPaths.map((item) => <Button key={item.id} asChild size="sm" variant={item.id === path.id ? "default" : "outline"}><Link href={`/paths/${item.id}`}>{item.title}</Link></Button>)}</div>
    <section className="mt-7 rounded-3xl bg-[#1f2550] p-7 text-white sm:p-10"><p className="label-caps text-xs font-bold text-indigo-200">{path.eyebrow}</p><h1 className="mt-3 text-4xl font-bold tracking-tight">{path.title}</h1><p className="mt-4 max-w-2xl leading-7 text-indigo-100">{path.description}</p><div className="mt-7 flex flex-wrap gap-3"><Badge className="bg-white text-[#252a58]">{catalog.length} 个当前词条</Badge><Badge className="bg-white/10 text-white">Master Vocabulary 共享进度</Badge></div></section>
    <div className="mt-7 grid gap-6 lg:grid-cols-[1fr_360px]"><div className="space-y-5">{path.modules.map((module, index) => <Card key={module.title}><CardHeader><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-[var(--primary)]">MODULE {index + 1}</p><CardTitle className="mt-1">{module.title}</CardTitle></div><Layers3 className="size-5 text-[var(--primary)]" /></div></CardHeader><CardContent><p className="text-sm leading-6 text-[var(--muted-foreground)]">{module.description}</p><div className="mt-4 flex flex-wrap gap-2">{module.topics.map((topic) => <Badge key={topic} variant="secondary">{topic}</Badge>)}</div></CardContent></Card>)}</div><Card className="h-fit border-indigo-200"><CardHeader><CardTitle className="text-base">优先学习</CardTitle></CardHeader><CardContent className="space-y-2">{catalog.slice(0, 6).map((word) => <Link key={word.id} href={`/words/${word.id}`} className="flex items-center justify-between rounded-xl border px-3 py-3 text-sm"><span><strong>{word.word}</strong><span className="ml-2 text-[var(--muted-foreground)]">{word.meaningZh[0]}</span></span><span className="flex items-center gap-1 text-xs text-[var(--primary)]"><CheckCircle2 className="size-3.5" />{word.priorityScore}</span></Link>)}<Button asChild className="mt-3 w-full"><Link href="/vocabulary">开始快速扩词 <ArrowRight className="size-4" /></Link></Button></CardContent></Card></div>
  </div>;
}
