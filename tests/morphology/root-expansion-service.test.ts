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
  });

  it("sorts by pedagogical value and never adds a substring-only production word", () => {
    const report = buildPersistedRootExpansionReport({ vocabulary, ...persisted });

    expect(report.roots.map((root) => root.rootKey)).toEqual(["act", "aud"]);
    expect(report.roots[0]?.productionExactMatchCount).toBe(3);
    expect(report.roots[0]?.usableProductionWordCount).toBe(3);
  });
});
