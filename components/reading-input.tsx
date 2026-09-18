"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, Clock3, Library, Sparkles } from "lucide-react";
import { analyzeReadingDocument } from "@/lib/reading/analyze";
import { readingStorage } from "@/lib/reading-storage";
import { loadProgress } from "@/lib/storage";
import type { ReadingSourceType } from "@/types/reading";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const SAMPLE = `Research has shown that vocabulary knowledge plays an important role in reading comprehension. A significant increase in word knowledge can improve a learner's ability to inspect evidence, evaluate a prediction, and understand an unfamiliar perspective. In academic reading, repeated encounters with useful words support durable memory. As a result, learners benefit when they study important vocabulary in the context where it first caused difficulty.`;

const sourceOptions: { value: ReadingSourceType; label: string }[] = [
  { value: "general", label: "General" }, { value: "ielts", label: "IELTS" }, { value: "toefl", label: "TOEFL" },
  { value: "academic", label: "Academic" }, { value: "news", label: "News" }, { value: "other", label: "Other" }
];

export function ReadingInput() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [sourceType, setSourceType] = useState<ReadingSourceType>("general");
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  function analyze() {
    setError(""); setAnalyzing(true);
    try {
      const document = analyzeReadingDocument({ text, title, sourceType, storage: loadProgress() });
      readingStorage.saveDocument(document);
      router.push(`/reading/${document.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "文章分析失败，请稍后重试。");
      setAnalyzing(false);
    }
  }

  return (
    <div className="page-shell py-10 sm:py-14">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div><div className="flex items-center gap-2 text-[var(--primary)]"><Sparkles className="size-4" /><p className="label-caps text-xs font-bold">Read · Discover · Learn</p></div><h1 className="mt-3 text-4xl font-bold tracking-[-0.04em] sm:text-5xl">从一篇真实文章里，找到最值得学的词。</h1><p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--muted-foreground)]">粘贴英文文本，系统会结合你的学习记录分析覆盖率、阅读难度和高价值词汇。未见过不等于不会，推荐也不会等于全选。</p></div>
          <Button asChild variant="outline" className="shrink-0"><Link href="/reading/library"><Library className="size-4" />文章库</Link></Button>
        </div>

        <Card className="mt-9 border-indigo-200 shadow-xl shadow-indigo-950/5"><CardContent className="p-6 sm:p-8">
          <div className="grid gap-5 sm:grid-cols-[1fr_220px]">
            <label className="text-sm font-semibold">文章标题 <span className="font-normal text-[var(--muted-foreground)]">（可选）</span><input value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 h-12 w-full rounded-xl border bg-white px-4 font-normal outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" placeholder="例如：How We Learn New Words" /></label>
            <label className="text-sm font-semibold">文章类型<select value={sourceType} onChange={(event) => setSourceType(event.target.value as ReadingSourceType)} className="mt-2 h-12 w-full rounded-xl border bg-white px-4 font-normal outline-none focus:border-indigo-400">{sourceOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          </div>
          <label className="mt-5 block text-sm font-semibold">英文正文<textarea value={text} onChange={(event) => setText(event.target.value)} className="mt-2 min-h-72 w-full resize-y rounded-2xl border bg-[#fbfcff] p-5 font-normal leading-7 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" placeholder="Paste your English article here…" /></label>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div>{error ? <p className="text-sm font-medium text-rose-600">{error}</p> : <p className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]"><Clock3 className="size-4" />支持最多 15,000 个英文词，基础分析在本机完成。</p>}</div><div className="flex gap-2"><Button variant="ghost" onClick={() => { setText(SAMPLE); setTitle("Vocabulary in Context"); setSourceType("academic"); }}>填入示例</Button><Button onClick={analyze} disabled={!text.trim() || analyzing}>{analyzing ? "正在分析…" : "分析文章"}<ArrowRight className="size-4" /></Button></div></div>
        </CardContent></Card>

        <div className="mt-7 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border bg-white p-5"><BookOpenCheck className="size-5 text-indigo-600" /><p className="mt-3 font-semibold">个人化覆盖率</p><p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">区分已掌握、认识、模糊、不会和未追踪。</p></div><div className="rounded-2xl border bg-white p-5"><Sparkles className="size-5 text-amber-600" /><p className="mt-3 font-semibold">价值优先</p><p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">结合重复次数、学习价值与考试目标排序。</p></div><div className="rounded-2xl border bg-white p-5"><ArrowRight className="size-5 text-emerald-600" /><p className="mt-3 font-semibold">回到文章</p><p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">学完重点词，再读一次并看到覆盖率提升。</p></div></div>
      </div>
    </div>
  );
}
