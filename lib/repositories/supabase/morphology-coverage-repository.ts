import type { PersistedCoverageRecord } from "@/lib/morphology/coverage-service";
import { throwRepositoryError, type DatabaseClient } from "@/lib/repositories/supabase/shared";

type RawCoverageData = {
  datasetVersion: string;
  roots: Array<{ id: string; root_key: string }>;
  families: Array<{ id: string; family_key: string }>;
  records: Array<{
    catalog_word_id: string;
    confidence: "verified" | "derived" | "none";
    review_status: "pending" | "approved" | "rejected";
    source: string;
    provenance: unknown;
    family_id: string | null;
    word_morphology_segments?: Array<{ root_id: string | null }>;
  }>;
};

export type PersistedCoverageData = {
  datasetVersion: string;
  roots: Array<{ id: string; rootKey: string }>;
  records: PersistedCoverageRecord[];
};

export class SupabaseMorphologyCoverageRepository {
  constructor(private readonly client: DatabaseClient) {}

  async load(datasetVersion: string): Promise<PersistedCoverageData> {
    const datasetResult = await this.client
      .from("morphology_datasets")
      .select("id,version")
      .eq("version", datasetVersion)
      .maybeSingle();
    throwRepositoryError(datasetResult.error, "load persisted morphology dataset");
    if (!datasetResult.data) {
      throw new Error(`Morphology dataset ${datasetVersion} is not persisted.`);
    }

    const datasetId = datasetResult.data.id;
    const [rootsResult, familiesResult, recordsResult] = await Promise.all([
      this.client.from("morphology_roots").select("id,root_key").eq("dataset_id", datasetId),
      this.client.from("morphology_families").select("id,family_key").eq("dataset_id", datasetId),
      this.client
        .from("word_morphology_records")
        .select("catalog_word_id,confidence,review_status,source,provenance,family_id,word_morphology_segments(root_id)")
        .eq("dataset_id", datasetId)
    ]);
    throwRepositoryError(rootsResult.error, "load persisted morphology roots");
    throwRepositoryError(familiesResult.error, "load persisted morphology families");
    throwRepositoryError(recordsResult.error, "load persisted morphology records");

    return mapPersistedCoverageData({
      datasetVersion,
      roots: (rootsResult.data ?? []) as RawCoverageData["roots"],
      families: (familiesResult.data ?? []) as RawCoverageData["families"],
      records: (recordsResult.data ?? []) as unknown as RawCoverageData["records"]
    });
  }
}

export function mapPersistedCoverageData(raw: RawCoverageData): PersistedCoverageData {
  const rootKeyById = new Map(raw.roots.map((root) => [root.id, root.root_key]));
  const familyKeyById = new Map(raw.families.map((family) => [family.id, family.family_key]));
  return {
    datasetVersion: raw.datasetVersion,
    roots: raw.roots.map((root) => ({ id: root.id, rootKey: root.root_key })),
    records: raw.records.map((record) => ({
      catalogWordId: record.catalog_word_id,
      confidence: record.confidence,
      reviewStatus: record.review_status,
      source: record.source,
      provenance: record.provenance && typeof record.provenance === "object" && !Array.isArray(record.provenance)
        ? record.provenance as Record<string, unknown>
        : {},
      familyKey: record.family_id ? familyKeyById.get(record.family_id) ?? null : null,
      rootKeys: [...new Set(
        (record.word_morphology_segments ?? []).flatMap((segment) => {
          if (!segment.root_id) return [];
          const rootKey = rootKeyById.get(segment.root_id);
          return rootKey ? [rootKey] : [];
        })
      )]
    }))
  };
}
