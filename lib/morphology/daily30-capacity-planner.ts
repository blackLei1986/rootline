import {
  simulateDaily30,
  type Daily30Candidate,
  type Daily30SchedulingStrategy,
  type Daily30SimulationReport
} from "@/lib/morphology/daily30-simulator";

export type Daily30PlanningStrategy = Daily30SchedulingStrategy;

export interface EffectiveDailyCapacityReport {
  roots: Array<{
    rootKey: string;
    rawUsableCandidates: number;
    effectiveDailyCapacity: number;
    wordsPerFamily: Record<string, number>;
    selectedCandidateIds: string[];
    unusedCandidateIds: string[];
    firstScheduledDay: number | null;
    lastScheduledDay: number | null;
  }>;
  simulationShortfallCauses: Daily30SimulationReport["summary"]["shortfallCauses"];
}

export interface MarginalCapacityGain {
  candidateId: string;
  rootKey: string;
  familyKey: string | null;
  isNewFamily: boolean;
  baselineFilledSlots: number;
  augmentedFilledSlots: number;
  filledSlotGain: number;
}

export function buildEffectiveDailyCapacityReport({
  candidates,
  simulation
}: {
  candidates: readonly Daily30Candidate[];
  simulation: Daily30SimulationReport;
}): EffectiveDailyCapacityReport {
  const selectedDayById = new Map<string, number>();
  for (const day of simulation.days) {
    for (const candidate of day.selectedWords) selectedDayById.set(candidate.catalogWordId, day.day);
  }
  const candidatesByRoot = new Map<string, Daily30Candidate[]>();
  for (const candidate of candidates) {
    if (candidate.confidence === "none" || candidate.reviewStatus === "rejected") continue;
    const rootCandidates = candidatesByRoot.get(candidate.rootKey) ?? [];
    rootCandidates.push(candidate);
    candidatesByRoot.set(candidate.rootKey, rootCandidates);
  }

  return {
    roots: [...candidatesByRoot.entries()].map(([rootKey, rootCandidates]) => {
      const wordsPerFamily = familyCounts(rootCandidates);
      const selectedCandidateIds = rootCandidates
        .filter((candidate) => selectedDayById.has(candidate.catalogWordId))
        .map((candidate) => candidate.catalogWordId)
        .sort((left, right) => left.localeCompare(right, "en"));
      const scheduledDays = selectedCandidateIds
        .flatMap((candidateId) => {
          const day = selectedDayById.get(candidateId);
          return day === undefined ? [] : [day];
        })
        .sort((left, right) => left - right);
      return {
        rootKey,
        rawUsableCandidates: rootCandidates.length,
        effectiveDailyCapacity: Math.min(15, Object.values(wordsPerFamily).reduce((sum, count) => sum + Math.min(2, count), 0)),
        wordsPerFamily,
        selectedCandidateIds,
        unusedCandidateIds: rootCandidates
          .filter((candidate) => !selectedDayById.has(candidate.catalogWordId))
          .map((candidate) => candidate.catalogWordId)
          .sort((left, right) => left.localeCompare(right, "en")),
        firstScheduledDay: scheduledDays[0] ?? null,
        lastScheduledDay: scheduledDays.at(-1) ?? null
      };
    }).sort((left, right) => left.rootKey.localeCompare(right.rootKey, "en")),
    simulationShortfallCauses: { ...simulation.summary.shortfallCauses }
  };
}

export function estimateMarginalCapacityGain({
  candidates,
  candidate,
  days = 14,
  strategy = "balanced"
}: {
  candidates: readonly Daily30Candidate[];
  candidate: Daily30Candidate;
  days?: number;
  strategy?: Daily30PlanningStrategy;
}): MarginalCapacityGain {
  const baseline = simulateDaily30({ days, candidates, strategy });
  const duplicate = candidates.some((existing) => existing.catalogWordId === candidate.catalogWordId);
  const eligible = candidate.confidence !== "none" && candidate.reviewStatus !== "rejected";
  const rootFamilyKeys = new Set(candidates
    .filter((existing) => existing.rootKey === candidate.rootKey)
    .map((existing) => existing.familyKey));
  const augmented = duplicate || !eligible
    ? baseline
    : simulateDaily30({ days, candidates: [...candidates, candidate], strategy });
  return {
    candidateId: candidate.catalogWordId,
    rootKey: candidate.rootKey,
    familyKey: candidate.familyKey,
    isNewFamily: !rootFamilyKeys.has(candidate.familyKey),
    baselineFilledSlots: baseline.summary.filledSlots,
    augmentedFilledSlots: augmented.summary.filledSlots,
    filledSlotGain: augmented.summary.filledSlots - baseline.summary.filledSlots
  };
}

function familyCounts(candidates: readonly Daily30Candidate[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const candidate of candidates) {
    const key = candidate.familyKey ?? `ungrouped:${candidate.rootKey}:${candidate.catalogWordId}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right, "en")));
}
