"use client";

import { words } from "@/data/words";
import { useLearningProgress } from "@/hooks/use-learning-progress";
import { getMasteredWordIds } from "@/lib/vocabulary-coverage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const rows = [
  { label: "Core 1000", filter: (word: (typeof words)[number]) => word.vocabularyBand === "core-1000" },
  { label: "Core 2000", filter: (word: (typeof words)[number]) => ["core-1000", "core-2000"].includes(word.vocabularyBand) },
  { label: "Core 3000", filter: (word: (typeof words)[number]) => ["core-1000", "core-2000", "core-3000"].includes(word.vocabularyBand) },
  { label: "IELTS-oriented", filter: (word: (typeof words)[number]) => word.coverageTags.includes("ielts") },
  { label: "TOEFL-oriented", filter: (word: (typeof words)[number]) => word.coverageTags.includes("toefl") },
  { label: "Academic", filter: (word: (typeof words)[number]) => word.coverageTags.includes("academic") }
];

export function VocabularyCoverage() {
  const storage = useLearningProgress();
  const mastered = getMasteredWordIds(storage);
  return <Card><CardHeader><div className="flex items-end justify-between gap-4"><div><p className="label-caps text-xs font-bold text-[var(--primary)]">Vocabulary coverage</p><CardTitle className="mt-1">词汇覆盖</CardTitle></div><span className="text-xs text-[var(--muted-foreground)]">按当前 Master Vocabulary 实际数据</span></div></CardHeader><CardContent className="grid gap-x-8 gap-y-5 md:grid-cols-2">{rows.map((row) => { const catalog = words.filter(row.filter); const count = catalog.filter((word) => mastered.has(word.id)).length; const percent = catalog.length ? Math.round(count / catalog.length * 100) : 0; return <div key={row.label}><div className="mb-2 flex items-center justify-between text-sm"><span className="font-semibold">{row.label}</span><span className="text-[var(--muted-foreground)]">{count} / {catalog.length} · {percent}%</span></div><Progress value={percent} /></div>; })}</CardContent></Card>;
}
