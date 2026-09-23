import type { CoverageTag, FrequencyBand } from "@/types/vocabulary";

export interface Daily30Candidate {
  catalogWordId: string;
  rootKey: string;
  familyKey: string | null;
  frequencyRank: number;
  frequencyBand: FrequencyBand;
  coverageTags: CoverageTag[];
  learningValueScore: number;
  confidence: "verified" | "derived" | "none";
  reviewStatus: "pending" | "approved" | "rejected";
  rootPedagogicalConfidence: number | null;
}

export type Daily30ShortfallCause =
  | "eligible-word-exhaustion"
  | "root-cluster-constraint"
  | "family-concentration"
  | "other-quality-exclusion";

type Daily30QualityWarning = "insufficient-root-capacity" | "family-concentration" | "no-eligible-candidates";
type ShortfallCauses = Partial<Record<Daily30ShortfallCause, number>>;

export interface Daily30SimulationReport {
  days: Array<{
    day: number;
    rootClusters: string[];
    selectedWords: Daily30Candidate[];
    rootWordCounts: Record<string, number>;
    familyWordCounts: Record<string, number>;
    frequencyBandCounts: Partial<Record<FrequencyBand, number>>;
    coverageTagCounts: Partial<Record<CoverageTag, number>>;
    concentration: { maxWordsPerRoot: number; maxWordsPerFamily: number };
    filledSlots: number;
    shortfall: number;
    noneConfidenceFallbackCount: 0;
    qualityWarnings: Daily30QualityWarning[];
    shortfallCauses: ShortfallCauses;
  }>;
  summary: { eligibleCandidates: number; filledSlots: number; targetSlots: number; distinctRoots: number; shortfallCauses: ShortfallCauses };
  readiness: "READY_FOR_PHASE_1B" | "NOT_READY_FOR_PHASE_1B";
  limitingMetrics: string[];
}

export function simulateDaily30({ days = 14, candidates }: { days?: number; candidates: readonly Daily30Candidate[] }): Daily30SimulationReport {
  if (!Number.isInteger(days) || days < 1) throw new Error("days must be a positive integer");
  const eligible = candidates.filter((candidate) => candidate.confidence !== "none" && candidate.reviewStatus !== "rejected");
  const selectedIds = new Set<string>();
  const daily = Array.from({ length: days }, (_, index) => buildDay(index + 1, eligible, selectedIds));
  const filledSlots = daily.reduce((sum, day) => sum + day.filledSlots, 0);
  const distinctRoots = new Set(eligible.map((candidate) => candidate.rootKey)).size;
  const shortfallCauses: ShortfallCauses = {};
  for (const day of daily) {
    for (const [cause, count] of Object.entries(day.shortfallCauses) as Array<[Daily30ShortfallCause, number]>) {
      shortfallCauses[cause] = (shortfallCauses[cause] ?? 0) + count;
    }
  }
  const limitingMetrics: string[] = [];
  if (eligible.length < 420) limitingMetrics.push(`eligible-usable-words:${eligible.length}<420`);
  if (filledSlots < days * 30) limitingMetrics.push(`filled-slots:${filledSlots}<${days * 30}`);
  if (daily.some((day) => day.rootClusters.length < 2 || day.rootClusters.length > 4)) limitingMetrics.push("root-clusters:not-2-to-4");
  if (daily.some((day) => day.qualityWarnings.length > 0)) limitingMetrics.push("quality-warnings:present");
  if (distinctRoots < 2) limitingMetrics.push(`distinct-roots:${distinctRoots}<2`);
  return {
    days: daily,
    summary: { eligibleCandidates: eligible.length, filledSlots, targetSlots: days * 30, distinctRoots, shortfallCauses },
    readiness: limitingMetrics.length === 0 ? "READY_FOR_PHASE_1B" : "NOT_READY_FOR_PHASE_1B",
    limitingMetrics
  };
}

function buildDay(day: number, candidates: readonly Daily30Candidate[], selectedIds: Set<string>): Daily30SimulationReport["days"][number] {
  const remaining = candidates.filter((candidate) => !selectedIds.has(candidate.catalogWordId));
  const byRoot = new Map<string, Daily30Candidate[]>();
  for (const candidate of remaining) {
    const group = byRoot.get(candidate.rootKey) ?? [];
    group.push(candidate);
    byRoot.set(candidate.rootKey, group);
  }
  const warnings: Daily30QualityWarning[] = [];
  const rootGroups = [...byRoot.entries()].map(([rootKey, words]) => ({
    rootKey,
    words: words.sort(candidateOrder).slice(0, 15),
    familyCount: new Set(words.map((word) => word.familyKey ?? `ungrouped:${word.catalogWordId}`)).size,
    pedagogicalConfidence: Math.max(...words.map((word) => word.rootPedagogicalConfidence ?? 0))
  })).filter((group) => group.words.length >= 5);
  const hasFamilyConcentration = rootGroups.some((group) => group.familyCount < 2);
  const viable = rootGroups.filter((group) => group.familyCount >= 2).sort((left, right) => (
    right.familyCount - left.familyCount || right.words.length - left.words.length || right.pedagogicalConfidence - left.pedagogicalConfidence || left.rootKey.localeCompare(right.rootKey, "en")
  ));
  const clusters = viable.slice(0, 4);
  if (clusters.length < 2) {
    const cause: Daily30ShortfallCause = remaining.length === 0
      ? "eligible-word-exhaustion"
      : hasFamilyConcentration
        ? "family-concentration"
        : rootGroups.length < 2
          ? "root-cluster-constraint"
          : "family-concentration";
    if (cause === "eligible-word-exhaustion") warnings.push("no-eligible-candidates");
    else if (cause === "family-concentration") {
      if (!warnings.includes("family-concentration")) warnings.push("family-concentration");
    } else warnings.push("insufficient-root-capacity");
    return { day, rootClusters: [], selectedWords: [], ...selectionMetrics([]), filledSlots: 0, shortfall: 30, noneConfidenceFallbackCount: 0, qualityWarnings: warnings, shortfallCauses: { [cause]: 30 } };
  }
  const selected: Daily30Candidate[] = [];
  const perFamily = new Map<string, number>();
  for (const group of clusters) {
    for (const word of group.words) {
      if (selected.length >= 30) break;
      const key = `${group.rootKey}:${word.familyKey ?? word.catalogWordId}`;
      if ((perFamily.get(key) ?? 0) >= 2) continue;
      selected.push(word);
      selectedIds.add(word.catalogWordId);
      perFamily.set(key, (perFamily.get(key) ?? 0) + 1);
    }
  }
  const shortfall = 30 - selected.length;
  if (shortfall > 0 && !warnings.includes("family-concentration")) warnings.push("family-concentration");
  return {
    day,
    rootClusters: [...new Set(selected.map((word) => word.rootKey))],
    selectedWords: selected,
    ...selectionMetrics(selected),
    filledSlots: selected.length,
    shortfall,
    noneConfidenceFallbackCount: 0,
    qualityWarnings: warnings,
    shortfallCauses: shortfall > 0 ? { "family-concentration": shortfall } : {}
  };
}

function selectionMetrics(selected: readonly Daily30Candidate[]): Pick<Daily30SimulationReport["days"][number], "rootWordCounts" | "familyWordCounts" | "frequencyBandCounts" | "coverageTagCounts" | "concentration"> {
  const rootWordCounts: Record<string, number> = {};
  const familyWordCounts: Record<string, number> = {};
  const frequencyBandCounts: Partial<Record<FrequencyBand, number>> = {};
  const coverageTagCounts: Partial<Record<CoverageTag, number>> = {};
  for (const word of selected) {
    rootWordCounts[word.rootKey] = (rootWordCounts[word.rootKey] ?? 0) + 1;
    const familyKey = word.familyKey ?? `ungrouped:${word.rootKey}:${word.catalogWordId}`;
    familyWordCounts[familyKey] = (familyWordCounts[familyKey] ?? 0) + 1;
    frequencyBandCounts[word.frequencyBand] = (frequencyBandCounts[word.frequencyBand] ?? 0) + 1;
    for (const tag of word.coverageTags) coverageTagCounts[tag] = (coverageTagCounts[tag] ?? 0) + 1;
  }
  return {
    rootWordCounts,
    familyWordCounts,
    frequencyBandCounts,
    coverageTagCounts,
    concentration: {
      maxWordsPerRoot: Math.max(0, ...Object.values(rootWordCounts)),
      maxWordsPerFamily: Math.max(0, ...Object.values(familyWordCounts))
    }
  };
}

function candidateOrder(left: Daily30Candidate, right: Daily30Candidate): number {
  return left.frequencyRank - right.frequencyRank
    || right.learningValueScore - left.learningValueScore
    || left.catalogWordId.localeCompare(right.catalogWordId, "en");
}
