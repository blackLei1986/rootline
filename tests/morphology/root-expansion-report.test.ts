import { describe, expect, it } from "vitest";

import { buildRootExpansionReadinessReport } from "@/lib/morphology/root-expansion-report";
import type { RootExpansionCandidate } from "@/lib/morphology/types";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

function entry(
  lemma: string,
  frequencyRank: number,
  coverageTags: ProductionVocabularyEntry["coverageTags"] = ["general"]
): ProductionVocabularyEntry {
  return {
    id: lemma,
    word: lemma,
    lemma,
    wordFamilyId: lemma,
    surfaceForms: [lemma],
    partOfSpeech: ["noun"],
    coreMeaningZh: lemma,
    coreDefinitionEn: lemma,
    example: `${lemma} example`,
    examples: [`${lemma} example`],
    frequencyBand: "high",
    frequencyRank,
    learningValueScore: 90,
    contentTier: "tier-1-core",
    learningGoal: "active-use",
    coverageTags,
    pipelineStatus: "accepted",
    morphologyConfidence: "none",
    sourceMetadata: {
      frequencySources: [], academicSources: [], examSources: [],
      generatedAt: "2026-09-22T00:00:00Z", generatedBy: "test", confidence: 100
    }
  };
}

const proposals: RootExpansionCandidate[] = [
  { root: "act", coreMeaning: "do", lexicalCues: ["act", "action", "active"], pedagogicalClarity: 92, riskNotes: "Avoid substring guesses." },
  { root: "aud", coreMeaning: "hear", lexicalCues: ["audio", "audible"], pedagogicalClarity: 90, riskNotes: "Review sound changes." }
];

describe("buildRootExpansionReadinessReport", () => {
  it("uses exact configured lexical cues and real production metadata", () => {
    const report = buildRootExpansionReadinessReport({
      vocabulary: [
        entry("act", 10, ["general"]),
        entry("action", 20, ["general", "ielts"]),
        entry("enact", 30, ["general"]),
        entry("audio", 40, ["academic"])
      ],
      proposals,
      minimumReadyCandidates: 1,
      minimumEvidenceWords: 2
    });

    expect(report.status).toBe("sufficient");
    expect(report.candidates[0]).toMatchObject({
      root: "act",
      exactEvidenceCount: 2,
      examples: [
        expect.objectContaining({ lemma: "act", frequencyRank: 10 }),
        expect.objectContaining({ lemma: "action", frequencyRank: 20 })
      ],
      tagDistribution: { general: 2, academic: 0, ielts: 1, toefl: 0 }
    });
    expect(report.candidates[0]?.examples.map((example) => example.lemma)).not.toContain("enact");
  });

  it("reports insufficient evidence rather than inventing root matches", () => {
    const report = buildRootExpansionReadinessReport({
      vocabulary: [entry("enact", 30)],
      proposals,
      minimumReadyCandidates: 1,
      minimumEvidenceWords: 2
    });

    expect(report.status).toBe("insufficient-evidence");
    expect(report.candidates).toEqual([]);
  });
});
