import { getWordsByRoot } from "@/data/words";
import { getRootById } from "@/data/roots";
import type { Word } from "@/types";

const tierOrder: Record<Word["rootTier"], number> = { core: 0, extension: 1, advanced: 2 };
const tierLabel: Record<Word["rootTier"], string> = { core: "核心词", extension: "扩展词", advanced: "高级词" };
const tierColor: Record<Word["rootTier"], string> = {
  core: "text-[var(--primary)]",
  extension: "text-indigo-500",
  advanced: "text-slate-400"
};

/**
 * Word-family tree: the root at top, its words nested by tier.
 * Vertically stacked (mobile-first); on desktop the tree line still reads
 * top-to-bottom so a single responsive layout serves both.
 */
export function WordFamilyTree({ rootId }: { rootId: string }) {
  const root = getRootById(rootId);
  if (!root) return null;
  const words = getWordsByRoot(rootId).sort((a, b) => tierOrder[a.rootTier] - tierOrder[b.rootTier]);

  return (
    <div className="overflow-hidden rounded-2xl border bg-white">
      {/* root node */}
      <div className="border-b bg-[#1f2550] px-6 py-5 text-white">
        <p className="font-mono text-3xl font-bold tracking-[-0.04em]">{root.root}</p>
        <p className="mt-1 text-sm text-indigo-200">{root.meaningEn.join(" / ")} · {root.meaningZh.join(" · ")}</p>
      </div>

      <div className="px-6 py-5">
        {words.map((word, index) => {
          const isFirstOfTier = index === 0 || words[index - 1].rootTier !== word.rootTier;
          const isLast = index === words.length - 1;
          const isLastOfTier = isLast || words[index + 1].rootTier !== word.rootTier;
          return (
            <div key={word.id}>
              {isFirstOfTier && (
                <div className="mb-1 mt-3 first:mt-0 flex items-center gap-2">
                  <span className={`label-caps text-xs font-bold ${tierColor[word.rootTier]}`}>{tierLabel[word.rootTier]}</span>
                  <span className="h-px flex-1 bg-[var(--border)]" />
                </div>
              )}
              <div className="flex items-start gap-3 py-2">
                {/* connector column */}
                <div className="flex w-6 shrink-0 flex-col items-center">
                  <span className="text-slate-300">{isFirstOfTier ? "├" : "│"}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-mono font-semibold">{word.word}</span>
                    <span className="text-xs text-[var(--muted-foreground)]">{word.partOfSpeech.join(" / ")}</span>
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--muted-foreground)]">{word.meaningZh.join("；")}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {word.morphology} → <span className="text-slate-500">{word.literalMeaning}</span>
                  </p>
                </div>
              </div>
              {isLastOfTier && !isLast && <div className="ml-3 h-px bg-[var(--border)]" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
