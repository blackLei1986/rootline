import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Word } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const frequencyLabel = { "very-high": "Very high", high: "High", medium: "Medium", low: "Low" } as const;

export function WordCard({ word }: { word: Word }) {
  return (
    <Link href={`/words/${word.id}`} className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]">
      <Card className="transition-all group-hover:border-indigo-200 group-hover:shadow-md">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-bold tracking-tight">{word.word}</h3>
                <Badge variant={word.frequency.band === "very-high" || word.frequency.band === "high" ? "default" : "secondary"}>{frequencyLabel[word.frequency.band]}</Badge>
              </div>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">{word.partOfSpeech.join(" / ")} · {word.meaningZh.join("；")}</p>
            </div>
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--muted)] text-[var(--muted-foreground)] transition-colors group-hover:bg-[var(--primary)] group-hover:text-white"><ArrowRight className="size-4" /></span>
          </div>
          <div className="mt-5 grid gap-3 border-t pt-4 sm:grid-cols-2">
            <div><span className="text-xs font-medium text-[var(--muted-foreground)]">构词</span><p className="mt-1 font-mono text-sm font-semibold">{word.morphology}</p></div>
            <div><span className="text-xs font-medium text-[var(--muted-foreground)]">字面理解</span><p className="mt-1 text-sm font-medium">{word.literalMeaning}</p></div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
