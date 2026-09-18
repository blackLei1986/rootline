import { ArrowDown } from "lucide-react";
import type { Word } from "@/types";
import { getRootById } from "@/data/roots";

export function getWordBreakdownPieces(word: Word): Array<{ form: string; meaning: string }> {
  const rootId = word.rootIds[0];
  const root = rootId ? getRootById(rootId) : undefined;
  const pieces = [
    word.prefix,
    rootId ? { form: rootId, meaning: root?.meaningEn.join(" / ") ?? "root" } : undefined,
    word.suffix
  ].filter((piece): piece is { form: string; meaning: string } => Boolean(piece?.form));
  return pieces.length
    ? pieces
    : [{ form: word.word, meaning: word.meaningEn?.[0] ?? word.meaningZh[0] }];
}

export function WordBreakdown({ word }: { word: Word }) {
  const pieces = getWordBreakdownPieces(word);
  return (
    <div>
      <div className="flex flex-wrap items-stretch gap-2">
        {pieces.map((piece, index) => (
          <div key={`${piece.form}-${index}`} className="min-w-28 flex-1 rounded-xl border bg-[var(--background)] p-4">
            <p className="font-mono text-lg font-bold text-[var(--primary)]">{piece.form.replace(/-$/, "")}</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">{piece.meaning}</p>
          </div>
        ))}
      </div>
      <div className="my-3 flex justify-center text-slate-300"><ArrowDown className="size-5" /></div>
      <div className="rounded-xl bg-[var(--primary-soft)] p-4 text-center">
        <p className="font-medium text-[var(--primary)]">{word.literalMeaning}</p>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">{word.semanticEvolution.join(" → ")}</p>
      </div>
    </div>
  );
}
