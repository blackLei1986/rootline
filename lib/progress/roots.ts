import type { WordProgress } from "@/types/progress";
import type { ProgressWordState } from "@/lib/progress/types";

export interface TrustedRootLink { rootId: string; rootKey: string; wordId: string }
export interface RootMasteryRow {
  rootId: string; rootKey: string; usable: number; learned: number; stable: number;
  percent: number | null; weakWordIds: string[];
}

export function aggregateRootMastery(
  links: readonly TrustedRootLink[], states: ReadonlyMap<string, WordProgress>,
  categories: ReadonlyMap<string, ProgressWordState>, now: Date
): RootMasteryRow[] {
  const byRoot = new Map<string, {rootKey: string; words: Set<string>}>();
  for (const link of links) {
    const group = byRoot.get(link.rootId) ?? {rootKey: link.rootKey, words: new Set<string>()};
    group.words.add(link.wordId);
    byRoot.set(link.rootId, group);
  }
  return [...byRoot].map(([rootId, group]) => {
    const words = [...group.words];
    const stable = words.filter((wordId) => categories.get(wordId) === "stable").length;
    const learned = words.filter((wordId) => {
      const category = categories.get(wordId);
      return category === "learning" || category === "stable";
    }).length;
    const weakWordIds = words.filter((wordId) => isWeak(states.get(wordId), now))
      .sort((a, b) => compareWeak(states.get(a)!, states.get(b)!, a, b, now))
      .slice(0, 3);
    return {rootId, rootKey: group.rootKey, usable: words.length, learned, stable,
      percent: words.length ? Math.round(stable / words.length * 100) : null, weakWordIds};
  });
}

function isWeak(state: WordProgress | undefined, now: Date): boolean {
  if (!state) return false;
  return state.lastRating === "again" || state.fsrsState === 3
    || Boolean(state.nextReviewAt && new Date(state.nextReviewAt).getTime() < now.getTime());
}

function compareWeak(a: WordProgress, b: WordProgress, aId: string, bId: string, now: Date): number {
  const aDue = a.nextReviewAt ? Math.max(0, now.getTime() - new Date(a.nextReviewAt).getTime()) : 0;
  const bDue = b.nextReviewAt ? Math.max(0, now.getTime() - new Date(b.nextReviewAt).getTime()) : 0;
  if (aDue !== bDue) return bDue - aDue;
  const aReviewed = a.lastReviewedAt ? new Date(a.lastReviewedAt).getTime() : 0;
  const bReviewed = b.lastReviewedAt ? new Date(b.lastReviewedAt).getTime() : 0;
  if (aReviewed !== bReviewed) return bReviewed - aReviewed;
  return aId.localeCompare(bId);
}
