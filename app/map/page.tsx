import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { roots } from "@/data/roots";
import type { RootCategory } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "词根地图" };
const labels: Record<RootCategory, string> = { vision: "视觉", speech: "表达", writing: "书写", movement: "移动", carrying: "携带", thinking: "认知", building: "构建", position: "位置", action: "动作", other: "其他" };

export default function RootMapPage() {
  const groups = Object.entries(Object.groupBy(roots, (root) => root.category)) as [RootCategory, typeof roots][];
  return <div className="page-shell py-10 sm:py-14"><p className="label-caps text-xs font-bold text-[var(--primary)]">Root map</p><h1 className="mt-3 text-4xl font-bold tracking-tight">按意义建立词根之间的路。</h1><p className="mt-3 max-w-2xl text-[var(--muted-foreground)]">地图按主题组织，不代表必须按组连续学习；每日推荐会主动交错相似概念。</p><div className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{groups.map(([category, items]) => <Card key={category}><CardContent className="p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">{labels[category]}</h2><Badge variant="secondary">{items.length}</Badge></div><div className="mt-5 space-y-2">{items.map((root) => <Link key={root.id} href={`/roots/${root.id}`} className="flex items-center justify-between rounded-xl border px-4 py-3 hover:border-indigo-200"><div><span className="font-bold">{root.root}</span><span className="ml-2 text-sm text-[var(--muted-foreground)]">{root.meaningZh[0]}</span></div><ArrowRight className="size-4 text-[var(--muted-foreground)]" /></Link>)}</div></CardContent></Card>)}</div></div>;
}
