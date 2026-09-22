import { z } from "zod";

import type {
  MorphologyImportPersistence,
  MorphologyImportResult
} from "@/lib/morphology/import-runner";
import type {
  MorphologyImportPlan,
  PersistedMorphologyState
} from "@/lib/morphology/import-service";
import {
  throwRepositoryError,
  toJson,
  type DatabaseClient
} from "@/lib/repositories/supabase/shared";

type RawState = {
  datasets: Array<{ id: string; version: string; provenance: unknown }>;
  roots: Array<{ id: string; dataset_id: string; root_key: string; provenance: unknown }>;
  families: Array<{ id: string; dataset_id: string; family_key: string; provenance: unknown }>;
  records: Array<{
    id: string;
    dataset_id: string;
    catalog_word_id: string;
    source: string;
    confidence: "verified" | "derived" | "none";
    review_status: "pending" | "approved" | "rejected";
    provenance: unknown;
    family_id: string | null;
    word_morphology_segments?: Array<{ kind: "prefix" | "root" | "suffix" }>;
  }>;
};

const resultSchema = z.object({
  datasetVersion: z.string(),
  recordsInserted: z.number().int().nonnegative(),
  recordsUpdated: z.number().int().nonnegative(),
  recordsUnchanged: z.number().int().nonnegative(),
  skippedVerified: z.number().int().nonnegative(),
  skippedRejected: z.number().int().nonnegative(),
  auditEventsCreated: z.number().int().nonnegative()
});

export class SupabaseMorphologyImportRepository implements MorphologyImportPersistence {
  constructor(private readonly client: DatabaseClient) {}

  async loadState(): Promise<PersistedMorphologyState> {
    const [datasetsResult, rootsResult, familiesResult, recordsResult] = await Promise.all([
      this.client.from("morphology_datasets").select("id,version,provenance"),
      this.client.from("morphology_roots").select("id,dataset_id,root_key,provenance"),
      this.client.from("morphology_families").select("id,dataset_id,family_key,provenance"),
      this.client
        .from("word_morphology_records")
        .select("id,dataset_id,catalog_word_id,source,confidence,review_status,provenance,family_id,word_morphology_segments(kind)")
    ]);

    throwRepositoryError(datasetsResult.error, "load morphology datasets");
    throwRepositoryError(rootsResult.error, "load morphology roots");
    throwRepositoryError(familiesResult.error, "load morphology families");
    throwRepositoryError(recordsResult.error, "load morphology records");

    return mapPersistedMorphologyState({
      datasets: (datasetsResult.data ?? []) as RawState["datasets"],
      roots: (rootsResult.data ?? []) as RawState["roots"],
      families: (familiesResult.data ?? []) as RawState["families"],
      records: (recordsResult.data ?? []) as unknown as RawState["records"]
    });
  }

  async apply(
    payload: MorphologyImportPlan["payload"],
    actor: string
  ): Promise<MorphologyImportResult> {
    const { data, error } = await this.client.rpc("apply_morphology_import", {
      p_plan: toJson(payload),
      p_actor: actor
    });
    throwRepositoryError(error, "apply morphology import");
    return resultSchema.parse(data);
  }
}

export function mapPersistedMorphologyState(raw: RawState): PersistedMorphologyState {
  const versionByDatasetId = new Map(raw.datasets.map((dataset) => [dataset.id, dataset.version]));
  return {
    datasets: raw.datasets.map((dataset) => ({
      id: dataset.id,
      version: dataset.version,
      contentHash: contentHash(dataset.provenance)
    })),
    roots: raw.roots.map((root) => ({
      id: root.id,
      datasetVersion: requiredDatasetVersion(versionByDatasetId, root.dataset_id),
      rootKey: root.root_key,
      contentHash: contentHash(root.provenance)
    })),
    families: raw.families.map((family) => ({
      id: family.id,
      datasetVersion: requiredDatasetVersion(versionByDatasetId, family.dataset_id),
      familyKey: family.family_key,
      contentHash: contentHash(family.provenance)
    })),
    records: raw.records.map((record) => {
      const segments = record.word_morphology_segments ?? [];
      return {
        id: record.id,
        datasetVersion: requiredDatasetVersion(versionByDatasetId, record.dataset_id),
        catalogWordId: record.catalog_word_id,
        source: record.source,
        confidence: record.confidence,
        reviewStatus: record.review_status,
        contentHash: contentHash(record.provenance),
        segmentCount: segments.length,
        rootRelationCount: segments.filter((segment) => segment.kind === "root").length,
        hasFamilyRelation: record.family_id !== null
      };
    })
  };
}

function contentHash(provenance: unknown): string {
  if (!provenance || typeof provenance !== "object" || Array.isArray(provenance)) return "";
  const value = (provenance as Record<string, unknown>).contentHash;
  return typeof value === "string" ? value : "";
}

function requiredDatasetVersion(versions: ReadonlyMap<string, string>, datasetId: string): string {
  const version = versions.get(datasetId);
  if (!version) throw new Error(`Missing morphology dataset ${datasetId}.`);
  return version;
}
