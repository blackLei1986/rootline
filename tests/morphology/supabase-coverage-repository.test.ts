import { describe, expect, it } from "vitest";

import { collectPagedRecords, mapPersistedCoverageData } from "@/lib/repositories/supabase/morphology-coverage-repository";

describe("mapPersistedCoverageData", () => {
  it("collects every page rather than silently truncating a dataset at the provider row limit", async () => {
    const rows = Array.from({ length: 1_001 }, (_, index) => ({ id: index }));
    const calls: number[] = [];

    const actual = await collectPagedRecords(async (from, to) => {
      calls.push(from);
      return rows.slice(from, to + 1);
    });

    expect(actual).toHaveLength(1_001);
    expect(calls).toEqual([0, 1_000]);
  });

  it("reconstructs morphology roots and families from persisted foreign keys", () => {
    const data = mapPersistedCoverageData({
      datasetVersion: "gold-v1",
      roots: [{ id: "root-spect", root_key: "spect", educational_content: { description: "look" }, provenance: { rootMetadata: { pedagogicalConfidence: 90 } } }],
      variants: [{ canonical_root_id: "root-spect", variant_form: "specto", relation: "historical", explanation: "fixture", provenance: { evidence: "fixture" } }],
      families: [{ id: "family-inspect", family_key: "gold:inspect" }],
      records: [{
        catalog_word_id: "inspect",
        confidence: "derived",
        review_status: "pending",
        source: "gold-dataset-exact-lemma",
        provenance: { matchingRule: "exact-lemma", datasetVersion: "gold-v1" },
        family_id: "family-inspect",
        word_morphology_segments: [
          { root_id: null },
          { root_id: "root-spect" },
          { root_id: "root-spect" }
        ]
      }]
    });

    expect(data).toEqual({
      datasetVersion: "gold-v1",
      roots: [{ id: "root-spect", rootKey: "spect", educationalContent: { description: "look" }, provenance: { rootMetadata: { pedagogicalConfidence: 90 } } }],
      variants: [{ rootKey: "spect", form: "specto", relation: "historical", explanation: "fixture", provenance: { evidence: "fixture" } }],
      records: [{
        catalogWordId: "inspect",
        confidence: "derived",
        reviewStatus: "pending",
        source: "gold-dataset-exact-lemma",
        provenance: { matchingRule: "exact-lemma", datasetVersion: "gold-v1" },
        familyKey: "gold:inspect",
        rootKeys: ["spect"]
      }]
    });
  });
});
