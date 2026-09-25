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
    expect(first.days[0]).toMatchObject({
      frequencyBandCounts: { high: 30 },
      coverageTagCounts: { general: 30, ielts: 30 },
      rootWordCounts: { act: 8, aud: 8, bio: 7, chron: 7 },
      concentration: { maxWordsPerRoot: 8, maxWordsPerFamily: 1 }
    });
    expect(Object.values(first.days[0]?.familyWordCounts ?? {})).toHaveLength(30);
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

  it("attributes a shortfall to root capacity when diverse root pools are simply exhausted", () => {
    const report = simulateDaily30({
      days: 1,
      candidates: [...Array.from({ length: 5 }, (_, index) => candidate("act", index + 1)), ...Array.from({ length: 5 }, (_, index) => candidate("aud", index + 1))]
    });

    expect(report.days[0]?.filledSlots).toBe(10);
    expect(report.days[0]?.qualityWarnings).toContain("insufficient-root-capacity");
    expect(report.days[0]?.shortfallCauses).toEqual({ "root-capacity-exhaustion": 20 });
  });

  it("splits mixed shortfalls between family-cap exclusions and exhausted root pools", () => {
    const cappedFamily = Array.from({ length: 3 }, (_, index) => candidate("act", index + 1, "act:one-family"));
    const otherActFamilies = Array.from({ length: 4 }, (_, index) => candidate("act", index + 4));
    const report = simulateDaily30({
      days: 1,
      candidates: [...cappedFamily, ...otherActFamilies, ...Array.from({ length: 5 }, (_, index) => candidate("aud", index + 1))]
    });

    expect(report.days[0]?.filledSlots).toBe(11);
    expect(report.days[0]?.shortfallCauses).toEqual({ "family-concentration": 1, "root-capacity-exhaustion": 18 });
  });

  it("does not mislabel root-pool exhaustion as family concentration when an unusable root is present", () => {
    const oneFamily = Array.from({ length: 15 }, (_, index) => candidate("act", index + 1, "act:one-family"));
    const report = simulateDaily30({
      days: 1,
      candidates: [...oneFamily, ...Array.from({ length: 15 }, (_, index) => candidate("aud", index + 1)), ...Array.from({ length: 5 }, (_, index) => candidate("bio", index + 1))]
    });

    expect(report.days[0]?.qualityWarnings).toEqual(["insufficient-root-capacity"]);
    expect(report.days[0]?.shortfallCauses).toEqual({ "root-capacity-exhaustion": 10 });
  });

  it("preserves scarce viable roots for a later day when scarcity-aware scheduling can fill more slots", () => {
    const scarcityFixture = ["act", "aud"].flatMap((rootKey) => (
      Array.from({ length: 15 }, (_, index) => candidate(rootKey, index + 1))
    )).concat(["bio", "chron"].flatMap((rootKey) => (
      Array.from({ length: 10 }, (_, index) => candidate(rootKey, index + 1))
    )));
    const balanced = simulateDaily30({ days: 2, candidates: scarcityFixture, strategy: "balanced" });
    const scarcityAware = simulateDaily30({ days: 2, candidates: scarcityFixture, strategy: "scarcity-aware" });

    expect(scarcityAware).toEqual(simulateDaily30({ days: 2, candidates: scarcityFixture, strategy: "scarcity-aware" }));
    expect(scarcityAware.summary.filledSlots).toBeGreaterThan(balanced.summary.filledSlots);
    expect(scarcityAware.days.every((day) => day.rootClusters.length >= 2 && day.rootClusters.length <= 4)).toBe(true);
    expect(new Set(scarcityAware.days.flatMap((day) => day.selectedWords.map((word) => word.catalogWordId))).size).toBe(scarcityAware.summary.filledSlots);
  });

  it("maximizes current fill without leaving a partially consumed root in a sub-five stranded pool", () => {
    const fixture = ["a", "b", "c"].flatMap((rootKey) => (
      Array.from({ length: 15 }, (_, index) => candidate(rootKey, index + 1))
    )).concat(Array.from({ length: 10 }, (_, index) => candidate("scarce", index + 1)));

    const report = simulateDaily30({ days: 2, candidates: fixture, strategy: "scarcity-aware" });

    expect(report.summary.filledSlots).toBe(55);
    expect(report.days[0]?.rootClusters).toEqual(["a", "b", "c"]);
    expect(report.days[1]?.rootWordCounts.scarce).toBe(10);
    expect(report.days.flatMap((day) => day.rootClusters).filter((rootKey) => rootKey === "scarce")).toEqual(["scarce"]);
  });

  it("never reduces valid horizon capacity when compared with balanced allocation", () => {
    const diverse = ["act", "aud"].flatMap((rootKey) => (
      Array.from({ length: 15 }, (_, index) => candidate(rootKey, index + 1))
    ));
    const familyLimited = ["bio", "chron"].flatMap((rootKey) => (
      Array.from({ length: 15 }, (_, index) => candidate(rootKey, index + 1, `${rootKey}:family-${Math.floor(index / 3)}`))
    ));
    const balanced = simulateDaily30({ days: 2, candidates: [...diverse, ...familyLimited], strategy: "balanced" });
    const scarcityAware = simulateDaily30({ days: 2, candidates: [...diverse, ...familyLimited], strategy: "scarcity-aware" });

    expect(scarcityAware.summary.filledSlots).toBeGreaterThanOrEqual(balanced.summary.filledSlots);
    expect(["scarcity-aware", "balanced-fallback"]).toContain(scarcityAware.allocationStrategy);
  });
});
