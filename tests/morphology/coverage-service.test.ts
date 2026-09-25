import { describe, expect, it } from "vitest";

import { buildPersistedMorphologyCoverageReport } from "@/lib/morphology/coverage-service";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

function vocabulary(id: string, family = id): ProductionVocabularyEntry {
  return {
    id,
    word: id,
    lemma: id,
    wordFamilyId: family,
    surfaceForms: [id],
    partOfSpeech: ["noun"],
    coreMeaningZh: id,
    coreDefinitionEn: id,
    example: id,
    examples: [id],
    frequencyBand: "high",
    frequencyRank: 100,
    learningValueScore: 90,
    contentTier: "tier-1-core",
    learningGoal: "active-use",
    coverageTags: ["general"],
    pipelineStatus: "accepted",
    morphologyConfidence: "none",
    sourceMetadata: {
      frequencySources: [], academicSources: [], examSources: [],
      generatedAt: "2026-09-22T00:00:00Z", generatedBy: "test", confidence: 100
    }
  };
}

describe("buildPersistedMorphologyCoverageReport", () => {
  it("reports production coverage only from persisted morphology rows", () => {
    const report = buildPersistedMorphologyCoverageReport({
      datasetVersion: "gold-v1",
      vocabulary: [
        vocabulary("inspect", "legacy-shared"),
        vocabulary("respect", "legacy-shared"),
        vocabulary("reject"),
        vocabulary("absent-1"),
        vocabulary("absent-2"),
        vocabulary("absent-3")
      ],
      roots: [
        { id: "root-spect", rootKey: "spect" },
        { id: "root-port", rootKey: "port" }
      ],
      records: [
        { catalogWordId: "gold:inspect", confidence: "verified", reviewStatus: "approved", source: "gold-dataset", familyKey: "gold:inspect", rootKeys: ["spect"], provenance: { datasetVersion: "gold-v1" } },
        { catalogWordId: "gold:respect", confidence: "verified", reviewStatus: "approved", source: "gold-dataset", familyKey: "gold:respect", rootKeys: ["spect"], provenance: { datasetVersion: "gold-v1" } },
        { catalogWordId: "inspect", confidence: "verified", reviewStatus: "approved", source: "manual-review", familyKey: "gold:inspect", rootKeys: ["spect"], provenance: { reviewer: "test" } },
        { catalogWordId: "respect", confidence: "derived", reviewStatus: "pending", source: "gold-dataset-exact-lemma", familyKey: "gold:respect", rootKeys: ["spect"], provenance: { matchingRule: "exact-lemma" } },
        { catalogWordId: "reject", confidence: "none", reviewStatus: "rejected", source: "gold-dataset-exact-lemma", familyKey: "gold:reject", rootKeys: ["spect"], provenance: { matchingRule: "exact-lemma" } }
      ]
    });

    expect(report).toMatchObject({
      datasetVersion: "gold-v1",
      totalVocabulary: 6,
      goldRoots: 2,
      goldWords: 2,
      persistedVerified: 1,
      persistedDerived: 1,
      persistedNone: 3,
      rejected: 1,
      morphologyCoveragePercent: 33.33,
      rootsAtLeast5UsableWords: 0,
      rootsAtLeast10UsableWords: 0,
      provenanceDistribution: {
        "gold-dataset": 2,
        "manual-review": 1,
        "gold-dataset-exact-lemma": 2
      },
      datasetVersionDistribution: { "gold-v1": 5 }
    });
    expect(report.roots).toContainEqual({
      rootKey: "spect",
      usableWordCount: 2,
      usableFamilyCount: 2,
      atLeast5UsableWords: false,
      atLeast10UsableWords: false
    });
  });
});
