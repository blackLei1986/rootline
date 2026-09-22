import {
  buildMorphologyImportPlan,
  type MorphologyImportPlan,
  type PersistedMorphologyState
} from "@/lib/morphology/import-service";
import type { GoldDatasetV1 } from "@/lib/morphology/types";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

export interface MorphologyImportResult {
  datasetVersion: string;
  recordsInserted: number;
  recordsUpdated: number;
  recordsUnchanged: number;
  skippedVerified: number;
  skippedRejected: number;
  auditEventsCreated: number;
}

export interface MorphologyImportPersistence {
  loadState(datasetVersion: string): Promise<PersistedMorphologyState>;
  apply(
    payload: MorphologyImportPlan["payload"],
    actor: string
  ): Promise<MorphologyImportResult>;
}

export class MorphologyImportService {
  constructor(private readonly persistence: MorphologyImportPersistence) {}

  async buildPlan({
    dataset,
    vocabulary
  }: {
    dataset: GoldDatasetV1;
    vocabulary: readonly ProductionVocabularyEntry[];
  }): Promise<MorphologyImportPlan> {
    const persisted = await this.persistence.loadState(dataset.version);
    return buildMorphologyImportPlan({ dataset, vocabulary, persisted });
  }

  async applyPlan(
    plan: MorphologyImportPlan,
    actor: string
  ): Promise<MorphologyImportResult> {
    if (plan.errors.length > 0) {
      throw new Error(plan.errors.join("\n"));
    }
    return this.persistence.apply(plan.payload, actor);
  }
}
