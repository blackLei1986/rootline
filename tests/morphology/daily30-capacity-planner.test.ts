import { describe, expect, it } from "vitest";

import {
  buildEffectiveDailyCapacityReport,
  estimateMarginalCapacityGain
} from "@/lib/morphology/daily30-capacity-planner";
import { simulateDaily30, type Daily30Candidate } from "@/lib/morphology/daily30-simulator";

function candidate(rootKey: string, index: number, familyKey = `${rootKey}:family-${index}`): Daily30Candidate {
  return {
    catalogWordId: `${rootKey}-${index}`,
    rootKey,
    familyKey,
    frequencyRank: index + 1,
    frequencyBand: "high",
    coverageTags: ["general"],
    learningValueScore: 90,
    confidence: "derived",
    reviewStatus: "pending",
    rootPedagogicalConfidence: 90
  };
}

describe("Daily 30 capacity planner", () => {
  it("keeps raw word count distinct from family-capped effective daily capacity", () => {
    const rootWords = [
      candidate("act", 1, "act:one"),
      candidate("act", 2, "act:one"),
      candidate("act", 3, "act:one"),
      candidate("act", 4, "act:two"),
      candidate("act", 5, "act:two")
    ];
    const simulation = simulateDaily30({ days: 1, candidates: [...rootWords, ...Array.from({ length: 15 }, (_, index) => candidate("aud", index + 1))] });

    expect(buildEffectiveDailyCapacityReport({ candidates: rootWords, simulation }).roots).toEqual([
      expect.objectContaining({ rootKey: "act", rawUsableCandidates: 5, effectiveDailyCapacity: 4, wordsPerFamily: { "act:one": 3, "act:two": 2 } })
    ]);
  });

  it("prioritizes a new family when it creates a real filled-slot gain", () => {
    const constrained = [
      candidate("act", 1, "act:one"), candidate("act", 2, "act:one"), candidate("act", 3, "act:one"),
      candidate("act", 4, "act:two"), candidate("act", 5, "act:three"),
      ...Array.from({ length: 25 }, (_, index) => candidate("aud", index + 1))
    ];

    expect(estimateMarginalCapacityGain({
      candidates: constrained,
      candidate: candidate("act", 6, "act:new-family"),
      days: 1,
      strategy: "balanced"
    }).filledSlotGain).toBe(1);
    expect(estimateMarginalCapacityGain({
      candidates: constrained,
      candidate: candidate("act", 7, "act:one"),
      days: 1,
      strategy: "balanced"
    }).filledSlotGain).toBe(0);
  });
});
