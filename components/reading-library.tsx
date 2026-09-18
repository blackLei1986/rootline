"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookMarked, FileText, Plus, Trash2 } from "lucide-react";
import { readingStorage } from "@/lib/reading-storage";
import type { PersonalSentence, ReadingDocument } from "@/types/reading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function ReadingLibrary() {
  const [documents, setDocuments] = useState<ReadingDocument[]>([]);
  const [sentences, setSentences] = useState<PersonalSentence[]>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => { setDocuments(readingStorage.listDocuments()); setSentences(readingStorage.listSentences()); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  function remove(id: string) { readingStorage.deleteDocument(id); setDocuments(readingStorage.listDocuments()); setSentences(readingStorage.listSentences()); }
  return <div className="page-shell py-10 sm:py-14"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="label-caps text-xs font-bold text-[var(--primary)]">Reading library</p><h1 className="mt-2 text-4xl font-bold tracking-tight">你的文章</h1><p className="mt-2 text-[var(--muted-foreground)]">文章保存在当前浏览器中，不会自动公开或进入公共例句库。</p></div><Button asChild><Link href="/reading"><Plus className="size-4" />分析新文章</Link></Button></div>
    <div className="mt-8 space-y-3">{documents.length ? documents.map((document) => { const recommended = document.vocabulary.filter((item) => item.recommendation === "must-learn" || item.recommendation === "worth-learning").length; return <Card key={document.id}><CardContent className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center"><Link href={`/reading/${document.id}`} className="group"><div className="flex items-center gap-2"><Badge variant="outline">{document.sourceType.toUpperCase()}</Badge><span className="text-xs text-[var(--muted-foreground)]">{new Date(document.createdAt).toLocaleDateString("zh-CN")}</span></div><h2 className="mt-3 text-xl font-bold group-hover:text-indigo-700">{document.title ?? "Untitled Reading"}</h2><p className="mt-2 text-sm text-[var(--muted-foreground)]">{document.wordCount} 词 · 内容词覆盖率 {document.coverage.contentWordCoverage}% · {recommended} 个推荐词 · {document.difficultyLabel}</p></Link><div className="flex gap-2"><Button asChild variant="outline" size="sm"><Link href={`/reading/${document.id}`}>打开 <ArrowRight className="size-3.5" /></Link></Button><Button variant="ghost" size="icon" aria-label="删除文章" onClick={() => remove(document.id)}><Trash2 className="size-4 text-rose-600" /></Button></div></CardContent></Card>; }) : <div className="rounded-3xl border border-dashed bg-white px-6 py-16 text-center"><FileText className="mx-auto size-10 text-slate-300" /><p className="mt-4 text-lg font-semibold">还没有分析过文章</p><p className="mt-2 text-sm text-[var(--muted-foreground)]">粘贴一段真实英文，开始发现个人词汇缺口。</p><Button asChild className="mt-6"><Link href="/reading">分析第一篇文章</Link></Button></div>}</div>
    {sentences.length > 0 && <section className="mt-10"><div className="flex items-center gap-2"><BookMarked className="size-5 text-indigo-600" /><h2 className="text-xl font-bold">保存的原句</h2></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{sentences.map((sentence) => <Card key={sentence.id}><CardContent className="p-5"><p className="leading-7">{sentence.text}</p><p className="mt-3 text-xs text-[var(--muted-foreground)]">可用于后续 Context Cloze</p></CardContent></Card>)}</div></section>}
  </div>;
}
