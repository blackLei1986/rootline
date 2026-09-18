import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookMarked, Link2, MessageSquareQuote, Network } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WordBreakdown } from "@/components/word-breakdown";
import { getPhrasesByWord, getSentencesByWord, getWordFamily } from "@/data/learning-content";
import { getRootById } from "@/data/roots";
import { getWordById, words } from "@/data/words";

export function generateStaticParams() { return words.map((word) => ({ word: word.id })); }
export async function generateMetadata({ params }: { params: Promise<{ word: string }> }): Promise<Metadata> {
  const { word: id } = await params;
  const word = getWordById(id);
  return word ? { title: word.word, description: `${word.word}：${word.senses.find((sense) => sense.isCore)?.meaningZh ?? word.meaningZh[0]}` } : {};
}

export default async function WordDetailPage({ params }: { params: Promise<{ word: string }> }) {
  const { word: id } = await params;
  const word = getWordById(id);
  if (!word) notFound();
  const root = word.rootIds[0] ? getRootById(word.rootIds[0]) : undefined;
  const phrases = getPhrasesByWord(word.id);
  const sentences = getSentencesByWord(word.id);
  const family = getWordFamily(word.wordFamilyId);
  const coreSenses = word.senses.filter((sense) => sense.isCore).slice(0, 2);
  const moreSenses = word.senses.filter((sense) => !sense.isCore);
  return (
    <div className="page-shell py-9 sm:py-12">
      <Button asChild variant="ghost" size="sm" className="-ml-3 mb-7"><Link href={root ? `/roots/${root.id}` : "/vocabulary"}><ArrowLeft className="size-4" />{root ? `返回 ${root.root} 词根` : "返回快速扩词"}</Link></Button>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_340px]">
        <div>
          <section className="rounded-3xl border border-indigo-200 bg-white p-7 shadow-sm sm:p-9">
            <div className="flex flex-wrap items-center gap-2"><Badge>{word.vocabularyBand.toUpperCase()}</Badge><Badge variant="outline">优先级 {word.priorityScore}</Badge>{word.cefr && <Badge variant="outline">CEFR {word.cefr}</Badge>}{word.coverageTags.map((tag) => <Badge key={tag} variant="secondary">{tag.toUpperCase()}</Badge>)}</div>
            <div className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-5xl font-bold tracking-[-0.05em] sm:text-6xl">{word.word}</h1>{word.phonetic && <p className="mt-3 text-lg text-[var(--muted-foreground)]">{word.phonetic}</p>}</div><div className="text-right"><p className="text-2xl font-semibold text-[var(--primary)]">{coreSenses.map((sense) => sense.meaningZh).join("；")}</p><p className="mt-2 text-xs text-[var(--muted-foreground)]">先学 1–2 个核心义项</p></div></div>
          </section>

          <Card className="mt-6"><CardHeader><CardTitle>核心义项</CardTitle></CardHeader><CardContent className="space-y-3">{coreSenses.map((sense) => <div key={sense.id} className="rounded-xl bg-[var(--background)] p-4"><div className="flex items-center gap-2"><Badge variant="outline">{sense.partOfSpeech}</Badge><span className="font-semibold">{sense.meaningZh}</span></div>{sense.definitionEn && <p className="mt-2 text-sm text-[var(--muted-foreground)]">{sense.definitionEn}</p>}</div>)}{moreSenses.length > 0 && <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-semibold">More meanings · {moreSenses.length}</summary><div className="mt-3 space-y-2">{moreSenses.map((sense) => <p key={sense.id} className="text-sm">{sense.meaningZh}</p>)}</div></details>}</CardContent></Card>

          {root ? <Card className="mt-6"><CardHeader><CardTitle className="flex items-center gap-2"><Network className="size-5 text-[var(--primary)]" />构词辅助</CardTitle></CardHeader><CardContent><WordBreakdown word={word} /></CardContent></Card> : <Card className="mt-6"><CardContent className="p-5 text-sm leading-6 text-[var(--muted-foreground)]">这是一个高价值词，但当前没有适合教学的词根拆解。系统保留其高频优先级，不制造伪词根。</CardContent></Card>}

          <div className="mt-6 grid gap-6 md:grid-cols-2"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><BookMarked className="size-4 text-[var(--primary)]" />Word → Phrase</CardTitle></CardHeader><CardContent><ul className="space-y-3">{phrases.map((phrase) => <li key={phrase.id} className="rounded-xl bg-[var(--background)] px-4 py-3"><p className="text-sm font-semibold">{phrase.text}</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">{phrase.meaningZh}</p></li>)}</ul></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><MessageSquareQuote className="size-4 text-[var(--primary)]" />Phrase → Sentence</CardTitle></CardHeader><CardContent className="space-y-4">{sentences.map((sentence) => <div key={sentence.id} className="border-b pb-4 last:border-0 last:pb-0"><div className="flex items-start justify-between gap-3"><p className="font-medium leading-7">{sentence.text}</p><Badge variant="outline">{sentence.qualityScore}</Badge></div><p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">{sentence.translationZh}</p></div>)}</CardContent></Card></div>
        </div>

        <aside className="space-y-5">
          <Card className="border-indigo-200 bg-[var(--primary-soft)]/50"><CardContent className="p-6"><p className="label-caps text-xs font-bold text-[var(--primary)]">Learning value</p><p className="mt-3 text-4xl font-bold">{word.priorityScore}</p><p className="mt-2 text-sm text-[var(--muted-foreground)]">综合词频、通用价值、学术价值、考试相关性、词族与迁移价值。</p>{root && <Button asChild variant="outline" className="mt-5 w-full"><Link href={`/roots/${root.id}`}>查看词根 <ArrowRight className="size-4" /></Link></Button>}</CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">词族统计</CardTitle></CardHeader><CardContent><p className="text-sm text-[var(--muted-foreground)]">Headword: <strong className="text-[var(--foreground)]">{family?.headword ?? word.lemma}</strong></p><div className="mt-3 flex flex-wrap gap-2">{word.family.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}</div></CardContent></Card>
          <Card><CardHeader><CardTitle className="text-base">考试导向相关性</CardTitle></CardHeader><CardContent className="space-y-2 text-sm">{Object.entries(word.examRelevance).map(([key, value]) => <div key={key} className="flex justify-between"><span className="uppercase text-[var(--muted-foreground)]">{key}</span><strong>{value}</strong></div>)}<p className="pt-2 text-xs leading-5 text-[var(--muted-foreground)]">站内学习价值评分，不是官方出现概率。</p></CardContent></Card>
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Link2 className="size-4 text-[var(--primary)]" />相关单词</CardTitle></CardHeader><CardContent className="space-y-2">{word.relatedWords.map((item) => { const exists = getWordById(item); return exists ? <Link key={item} href={`/words/${item}`} className="flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm font-medium"><span>{item}</span><ArrowRight className="size-3.5" /></Link> : <span key={item} className="block rounded-xl border px-3 py-2.5 text-sm text-[var(--muted-foreground)]">{item}</span>; })}</CardContent></Card>
        </aside>
      </div>
    </div>
  );
}
