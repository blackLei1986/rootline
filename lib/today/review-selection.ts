import type { DailyTargetSnapshot, DailyTargetProgressDTO } from "@/types/today";

export type DailyReviewKind = "mini" | "final";

export function selectMiniReviewTargets(targets: readonly DailyTargetSnapshot[], block: 1 | 2 | 3): DailyTargetSnapshot[] {
  const candidates = targets.filter((target) => target.block === block);
  if (candidates.length <= 3) return candidates;
  const indices = [...new Set([0, Math.floor((candidates.length - 1) / 2), candidates.length - 1])];
  return indices.flatMap((index) => candidates[index] ? [candidates[index]] : []);
}

export function selectFinalReviewTargets(
  targets: readonly DailyTargetSnapshot[],
  progress: Readonly<Record<string, DailyTargetProgressDTO>>
): DailyTargetSnapshot[] {
  return targets.filter((target) => {
    const item = progress[target.wordId];
    return item?.recognitionState !== "known"
      || item?.outcomes.association === false
      || item?.outcomes.cloze === false
      || item?.outcomes.recall === false;
  }).slice(0, 5);
}
