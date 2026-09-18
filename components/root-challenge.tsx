"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useLearningProgress } from "@/hooks/use-learning-progress";
import { buildRootChallenge } from "@/lib/learning/root-learning";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/** A daily, deterministic set of unseen words (3–5). */
export function RootChallenge() {
  const storage = useLearningProgress();
  const [items] = useState(() => buildRootChallenge(storage, new Date(), 4));
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  function toggle(wordId: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(wordId)) next.delete(wordId);
      else next.add(wordId);
      return next;
    });
  }

  return (
    <Card className="mt-8 border-amber-200">
      <CardContent className="p-6">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-amber-500" />
          <h3 className="font-bold">今日词根挑战</h3>
          <Badge variant="warning">{items.length} 个陌生词</Badge>
        </div>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">试着用词根猜这些生词，再点开看答案。</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {items.map((item) => {
            const isRevealed = revealed.has(item.wordId);
            return (
              <div key={item.wordId} className="rounded-xl border bg-white p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-lg font-bold tracking-tight">{item.word}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                      词根 <span className="font-semibold text-[var(--primary)]">{item.root}</span> · {item.rootMeaningZh.join(" / ")}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => toggle(item.wordId)}>
                    {isRevealed ? "收起" : "看答案"}
                  </Button>
                </div>
                {isRevealed && (
                  <div className="mt-3 border-t pt-3 text-sm">
                    <p className="font-semibold">{item.meaningZh}</p>
                    <p className="mt-1 text-[var(--muted-foreground)]">字面：{item.literalMeaning}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
