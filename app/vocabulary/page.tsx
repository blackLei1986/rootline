import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Gauge, Network, Route, Search } from "lucide-react";
import manifest from "@/data/vocabulary/production-manifest.json";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "词汇", description: "搜索、扩词、词根与词汇路径。" };

const entries = [
  { href: "/vocabulary/search", icon: Search, title: "搜索词库", detail: "按需查找英文、中文释义和例句", action: "开始搜索" },
  { href: "/vocabulary/rapid", icon: Gauge, title: "快速扫词", detail: "在 20–50 个候选词中标记认识、模糊或不会", action: "独立练习" },
  { href: "/roots", icon: Network, title: "词根与词族", detail: "只展示有教学价值的高置信度构词", action: "查看词根" },
  { href: "/paths", icon: Route, title: "词汇路径", detail: "General、Academic、IELTS-oriented 与 TOEFL-oriented", action: "选择路径" }
];

export default function VocabularyPage() {
  return <div className="page-shell py-10 sm:py-14">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="label-caps text-xs font-bold text-[var(--primary)]">Vocabulary</p><h1 className="mt-2 text-4xl font-bold tracking-[-0.04em]">词库在后台，任务在眼前。</h1><p className="mt-3 max-w-2xl leading-7 text-[var(--muted-foreground)]">你不需要“学完 9000 词”。系统会把它们筛成每天最值得处理的小批量候选词。</p></div><Badge variant="success" className="w-fit">{manifest.acceptedLemmaCount.toLocaleString()} accepted lemmas</Badge></div>
    <Card className="mt-8 border-indigo-200 bg-[#1f2550] text-white"><CardContent className="flex flex-col gap-5 p-7 sm:flex-row sm:items-center sm:justify-between sm:p-9"><div><p className="label-caps text-xs font-bold text-indigo-200">建议入口</p><h2 className="mt-2 text-2xl font-bold">让 Today 帮你选词</h2><p className="mt-2 text-sm text-indigo-200">综合复习债务、学习路径、阅读遇词和近期正确率。</p></div><Button asChild size="lg" className="bg-white text-[#252a58] hover:bg-indigo-50"><Link href="/today">打开今日计划 <ArrowRight className="size-4" /></Link></Button></CardContent></Card>
    <div className="mt-7 grid gap-4 sm:grid-cols-2">{entries.map(({ href, icon: Icon, title, detail, action }) => <Card key={href} className="transition hover:border-indigo-200"><CardContent className="p-6"><span className="grid size-10 place-items-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]"><Icon className="size-5" /></span><h2 className="mt-5 text-xl font-bold">{title}</h2><p className="mt-2 text-sm leading-6 text-[var(--muted-foreground)]">{detail}</p><Link href={href} className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-[var(--primary)]">{action} <ArrowRight className="size-4" /></Link></CardContent></Card>)}</div>
  </div>;
}
