import { describe, expect, it } from "vitest";
import { calculateRootValueScore, calculateWordLearningValueScore } from "@/lib/value-scoring";

describe("value scoring", () => {
  it("rewards useful, clear roots and penalizes difficulty", () => {
    const strong = calculateRootValueScore({ frequencyCoverage: 95, usefulWordCount: 90, morphologyClarity: 95, transferValue: 90, learnerDifficulty: 20 });
    const weak = calculateRootValueScore({ frequencyCoverage: 40, usefulWordCount: 30, morphologyClarity: 45, transferValue: 35, learnerDifficulty: 80 });
    expect(strong).toBeGreaterThan(weak);
  });

  it("keeps scores within zero and one hundred", () => {
    expect(calculateWordLearningValueScore({ frequencyScore: 200, utilityScore: 200, familyValue: 200, morphologyClarity: 200, complexityPenalty: 0 })).toBe(100);
    expect(calculateWordLearningValueScore({ frequencyScore: 0, utilityScore: 0, familyValue: 0, morphologyClarity: 0, complexityPenalty: 100 })).toBe(0);
  });
});
