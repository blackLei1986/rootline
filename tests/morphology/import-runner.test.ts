import { describe, expect, it, vi } from "vitest";

import { createGoldDatasetV1 } from "@/lib/morphology/gold-dataset";
import {
  MorphologyImportService,
  type MorphologyImportPersistence
} from "@/lib/morphology/import-runner";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

const vocabulary = [{
  id: "inspect",
  word: "inspect",
  lemma: "inspect",
  wordFamilyId: "legacy-inspect"
}] as ProductionVocabularyEntry[];

function persistence(): MorphologyImportPersistence {
  return {
    loadState: vi.fn().mockResolvedValue({ datasets: [], roots: [], families: [], records: [] }),
    apply: vi.fn().mockResolvedValue({
      datasetVersion: "gold-v1",
      recordsInserted: 151,
      recordsUpdated: 0,
      recordsUnchanged: 0,
      skippedVerified: 0,
      skippedRejected: 0,
      auditEventsCreated: 152
    })
  };
}

describe("MorphologyImportService", () => {
  it("builds a dry-run plan without making any persistence mutation", async () => {
    const repository = persistence();
    const service = new MorphologyImportService(repository);

    const plan = await service.buildPlan({ dataset: createGoldDatasetV1(), vocabulary });

    expect(repository.loadState).toHaveBeenCalledWith("gold-v1");
    expect(repository.apply).not.toHaveBeenCalled();
    expect(plan.summary.derivedCandidates.insert).toBe(1);
  });

  it("applies the exact payload from the already-built plan", async () => {
    const repository = persistence();
    const service = new MorphologyImportService(repository);
    const plan = await service.buildPlan({ dataset: createGoldDatasetV1(), vocabulary });

    const result = await service.applyPlan(plan, "rootline-morphology-importer");

    expect(repository.apply).toHaveBeenCalledTimes(1);
    expect(repository.apply).toHaveBeenCalledWith(plan.payload, "rootline-morphology-importer");
    expect(result.datasetVersion).toBe("gold-v1");
  });

  it("refuses to apply a plan that contains validation errors", async () => {
    const repository = persistence();
    const service = new MorphologyImportService(repository);
    const plan = await service.buildPlan({ dataset: createGoldDatasetV1(), vocabulary });
    plan.errors.push("unsafe plan");

    await expect(service.applyPlan(plan, "rootline-morphology-importer"))
      .rejects.toThrow("unsafe plan");
    expect(repository.apply).not.toHaveBeenCalled();
  });
});
