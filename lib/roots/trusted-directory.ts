import type {TrustedRootLink} from "@/lib/progress/roots";
import type {ProgressWordState} from "@/lib/progress/types";

export interface TrustedRootRow {
  rootKey: string;
  wordIds: string[];
  usable: number;
  learned: number;
  stable: number;
}

export function buildTrustedRootDirectory(links: readonly TrustedRootLink[], categories: ReadonlyMap<string, ProgressWordState>): TrustedRootRow[] {
  const grouped = new Map<string, Set<string>>();
  for (const {rootKey, wordId} of links) {
    const words = grouped.get(rootKey) ?? new Set<string>();
    words.add(wordId);
    grouped.set(rootKey, words);
  }
  return [...grouped].map(([rootKey, words]) => {
    const wordIds = [...words].sort((a, b) => a.localeCompare(b));
    return {rootKey, wordIds, usable: wordIds.length,
      learned: wordIds.filter((id) => categories.get(id) === "learning" || categories.get(id) === "stable").length,
      stable: wordIds.filter((id) => categories.get(id) === "stable").length};
  }).sort((a, b) => a.rootKey.localeCompare(b.rootKey));
}
