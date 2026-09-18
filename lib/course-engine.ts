import { generalEnglishCore } from "@/data/course";
import { roots } from "@/data/roots";
import { getWordsByRoot } from "@/data/words";
import type { CourseStage, CourseUnit } from "@/types/course";
import type { LearningStorage } from "@/types/progress";

export interface StageProgress {
  learnedRoots: number;
  masteredRoots: number;
  totalRoots: number;
  averageMastery: number;
  percent: number;
}

export function getStageProgress(stage: CourseStage, storage: LearningStorage): StageProgress {
  const progress = stage.rootIds.map((rootId) => storage.roots[rootId]);
  const learnedRoots = progress.filter((item) => item?.learnedWordIds.length).length;
  const masteredRoots = progress.filter((item) => item?.status === "mastered" || (item?.mastery ?? 0) >= 70).length;
  const averageMastery = stage.rootIds.length
    ? Math.round(stage.rootIds.reduce((sum, rootId) => sum + (storage.roots[rootId]?.mastery ?? 0), 0) / stage.rootIds.length)
    : 0;
  const coverage = stage.rootIds.length ? learnedRoots / stage.rootIds.length : 0;
  return { learnedRoots, masteredRoots, totalRoots: stage.rootIds.length, averageMastery, percent: Math.round((coverage * 0.4 + averageMastery / 100 * 0.6) * 100) };
}

export function isStageRecommendedUnlocked(stage: CourseStage, previousStage: CourseStage | undefined, storage: LearningStorage): boolean {
  if (!previousStage || !stage.unlockRule) return true;
  const progress = getStageProgress(previousStage, storage);
  return progress.learnedRoots / Math.max(1, progress.totalRoots) >= stage.unlockRule.requiredRootCompletionRatio && progress.averageMastery >= stage.unlockRule.requiredAverageMastery;
}

export function getCurrentStage(storage: LearningStorage): CourseStage {
  const stages = generalEnglishCore.stages;
  return [...stages].reverse().find((stage) => {
    const index = stages.findIndex((item) => item.id === stage.id);
    return isStageRecommendedUnlocked(stage, stages[index - 1], storage);
  }) ?? stages[0];
}

export function getCurrentUnit(storage: LearningStorage): CourseUnit {
  const stage = generalEnglishCore.stages[0];
  return stage.units.find((unit) => unit.rootIds.some((rootId) => (storage.roots[rootId]?.mastery ?? 0) < 60)) ?? stage.units.at(-1)!;
}

export function getRecommendedRoots(storage: LearningStorage, limit = 3) {
  const unit = getCurrentUnit(storage);
  const previousCategory = Object.values(storage.roots)
    .filter((item) => item.lastReviewedAt)
    .sort((a, b) => new Date(b.lastReviewedAt!).getTime() - new Date(a.lastReviewedAt!).getTime())
    .map((item) => roots.find((root) => root.id === item.rootId)?.category)
    .find(Boolean);
  return roots
    .filter((root) => unit.rootIds.includes(root.id) && (storage.roots[root.id]?.mastery ?? 0) < 70)
    .sort((a, b) => {
      const aInterleave = a.category === previousCategory ? -12 : 0;
      const bInterleave = b.category === previousCategory ? -12 : 0;
      const aMastery = storage.roots[a.id]?.mastery ?? 0;
      const bMastery = storage.roots[b.id]?.mastery ?? 0;
      const aPathBonus = Math.max(0, 18 - a.priority);
      const bPathBonus = Math.max(0, 18 - b.priority);
      return (b.rootValueScore + bInterleave + bPathBonus - bMastery * 0.2) - (a.rootValueScore + aInterleave + aPathBonus - aMastery * 0.2);
    })
    .slice(0, limit);
}

export function getRecommendedWords(rootId: string, storage: LearningStorage, limit = 5) {
  const words = getWordsByRoot(rootId);
  const core = words.filter((word) => word.rootTier === "core");
  const learnedCore = core.filter((word) => storage.words[word.id]?.firstLearnedAt).length;
  const allowAdvanced = core.length > 0 && learnedCore / core.length >= 0.8 && (storage.roots[rootId]?.mastery ?? 0) >= 55;
  const seenFamilies = new Set<string>();
  const candidates = words
    .filter((word) => !storage.words[word.id]?.firstLearnedAt)
    .filter((word) => allowAdvanced || word.rootTier !== "advanced")
    .sort((a, b) => {
      const tier = { core: 0, extension: 1, advanced: 2 };
      return tier[a.rootTier] - tier[b.rootTier] || b.learningValueScore - a.learningValueScore || a.staticDifficulty - b.staticDifficulty;
    })
    .filter((word) => {
      if (seenFamilies.has(word.wordFamilyId)) return false;
      seenFamilies.add(word.wordFamilyId);
      return true;
    })
  const coreCandidates = candidates.filter((word) => word.rootTier === "core");
  const priorityPool = coreCandidates.length >= limit ? coreCandidates : candidates;
  const easy = priorityPool.filter((word) => word.staticDifficulty <= 40);
  const medium = priorityPool.filter((word) => word.staticDifficulty > 40 && word.staticDifficulty <= 60);
  const hard = priorityPool.filter((word) => word.staticDifficulty > 60);
  const balanced = [easy[0], easy[1], medium[0], medium[1], hard[0]].filter(Boolean);
  return [...balanced, ...priorityPool.filter((word) => !balanced.includes(word))].slice(0, limit);
}

export function getNextMilestone(storage: LearningStorage): string {
  const unit = getCurrentUnit(storage);
  const mastered = unit.rootIds.filter((rootId) => (storage.roots[rootId]?.mastery ?? 0) >= 60).length;
  const remaining = Math.max(0, unit.rootIds.length - mastered);
  return remaining === 0 ? `完成 ${unit.title} 综合复习` : `再掌握 ${remaining} 个词根，解锁 ${unit.title} 综合复习`;
}
