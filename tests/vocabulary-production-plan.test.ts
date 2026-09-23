import { describe, expect, it } from "vitest";

import { computeProductionTierTargets } from "@/lib/vocabulary-production-plan";
import { excludeProductionLemmas, parseExcludedProductionLemmas } from "@/lib/vocabulary-production-review";

describe("computeProductionTierTargets", () => {
  it("preserves the established tier counts at the 9,000-word baseline", () => {
    expect(computeProductionTierTargets(9_000)).toEqual({
      "tier-1-core": 2_200,
      "tier-2-important": 2_800,
      "tier-3-recognition": 3_000,
      "tier-4-extension": 1_000
    });
  });

  it("allocates a larger target proportionally and deterministically", () => {
    const first = computeProductionTierTargets(9_250);
    expect(first).toEqual({
      "tier-1-core": 2_261,
      "tier-2-important": 2_878,
      "tier-3-recognition": 3_083,
      "tier-4-extension": 1_028
    });
    expect(Object.values(first).reduce((total, count) => total + count, 0)).toBe(9_250);
    expect(computeProductionTierTargets(9_250)).toEqual(first);
  });

  it("keeps the configured 9,500-word ceiling within production-tier gates", () => {
    expect(computeProductionTierTargets(9_500)).toEqual({
      "tier-1-core": 2_322,
      "tier-2-important": 2_956,
      "tier-3-recognition": 3_167,
      "tier-4-extension": 1_055
    });
  });

  it("rejects targets outside the production vocabulary bounds", () => {
    expect(() => computeProductionTierTargets(7_999)).toThrow("between 8,000 and 10,000");
    expect(() => computeProductionTierTargets(10_001)).toThrow("between 8,000 and 10,000");
  });
});

describe("production vocabulary editorial exclusions", () => {
  it("parses normalized exclusion lemmas and filters only exact lemma matches", () => {
    const excluded = parseExcludedProductionLemmas(["--target=9250", "--exclude-lemmas= Cockney, PUSSY, ,"]);
    const candidates = [{ lemma: "cockney" }, { lemma: "pussy" }, { lemma: "puppet" }];

    expect([...excluded]).toEqual(["cockney", "pussy"]);
    expect(excludeProductionLemmas(candidates, excluded)).toEqual([{ lemma: "puppet" }]);
  });
});
