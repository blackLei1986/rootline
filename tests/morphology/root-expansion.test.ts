import { describe, expect, it } from "vitest";
import { rootExpansionCandidates } from "@/lib/morphology/root-expansion-candidates";

describe("rootExpansionCandidates", () => {
  it("keeps planning-only candidates complete without adding them to Gold data", () => {
    expect(rootExpansionCandidates.length).toBeGreaterThanOrEqual(20);
    expect(rootExpansionCandidates.length).toBeLessThanOrEqual(30);

    for (const candidate of rootExpansionCandidates) {
      expect(candidate.root).not.toHaveLength(0);
      expect(candidate.coreMeaning).not.toHaveLength(0);
      expect(candidate.lexicalCues.length).toBeGreaterThan(0);
      expect(candidate.riskNotes).not.toHaveLength(0);
    }
  });
});
