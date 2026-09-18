"use client";

import { useState } from "react";
import { Bug, Clock3, RotateCcw } from "lucide-react";
import { words } from "@/data/words";
import { useLearningProgress } from "@/hooks/use-learning-progress";
import { setWordDueNow } from "@/lib/learning-actions";
import { createWordProgress, resetProgress, saveProgress } from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function DebugPanel() {
  const storage = useLearningProgress();
  const [wordId, setWordId] = useState(words[0].id);
  const progress = storage.words[wordId] ?? createWordProgress(wordId);

  const handleReset = () => {
    if (window.confirm("确认清空全部本地学习进度？此操作无法撤销。")) resetProgress();
  };

  const simulate = (preset: "beginner" | "intermediate" | "advanced") => {
    if (!window.confirm("这会用模拟学习者覆盖当前单词进度，是否继续？")) return;
    const counts = { beginner: 15, intermediate: 65, advanced: 120 };
    const nextWords = Object.fromEntries(words.slice(0, counts[preset]).map((word, index) => {
      const known = preset === "advanced" || (preset === "intermediate" && index % 3 !== 0);
      const progress = createWordProgress(word.id);
      return [word.id, {
        ...progress,
        status: known ? "review" as const : "learning" as const,
        recognitionState: known ? "known" as const : index % 2 ? "fuzzy" as const : "unknown" as const,
        recognitionConfidence: known ? 85 : 25,
        recognitionCount: 3,
        knownCount: known ? 3 : 0,
        fuzzyCount: known ? 0 : 2,
        unknownCount: known ? 0 : 1,
        verificationCorrectCount: known ? 2 : 0,
        averageResponseTime: known ? 1400 : 4800,
        lastResponseTime: known ? 1200 : 5200,
        fluencyScore: known ? 82 : 24,
        reviewCount: known ? 5 : 1,
        correctCount: known ? 5 : 0,
        wrongCount: known ? 0 : 1,
        memoryStrength: known ? 82 : 18,
        difficulty: known ? 28 : 76,
        firstLearnedAt: new Date().toISOString(),
        nextReviewAt: known ? new Date(Date.now() + 86400000).toISOString() : new Date(Date.now() - 3600000).toISOString()
      }];
    }));
    saveProgress({ ...storage, words: nextWords });
  };

  return <Card className="mt-8 border-dashed border-amber-300 bg-amber-50/40"><CardContent className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="flex items-center gap-2 text-sm font-bold"><Bug className="size-4 text-amber-600" />开发调试面板</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">只在开发环境显示，用于验证推荐、识别与复习调度。</p></div><div className="flex flex-wrap gap-2"><select value={wordId} onChange={(event) => setWordId(event.target.value)} className="h-10 rounded-xl border bg-white px-3 text-sm font-medium">{words.map((word) => <option key={word.id} value={word.id}>{word.word}</option>)}</select><Button size="sm" variant="outline" onClick={() => setWordDueNow(wordId)}><Clock3 className="size-4" />设为立即到期</Button><Button size="sm" variant="outline" onClick={handleReset}><RotateCcw className="size-4" />重置进度</Button></div></div><div className="mt-4 flex flex-wrap gap-2"><span className="self-center text-xs font-semibold text-[var(--muted-foreground)]">模拟：</span><Button size="sm" variant="outline" onClick={() => simulate("beginner")}>Beginner</Button><Button size="sm" variant="outline" onClick={() => simulate("intermediate")}>Intermediate</Button><Button size="sm" variant="outline" onClick={() => simulate("advanced")}>Advanced</Button></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-7"><DebugMetric label="长期状态" value={progress.status} /><DebugMetric label="识别" value={progress.recognitionState ?? "未见"} /><DebugMetric label="识别置信" value={progress.recognitionConfidence} /><DebugMetric label="流利度" value={progress.fluencyScore} /><DebugMetric label="记忆强度" value={progress.memoryStrength} /><DebugMetric label="复习 / 失误" value={`${progress.reviewCount} / ${progress.lapses}`} /><DebugMetric label="下次复习" value={progress.nextReviewAt ? new Date(progress.nextReviewAt).toLocaleString("zh-CN") : "未安排"} /></div></CardContent></Card>;
}

function DebugMetric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-lg border bg-white p-3"><p className="text-[var(--muted-foreground)]">{label}</p><p className="mt-1 break-words font-semibold">{value}</p></div>;
}
