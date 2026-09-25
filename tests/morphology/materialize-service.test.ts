import { describe, expect, it } from "vitest";

import { materializeExactGoldMatches } from "@/lib/morphology/materialize-service";
import type { GoldDatasetV1 } from "@/lib/morphology/types";

const dataset = {
  version: "gold-v1",
  words: [{ wordId: "curated-inspect", word: "inspect", lemma: "inspect", rootIds: ["spect"], morphology: "in + spect", formationExplanation: "look into", teachingFamily: ["inspect"], prefix: { form: "in", meaning: "into" } }]
} as Pick<GoldDatasetV1, "version" | "words">;

describe("materializeExactGoldMatches", () => {
  it("creates a derived exact-lemma candidate while keeping legacy family data in provenance", () => {
    const result = materializeExactGoldMatches({
      dataset,
      vocabulary: [{ id: "catalog-inspect", word: "inspect", lemma: " INSPECT ", wordFamilyId: "legacy-family", morphologyConfidence: "high" }],
      existing: []
    });
    expect(result.created).toEqual([expect.objectContaining({
      catalogWordId: "catalog-inspect", confidence: "derived", morphologyScore: 100,
      source: "gold-dataset-exact-lemma", datasetVersion: "gold-v1",
      provenance: expect.objectContaining({ legacyWordFamilyId: "legacy-family", matchingRule: "exact-lemma" })
    })]);
    expect(result.created[0]?.familyKey).toBeNull();
  });

  it("does not use spelling lookalikes and preserves stronger or rejected records", () => {
    const result = materializeExactGoldMatches({
      dataset,
      vocabulary: [
        { id: "lookalike", word: "inspection", lemma: "inspection", wordFamilyId: "legacy", morphologyConfidence: "medium" },
        { id: "verified", word: "inspect", lemma: "inspect", wordFamilyId: "legacy", morphologyConfidence: "high" },
        { id: "rejected", word: "inspect", lemma: "inspect", wordFamilyId: "legacy", morphologyConfidence: "high" }
      ],
      existing: [
        { catalogWordId: "verified", datasetVersion: "gold-v1", source: "manual", confidence: "verified", reviewStatus: "approved" },
        { catalogWordId: "rejected", datasetVersion: "gold-v1", source: "gold-dataset-exact-lemma", confidence: "none", reviewStatus: "rejected" }
      ]
    });
    expect(result).toMatchObject({ created: [], skippedVerified: 1, skippedRejected: 1, unchanged: 1 });
  });

  it("allows a later dataset version to generate a new candidate", () => {
    const result = materializeExactGoldMatches({
      dataset: { version: "gold-v2", words: dataset.words },
      vocabulary: [{ id: "catalog-inspect", word: "inspect", lemma: "inspect", wordFamilyId: "legacy", morphologyConfidence: "high" }],
      existing: [{ catalogWordId: "catalog-inspect", datasetVersion: "gold-v1", source: "gold-dataset-exact-lemma", confidence: "none", reviewStatus: "rejected" }]
    });
    expect(result.created).toHaveLength(1);
  });
});
