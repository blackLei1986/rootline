import { describe, expect, it } from "vitest";

import { buildPersistedRootExpansionReport } from "@/lib/morphology/root-expansion-service";
import type { PersistedCoverageData } from "@/lib/repositories/supabase/morphology-coverage-repository";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

const vocabulary = [
  { id: "action", lemma: "action", frequencyBand: "high", frequencyRank: 100, learningValueScore: 90, coverageTags: ["general", "ielts"] },
  { id: "active", lemma: "active", frequencyBand: "high", frequencyRank: 120, learningValueScore: 88, coverageTags: ["academic", "ielts"] },
  { id: "activation", lemma: "activation", frequencyBand: "medium", frequencyRank: 800, learningValueScore: 80, coverageTags: ["academic", "toefl"] },
  { id: "audio", lemma: "audio", frequencyBand: "medium", frequencyRank: 900, learningValueScore: 78, coverageTags: ["general"] },
  { id: "noise", lemma: "enactmentish", frequencyBand: "high", frequencyRank: 50, learningValueScore: 99, coverageTags: ["ielts"] }
] as ProductionVocabularyEntry[];

const persisted: PersistedCoverageData = {
  datasetVersion: "gold-v2",
  roots: [
    { id: "root-act", rootKey: "act", educationalContent: {}, provenance: { rootMetadata: { etymologyConfidence: "high", pedagogicalConfidence: 93, riskNotes: "explicit only" } } },
    { id: "root-aud", rootKey: "aud", educationalContent: {}, provenance: { rootMetadata: { etymologyConfidence: "high", pedagogicalConfidence: 80, riskNotes: "explicit only" } } }
  ],
  variants: [{ rootKey: "act", form: "ag", relation: "historical", explanation: "fixture", provenance: {} }],
  records: [
    { catalogWordId: "gold:v2:action", confidence: "verified", reviewStatus: "approved", source: "gold-dataset", familyKey: "act:action", rootKeys: ["act"], provenance: {} },
    { catalogWordId: "gold:v2:active", confidence: "verified", reviewStatus: "approved", source: "gold-dataset", familyKey: "act:action", rootKeys: ["act"], provenance: {} },
    { catalogWordId: "gold:v2:activation", confidence: "verified", reviewStatus: "approved", source: "gold-dataset", familyKey: "act:action", rootKeys: ["act"], provenance: {} },
    { catalogWordId: "action", confidence: "derived", reviewStatus: "pending", source: "gold-dataset-exact-lemma", familyKey: "act:action", rootKeys: ["act"], provenance: {} },
    { catalogWordId: "active", confidence: "derived", reviewStatus: "pending", source: "gold-dataset-exact-lemma", familyKey: "act:action", rootKeys: ["act"], provenance: {} },
    { catalogWordId: "activation", confidence: "derived", reviewStatus: "pending", source: "gold-dataset-exact-lemma", familyKey: "act:action", rootKeys: ["act"], provenance: {} },
    { catalogWordId: "noise", confidence: "derived", reviewStatus: "pending", source: "manual-substring", familyKey: "act:action", rootKeys: ["act"], provenance: {} },
    { catalogWordId: "gold:v2:audio", confidence: "verified", reviewStatus: "approved", source: "gold-dataset", familyKey: "aud:audio", rootKeys: ["aud"], provenance: {} },
    { catalogWordId: "audio", confidence: "derived", reviewStatus: "pending", source: "gold-dataset-exact-lemma", familyKey: "aud:audio", rootKeys: ["aud"], provenance: {} }
  ]
};

describe("buildPersistedRootExpansionReport", () => {
  it("counts distinct usable words and explicit lexical families per canonical root", () => {
    const report = buildPersistedRootExpansionReport({ vocabulary, ...persisted });

    expect(report.roots[0]).toMatchObject({
      rootKey: "act",
      goldWordCount: 3,
      productionExactMatchCount: 3,
      usableProductionWordCount: 3,
      usableProductionFamilyCount: 1,
      highFrequencyCount: 2,
      ieltsTaggedCount: 2,
      variants: ["ag"]
    });
    expect(report.roots[0]).toMatchObject({ capacityTier: "C", wordsPerFamily: { "act:action": 3 } });
  });

  it("sorts by pedagogical value and never adds a substring-only production word", () => {
    const report = buildPersistedRootExpansionReport({ vocabulary, ...persisted });

    expect(report.roots.map((root) => root.rootKey)).toEqual(["act", "aud"]);
    expect(report.roots[0]?.productionExactMatchCount).toBe(3);
    expect(report.roots[0]?.usableProductionWordCount).toBe(3);
  });

  it("assigns capacity tiers only when word depth is supported by enough lexical families", () => {
    const reportFor = (wordCount: number, familyCount: number) => buildPersistedRootExpansionReport({
      datasetVersion: "gold-v3",
      vocabulary: Array.from({ length: wordCount }, (_, index) => ({
        id: `word-${index}`,
        word: `word-${index}`,
        lemma: `word-${index}`,
        wordFamilyId: `word-${index}`,
        surfaceForms: [`word-${index}`],
        partOfSpeech: ["noun"],
        coreMeaningZh: "测试",
        coreDefinitionEn: "test",
        example: "A test word.",
        examples: ["A test word."],
        frequencyBand: "high" as const,
        frequencyRank: index,
        learningValueScore: 90,
        contentTier: "tier-1-core" as const,
        learningGoal: "recognition" as const,
        coverageTags: ["general"],
        pipelineStatus: "accepted" as const,
        morphologyConfidence: "medium" as const,
        sourceMetadata: { frequencySources: [], academicSources: [], examSources: [], generatedAt: "2026-09-23", generatedBy: "test", confidence: 100 }
      })),
      roots: [{ id: "root-test", rootKey: "test", educationalContent: {}, provenance: {} }],
      variants: [],
      records: Array.from({ length: wordCount }, (_, index) => ({
        catalogWordId: `word-${index}`,
        confidence: "derived" as const,
        reviewStatus: "pending" as const,
        source: "gold-dataset-exact-lemma",
        familyKey: `test:family-${index % familyCount}`,
        rootKeys: ["test"],
        provenance: {}
      }))
    }).roots[0]?.capacityTier;

    expect(reportFor(10, 3)).toBe("A");
    expect(reportFor(6, 2)).toBe("B");
    expect(reportFor(6, 1)).toBe("C");
    expect(reportFor(2, 1)).toBe("D");
  });
});
