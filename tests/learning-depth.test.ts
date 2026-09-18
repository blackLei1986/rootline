import { describe, expect, it } from "vitest";
import { getWordById } from "@/data/words";
import { determineLearningDepth, explainLearningDepth } from "@/lib/learning-depth";
import { createWordProgress } from "@/lib/storage";

const significant = getWordById("significant")!;
const portage = getWordById("portage")!;

describe("determineLearningDepth", () => {
  it("skips a verified known word", () => {
    const progress = {
      ...createWordProgress(significant.id),
      recognitionConfidence: 90,
      verificationCorrectCount: 2,
      memoryStrength: 80
    };
    expect(determineLearningDepth({ word: significant, recognitionState: "known", wordProgress: progress })).toBe("skip");
  });

  it("keeps an unverified known word out of deep learning but explains verification", () => {
    const decision = explainLearningDepth({ word: significant, recognitionState: "known" });
    expect(decision.depth).toBe("skip");
    expect(decision.reasons).toContain("known-needs-verification");
  });

  it("uses standard learning for a fuzzy word", () => {
    expect(determineLearningDepth({ word: significant, recognitionState: "fuzzy", difficulty: 60 })).toBe("standard");
  });

  it("uses deep learning for a high-value unknown word", () => {
    expect(determineLearningDepth({ word: significant, recognitionState: "unknown" })).toBe("deep");
  });

  it("keeps a low-value unknown word quick", () => {
    expect(determineLearningDepth({ word: portage, recognitionState: "unknown", learningValueScore: 40, examRelevance: 45 })).toBe("quick");
  });

  it("promotes repeated errors to deep learning", () => {
    expect(determineLearningDepth({ word: portage, recognitionState: "unknown", previousErrors: 2 })).toBe("deep");
  });
});
