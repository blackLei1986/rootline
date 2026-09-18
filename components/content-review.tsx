"use client";

import { useState } from "react";
import { Check, RefreshCcw, X } from "lucide-react";
import { significantCandidate } from "@/pipeline/fixtures/significant";
import type { ContentStatus } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ContentReview() {
  const [status, setStatus] = useState<ContentStatus>("needs-review");
  const [revision, setRevision] = useState(1);
  const color: "success" | "destructive" | "warning" = status === "accepted" ? "success" : status === "rejected" ? "destructive" : "warning";
  return (
    <div className="grid gap-6 lg:grid-cols-[250px_1fr]">
      <Card className="h-fit"><CardHeader><CardTitle className="text-base">候选队列</CardTitle></CardHeader><CardContent className="space-y-2">{["pending", "generated", "validated", "needs-review", "accepted", "rejected"].map((item) => <div key={item} className="flex justify-between rounded-lg border px-3 py-2 text-sm"><span>{item}</span><strong>{item === status ? 1 : 0}</strong></div>)}</CardContent></Card>
      <Card className="border-amber-200"><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle>{significantCandidate.word}</CardTitle><p className="mt-1 text-sm text-[var(--muted-foreground)]">revision {revision} · fixture-provider-v1</p></div><Badge variant={color}>{status}</Badge></div></CardHeader><CardContent>
        <div className="grid gap-4 sm:grid-cols-2"><ReviewField label="Core sense" value={significantCandidate.coreMeaningZh} /><ReviewField label="Morphology" value={significantCandidate.morphology} /><ReviewField label="Collocations" value={significantCandidate.collocations.join(" · ")} /><ReviewField label="Sources" value={`${significantCandidate.sourceMetadata.frequencySources.length} frequency · confidence ${significantCandidate.sourceMetadata.confidence}`} /></div>
        <div className="mt-5 space-y-3">{significantCandidate.sentences.map((sentence) => <div key={sentence.text} className="rounded-xl bg-[var(--background)] p-4"><div className="flex justify-between gap-4"><p className="font-medium">{sentence.text}</p><Badge variant="outline">{sentence.naturalnessScore}</Badge></div><p className="mt-1 text-sm text-[var(--muted-foreground)]">{sentence.translationZh}</p></div>)}</div>
        <div className="mt-6 flex flex-wrap gap-3"><Button onClick={() => setStatus("accepted")}><Check className="size-4" />Approve</Button><Button variant="destructive" onClick={() => setStatus("rejected")}><X className="size-4" />Reject</Button><Button variant="outline" onClick={() => { setStatus("generated"); setRevision((value) => value + 1); }}><RefreshCcw className="size-4" />Regenerate</Button></div>
        <p className="mt-4 text-xs text-[var(--muted-foreground)]">此审核页为开发环境原型；正式导入仍由 CLI 质量门与可追踪报告控制。</p>
      </CardContent></Card>
    </div>
  );
}

function ReviewField({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border p-4"><p className="text-xs font-bold text-[var(--muted-foreground)]">{label}</p><p className="mt-2 text-sm leading-6">{value}</p></div>;
}
