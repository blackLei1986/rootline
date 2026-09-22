import { describe, expect, it, vi } from "vitest";

import { createGoldDatasetV1 } from "@/lib/morphology/gold-dataset";
import { buildMorphologyImportPlan } from "@/lib/morphology/import-service";
import {
  mapPersistedMorphologyState,
  SupabaseMorphologyImportRepository
} from "@/lib/repositories/supabase/morphology-import-repository";

describe("SupabaseMorphologyImportRepository", () => {
  it("maps persisted rows into content and structured-relation state", () => {
    const state = mapPersistedMorphologyState({
      datasets: [{ id: "dataset-1", version: "gold-v1", provenance: { contentHash: "dataset-hash" } }],
      roots: [{ id: "root-1", dataset_id: "dataset-1", root_key: "spect", provenance: { contentHash: "root-hash" } }],
      families: [{ id: "family-1", dataset_id: "dataset-1", family_key: "gold:inspect", provenance: { contentHash: "family-hash" } }],
      records: [{
        id: "record-1",
        dataset_id: "dataset-1",
        catalog_word_id: "inspect",
        source: "gold-dataset-exact-lemma",
        confidence: "derived",
        review_status: "pending",
        provenance: { contentHash: "record-hash" },
        family_id: "family-1",
        word_morphology_segments: [{ kind: "prefix" }, { kind: "root" }]
      }]
    });

    expect(state).toEqual({
      datasets: [{ id: "dataset-1", version: "gold-v1", contentHash: "dataset-hash" }],
      roots: [{ id: "root-1", datasetVersion: "gold-v1", rootKey: "spect", contentHash: "root-hash" }],
      families: [{ id: "family-1", datasetVersion: "gold-v1", familyKey: "gold:inspect", contentHash: "family-hash" }],
      records: [{
        id: "record-1",
        datasetVersion: "gold-v1",
        catalogWordId: "inspect",
        source: "gold-dataset-exact-lemma",
        confidence: "derived",
        reviewStatus: "pending",
        contentHash: "record-hash",
        segmentCount: 2,
        rootRelationCount: 1,
        hasFamilyRelation: true
      }]
    });
  });

  it("passes the plan payload to the single atomic RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        datasetVersion: "gold-v1",
        recordsInserted: 273,
        recordsUpdated: 0,
        recordsUnchanged: 0,
        skippedVerified: 0,
        skippedRejected: 0,
        auditEventsCreated: 274
      },
      error: null
    });
    const repository = new SupabaseMorphologyImportRepository({ rpc } as never);
    const plan = buildMorphologyImportPlan({
      dataset: createGoldDatasetV1(),
      vocabulary: [],
      persisted: { datasets: [], roots: [], families: [], records: [] }
    });

    const result = await repository.apply(plan.payload, "test-importer");

    expect(rpc).toHaveBeenCalledWith("apply_morphology_import", {
      p_plan: plan.payload,
      p_actor: "test-importer"
    });
    expect(result).toMatchObject({ datasetVersion: "gold-v1", recordsInserted: 273 });
  });
});
