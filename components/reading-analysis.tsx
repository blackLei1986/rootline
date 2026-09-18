"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BookMarked, Check, CircleHelp, Eye, Gauge, GraduationCap, Library, Search, X } from "lucide-react";
import { getWordById } from "@/data/words";
import { analyzeReadingDocument } from "@/lib/reading/analyze";
import { recordReadingEncounter } from "@/lib/reading-actions";
import { readingStorage } from "@/lib/reading-storage";
import { recordWordRecognition } from "@/lib/recognition-progress";
import { loadProgress } from "@/lib/storage";
import type { ReadingDocument, ReadingKnowledgeState, ReadingVocabularyItem } from "@/types/reading";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const stateLabel: Record<ReadingKnowledgeState, string> = { fluent: "已掌握", known: "认识", fuzzy: "模糊", unknown: "不会", untracked: "待确认" };
const bandLabel = { "must-learn": "优先学习", "worth-learning": "建议学习", "can-infer": "可推断", ignore: "暂不处理" } as const;

function Metric({ value, label, detail }: { value: string | number; label: string; detail?: string }) {
  return <div className="rounded-2xl border bg-white p-4"><p className="text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs font-semibold text-[var(--muted-foreground)]">{label}</p>{detail && <p className="mt-1 text-xs text-[var(--muted-foreground)]">{detail}</p>}</div>;
}

export function ReadingAnalysis() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [document, setDocument] = useState<ReadingDocument | null>(null);
  const [selected, setSelected] = useState<ReadingVocabularyItem | null>(null);
  const [tab, setTab] = useState<"article" | "vocabulary" | "phrases" | "patterns">("article");
  const [query, setQuery] = useState("");
  const [queued, setQueued] = useState(0);
  const [finished, setFinished] = useState(false);
  const [savedSentence, setSavedSentence] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => { setDocument(readingStorage.getDocument(params.id)); setQueued(readingStorage.getQueue(params.id).length); }, 0);
    return () => window.clearTimeout(timer);
  }, [params.id]);
  const vocabularyByWord = useMemo(() => new Map(document?.vocabulary.map((item) => [item.wordId, item]) ?? []), [document]);

  function refreshAnalysis() {
    if (!document) return;
    const next = analyzeReadingDocument({ id: document.id, text: document.text, title: document.title, sourceType: document.sourceType, storage: loadProgress(), now: new Date(document.createdAt) });
    readingStorage.saveDocument(next); setDocument(next);
    if (selected) setSelected(next.vocabulary.find((item) => item.wordId === selected.wordId) ?? null);
  }

  function chooseWord(item: ReadingVocabularyItem) {
    setSelected(item); setSavedSentence(false); recordReadingEncounter(item.wordId, "lookup", params.id);
    const progress = readingStorage.getProgress(params.id);
    if (progress && !progress.clickedWordIds.includes(item.wordId)) readingStorage.saveProgress({ ...progress, clickedWordIds: [...progress.clickedWordIds, item.wordId] });
  }

  function classify(state: "known" | "fuzzy" | "unknown") {
    if (!selected) return;
    recordWordRecognition(selected.wordId, state, 1500, state === "known", `reading-${params.id}`);
    refreshAnalysis();
  }

  function addItems(items: ReadingVocabularyItem[]) {
    if (!document) return;
    readingStorage.enqueue(items.map((item) => ({ documentId: document.id, wordId: item.wordId, contextSentence: item.contextSentence, contextImportance: item.contextImportance, recommendationScore: item.recommendationScore, status: "pending" })));
    items.forEach((item) => recordReadingEncounter(item.wordId, "learn", document.id));
    setQueued(readingStorage.getQueue(document.id).length);
  }

  function saveContextSentence(item: ReadingVocabularyItem) {
    if (!document) return;
    readingStorage.saveSentence({ id: `${document.id}-${item.wordId}-${item.contextSentence.length}`, documentId: document.id, text: item.contextSentence, targetWordIds: [item.wordId], createdAt: new Date().toISOString() });
    setSavedSentence(true);
  }

  function finishReading() {
    if (!document) return;
    const now = new Date(); const current = readingStorage.getProgress(document.id);
    if (current) readingStorage.saveProgress({ ...current, completedAt: now.toISOString(), readingSeconds: Math.max(1, Math.round((now.getTime() - new Date(current.startedAt).getTime()) / 1000)), coverageAfter: document.coverage.contentWordCoverage, unknownAfter: document.coverage.unknownContentWords });
    setFinished(true);
  }

  if (!document) return <div className="page-shell py-20 text-center"><p className="text-xl font-semibold">没有找到这篇文章</p><p className="mt-2 text-[var(--muted-foreground)]">它可能已被删除，或只保存在另一台设备上。</p><Button asChild className="mt-6"><Link href="/reading">分析新文章</Link></Button></div>;

  const recommended = document.vocabulary.filter((item) => item.recommendation === "must-learn" || item.recommendation === "worth-learning").slice(0, 15);
  const queryCount = query.trim() ? document.tokens.filter((token) => token.normalized === query.toLowerCase().trim() || token.lemma === query.toLowerCase().trim()).length : 0;
  const progress = readingStorage.getProgress(document.id);
  const wpm = progress?.readingSeconds ? Math.round(document.wordCount / (progress.readingSeconds / 60)) : null;

  return (
    <div className="page-shell py-8 sm:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3"><Link href="/reading" className="flex items-center gap-2 text-sm font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]"><ArrowLeft className="size-4" />分析另一篇</Link><Link href="/reading/library" className="flex items-center gap-2 text-sm font-semibold text-[var(--muted-foreground)]"><Library className="size-4" />文章库</Link></div>
      <div className="rounded-3xl bg-[#202653] p-6 text-white shadow-xl shadow-indigo-950/10 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-indigo-200"><span>{document.sourceType}</span><span>·</span><span>{new Date(document.createdAt).toLocaleDateString("zh-CN")}</span></div><h1 className="mt-3 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">{document.title ?? "Untitled Reading"}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100">你的内容词覆盖率约为 {document.coverage.contentWordCoverage}%。这是估算结果，用于定位可能影响理解的词汇缺口。</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" className="border-white/20 bg-white/10 text-white hover:bg-white/15" onClick={() => addItems(recommended)}><BookMarked className="size-4" />加入推荐词</Button><Button asChild className="bg-white text-[#202653] hover:bg-indigo-50"><Link href={`/reading/${document.id}/learn`}>学习这篇文章 <ArrowRight className="size-4" /></Link></Button></div></div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-6"><Metric value={document.wordCount} label="文章词数" /><Metric value={`${document.coverage.contentWordCoverage}%`} label="内容词覆盖率" /><Metric value={`${document.unknownDensity}`} label="每 100 内容词缺口" /><Metric value={`${document.academicVocabularyRatio}%`} label="学术词比例" /><Metric value={recommended.length} label="推荐词" detail={`队列 ${queued} 个`} /><Metric value={document.difficultyLabel} label="个人难度" detail={`${document.userDifficulty} / 100`} /></div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-b"><div className="flex gap-1">{(["article", "vocabulary", "phrases", "patterns"] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`border-b-2 px-4 py-3 text-sm font-semibold ${tab === item ? "border-indigo-600 text-indigo-700" : "border-transparent text-[var(--muted-foreground)]"}`}>{item === "article" ? "文章" : item === "vocabulary" ? `词汇 ${document.vocabulary.length}` : item === "phrases" ? `短语 ${document.phrases.length}` : `句型 ${document.patterns.length}`}</button>)}</div><label className="mb-2 flex h-10 items-center gap-2 rounded-xl border bg-white px-3 text-sm"><Search className="size-4 text-[var(--muted-foreground)]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索文章内词汇" className="w-36 outline-none" />{query && <span className="text-xs font-bold text-indigo-600">{queryCount} 次</span>}</label></div>

      {tab === "article" && <div className={`mt-6 grid gap-6 ${selected ? "lg:grid-cols-[1fr_340px]" : ""}`}><Card><CardContent className="p-6 sm:p-10"><div className="mb-6 flex flex-wrap gap-4 text-xs text-[var(--muted-foreground)]"><span><span className="mr-1 inline-block w-5 border-b-2 border-dashed border-amber-400" />模糊</span><span><span className="mr-1 inline-block w-5 border-b-2 border-rose-500" />不会</span><span><span className="mr-1 inline-block w-5 border-b border-dotted border-indigo-400" />待确认</span></div><article className="whitespace-pre-wrap font-serif text-[18px] leading-9 text-slate-800">{(() => { let cursor = 0; const parts = document.tokens.map((token) => { const before = document.text.slice(cursor, token.start); cursor = token.end; const item = token.wordId ? vocabularyByWord.get(token.wordId) : undefined; const activeSearch = query && (token.normalized === query.toLowerCase().trim() || token.lemma === query.toLowerCase().trim()); return <Fragment key={token.id}>{before}{item ? <button onClick={() => chooseWord(item)} className={`rounded-sm px-0.5 transition-colors hover:bg-indigo-100 ${activeSearch ? "bg-yellow-200" : ""} ${token.knowledgeState === "fuzzy" ? "border-b-2 border-dashed border-amber-400" : token.knowledgeState === "unknown" ? "border-b-2 border-rose-500" : token.knowledgeState === "untracked" ? "border-b border-dotted border-indigo-400" : ""}`}>{token.token}</button> : <span className={activeSearch ? "bg-yellow-200" : ""}>{token.token}</span>}</Fragment>; }); return <>{parts}{document.text.slice(cursor)}</>; })()}</article></CardContent></Card>
        {selected && <aside className="lg:sticky lg:top-24 lg:h-fit"><Card className="border-indigo-200 shadow-lg"><CardContent className="p-6">{(() => { const word = getWordById(selected.wordId)!; return <><div className="flex items-start justify-between"><div><p className="text-2xl font-bold">{word.word}</p><p className="mt-1 text-sm text-[var(--muted-foreground)]">{word.phonetic}</p></div><button onClick={() => setSelected(null)} aria-label="关闭"><X className="size-5 text-[var(--muted-foreground)]" /></button></div><div className="mt-4 flex gap-2"><Badge>{stateLabel[selected.knowledgeState]}</Badge><Badge variant="outline">{bandLabel[selected.recommendation]}</Badge></div><div className="mt-5"><p className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">语境核心义</p><p className="mt-2 text-lg font-semibold">{word.meaningZh[0]}</p><p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">{selected.contextSentence}</p></div>{word.collocations[0] && <div className="mt-5"><p className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">常用搭配</p><p className="mt-2 text-sm font-semibold">{word.collocations.slice(0, 2).join(" · ")}</p></div>}<div className="mt-5"><p className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">构词线索</p><p className="mt-2 text-sm"><span className="font-semibold">{word.morphology || word.word}</span> · {word.literalMeaning || "核心词义"}</p></div><div className="mt-5 grid grid-cols-2 gap-2 text-center text-xs"><div className="rounded-xl bg-indigo-50 p-3"><p className="text-lg font-bold text-indigo-700">{selected.recommendationScore}</p>推荐分</div><div className="rounded-xl bg-amber-50 p-3"><p className="text-lg font-bold text-amber-700">{selected.occurrences}</p>文章内出现</div></div><div className="mt-5 grid grid-cols-3 gap-2"><Button size="sm" variant="outline" onClick={() => classify("known")}><Check className="size-3.5" />认识</Button><Button size="sm" variant="outline" onClick={() => classify("fuzzy")}><CircleHelp className="size-3.5" />模糊</Button><Button size="sm" variant="outline" onClick={() => classify("unknown")}><X className="size-3.5" />不会</Button></div><Button className="mt-2 w-full" onClick={() => addItems([selected])}><BookMarked className="size-4" />加入学习</Button></>; })()}</CardContent></Card></aside>}
      </div>}
      {tab === "article" && selected && <div className="mt-3 flex justify-end"><Button variant="ghost" onClick={() => saveContextSentence(selected)}>{savedSentence ? <Check className="size-4" /> : <BookMarked className="size-4" />}{savedSentence ? "已保存为个人原句" : "保存当前原句"}</Button></div>}

      {tab === "vocabulary" && <div className="mt-6 space-y-2">{document.vocabulary.map((item) => { const word = getWordById(item.wordId)!; return <button key={item.wordId} onClick={() => { chooseWord(item); setTab("article"); }} className="grid w-full grid-cols-[1fr_auto] items-center gap-4 rounded-2xl border bg-white p-4 text-left transition hover:border-indigo-300 sm:grid-cols-[1.2fr_1fr_100px_100px]"><div><p className="font-bold">{word.word} <span className="ml-2 font-normal text-[var(--muted-foreground)]">{word.meaningZh[0]}</span></p><p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">{item.contextSentence}</p></div><span className="hidden text-sm text-[var(--muted-foreground)] sm:block">{stateLabel[item.knowledgeState]}</span><span className="hidden text-sm font-semibold sm:block">{item.occurrences} 次</span><Badge variant="outline">{item.recommendationScore} 分</Badge></button>; })}</div>}
      {tab === "phrases" && <div className="mt-6 grid gap-3 sm:grid-cols-2">{document.phrases.length ? document.phrases.map((phrase, index) => <Card key={`${phrase.phraseId}-${index}`}><CardContent className="p-5"><p className="font-bold">{phrase.text}</p><p className="mt-2 text-sm text-[var(--muted-foreground)]">出现在第 {phrase.sentenceIndex + 1} 句 · 已采用最长匹配</p></CardContent></Card>) : <p className="col-span-2 rounded-2xl border bg-white p-8 text-center text-[var(--muted-foreground)]">这篇文章暂未匹配到现有短语库。</p>}</div>}
      {tab === "patterns" && <div className="mt-6 grid gap-3 sm:grid-cols-2">{document.patterns.length ? document.patterns.map((pattern, index) => <Card key={`${pattern.patternId}-${index}`}><CardContent className="p-5"><p className="font-bold">{pattern.text}</p><p className="mt-2 text-sm text-[var(--muted-foreground)]">出现在第 {pattern.sentenceIndex + 1} 句</p></CardContent></Card>) : <p className="col-span-2 rounded-2xl border bg-white p-8 text-center text-[var(--muted-foreground)]">这篇文章暂未匹配到现有句型库。</p>}</div>}

      <Card className="mt-7 border-emerald-200 bg-emerald-50/40"><CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2 font-semibold text-emerald-800"><Eye className="size-4" />阅读闭环</div><p className="mt-2 text-sm text-emerald-900/70">学习推荐词后回到这里重读，覆盖率与高亮会按统一 WordProgress 重新计算。</p>{finished && <p className="mt-2 text-sm font-semibold text-emerald-800"><Check className="mr-1 inline size-4" />已记录本次阅读{wpm ? ` · 估算 ${wpm} WPM` : ""}</p>}</div><div className="flex gap-2"><Button variant="outline" onClick={() => { refreshAnalysis(); router.refresh(); }}><Gauge className="size-4" />重新计算</Button><Button onClick={finishReading}><GraduationCap className="size-4" />完成阅读</Button></div></CardContent></Card>
      {process.env.NODE_ENV === "development" && <details className="mt-6 rounded-2xl border bg-white p-5 text-sm"><summary className="cursor-pointer font-semibold">Reading Analysis Debug</summary><div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><span>Tokens {document.tokens.length}</span><span>Lemmas {document.uniqueLemmaCount}</span><span>Matched {document.tokens.filter((token) => token.status === "matched").length}</span><span>Unmatched {document.tokens.filter((token) => token.status === "unknown").length}</span><span>Proper nouns {document.tokens.filter((token) => token.status === "proper-noun").length}</span><span>Phrases {document.phrases.length}</span><span>Patterns {document.patterns.length}</span><span>Recommended {recommended.length}</span></div><div className="mt-4 max-h-56 overflow-auto rounded-xl bg-slate-950 p-3 font-mono text-[11px] leading-5 text-slate-200">{document.tokens.slice(0, 80).map((token) => <div key={token.id}>{token.token} → {token.lemma ?? "—"} · {token.wordId ?? token.status} · {token.knowledgeState}</div>)}</div></details>}
    </div>
  );
}
