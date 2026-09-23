import { describe, expect, it } from "vitest";

import { simulateDaily30, type Daily30Candidate } from "@/lib/morphology/daily30-simulator";

function candidate(rootKey: string, index: number, familyKey = `${rootKey}:family-${index}`): Daily30Candidate {
  return {
    catalogWordId: `${rootKey}-${index}`,
    rootKey,
    familyKey,
    frequencyRank: index + 1,
    frequencyBand: "high",
    coverageTags: ["general", "ielts"],
    learningValueScore: 90,
    confidence: "derived",
    reviewStatus: "pending",
    rootPedagogicalConfidence: 90
  };
}

const candidates = ["act", "aud", "bio", "chron"].flatMap((rootKey) => (
  Array.from({ length: 15 }, (_, index) => candidate(rootKey, index + 1))
));

describe("simulateDaily30", () => {
  it("is deterministic, chooses two to four roots, and never repeats a word across days", () => {
    const first = simulateDaily30({ days: 2, candidates });
    const second = simulateDaily30({ days: 2, candidates });

    expect(first).toEqual(second);
    expect(first.days.every((day) => day.rootClusters.length >= 2 && day.rootClusters.length <= 4)).toBe(true);
    expect(new Set(first.days.flatMap((day) => day.selectedWords.map((word) => word.catalogWordId))).size)
      .toBe(first.summary.filledSlots);
  });

  it("reports a quality-preserving shortfall instead of using none-confidence or concentrated families", () => {
    const concentrated = Array.from({ length: 15 }, (_, index) => candidate("act", index + 1, "act:one-family"));
    const report = simulateDaily30({ days: 1, candidates: concentrated });

    expect(report.days[0]).toMatchObject({ filledSlots: 0, shortfall: 30, noneConfidenceFallbackCount: 0 });
    expect(report.days[0]?.qualityWarnings).toContain("family-concentration");
    expect(report.summary.shortfallCauses["family-concentration"]).toBe(30);
    expect(report.readiness).toBe("NOT_READY_FOR_PHASE_1B");
  });

  it("uses a deep root through its daily pool instead of excluding it after fifteen candidates", () => {
    const deep = ["act", "aud"].flatMap((rootKey) => (
      Array.from({ length: 30 }, (_, index) => candidate(rootKey, index + 1))
    ));
    const report = simulateDaily30({ days: 2, candidates: deep });

    expect(report.days.map((day) => day.filledSlots)).toEqual([30, 30]);
    expect(report.days.every((day) => day.rootClusters.length === 2)).toBe(true);
    expect(report.summary.shortfallCauses).toEqual({});
  });

  it("attributes a one-root shortfall to the root-cluster constraint", () => {
    const report = simulateDaily30({ days: 1, candidates: Array.from({ length: 15 }, (_, index) => candidate("act", index + 1)) });

    expect(report.days[0]?.filledSlots).toBe(0);
    expect(report.summary.shortfallCauses["root-cluster-constraint"]).toBe(30);
  });
});
