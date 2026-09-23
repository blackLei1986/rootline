import type { ContentTier } from "@/types";

const baselineTierTargets: Record<ContentTier, number> = {
  "tier-1-core": 2_200,
  "tier-2-important": 2_800,
  "tier-3-recognition": 3_000,
  "tier-4-extension": 1_000
};

const tiers = Object.keys(baselineTierTargets) as ContentTier[];
const baselineTotal = Object.values(baselineTierTargets).reduce((sum, count) => sum + count, 0);

export function computeProductionTierTargets(target: number): Record<ContentTier, number> {
  if (!Number.isInteger(target) || target < 8_000 || target > 10_000) {
    throw new Error("Production vocabulary target must be an integer between 8,000 and 10,000.");
  }

  const exactCounts = tiers.map((tier) => (target * baselineTierTargets[tier]) / baselineTotal);
  const counts = exactCounts.map(Math.floor);
  const remaining = target - counts.reduce((sum, count) => sum + count, 0);
  const priority = tiers
    .map((tier, index) => ({ index, remainder: exactCounts[index] - counts[index] }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  for (const { index } of priority.slice(0, remaining)) {
    counts[index] += 1;
  }

  return Object.fromEntries(tiers.map((tier, index) => [tier, counts[index]])) as Record<ContentTier, number>;
}
