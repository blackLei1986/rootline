import type { PersistedCoverageRecord } from "@/lib/morphology/coverage-service";
import { throwRepositoryError, type DatabaseClient } from "@/lib/repositories/supabase/shared";

type RawCoverageData = {
  datasetVersion: string;
  roots: Array<{ id: string; root_key: string; educational_content: unknown; provenance: unknown }>;
  variants: Array<{
    canonical_root_id: string;
    variant_form: string;
    relation: "historical" | "pedagogical";
    explanation: string;
    provenance: unknown;
  }>;
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
  roots: Array<{
    id: string;
    rootKey: string;
    educationalContent: Record<string, unknown>;
    provenance: Record<string, unknown>;
  }>;
  variants: Array<{
    rootKey: string;
    form: string;
    relation: "historical" | "pedagogical";
    explanation: string;
    provenance: Record<string, unknown>;
  }>;
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
    const [rootsResult, variantsResult, familiesResult, records] = await Promise.all([
      this.client.from("morphology_roots").select("id,root_key,educational_content,provenance").eq("dataset_id", datasetId),
      this.client.from("morphology_root_variants").select("canonical_root_id,variant_form,relation,explanation,provenance").eq("dataset_id", datasetId),
      this.client.from("morphology_families").select("id,family_key").eq("dataset_id", datasetId),
      collectPagedRecords(async (from, to) => {
        const result = await this.client
          .from("word_morphology_records")
          .select("catalog_word_id,confidence,review_status,source,provenance,family_id,word_morphology_segments(root_id)")
          .eq("dataset_id", datasetId)
          .range(from, to);
        throwRepositoryError(result.error, "load persisted morphology records");
        return (result.data ?? []) as unknown as RawCoverageData["records"];
      })
    ]);
    throwRepositoryError(rootsResult.error, "load persisted morphology roots");
    throwRepositoryError(variantsResult.error, "load persisted morphology root variants");
    throwRepositoryError(familiesResult.error, "load persisted morphology families");

    return mapPersistedCoverageData({
      datasetVersion,
      roots: (rootsResult.data ?? []) as RawCoverageData["roots"],
      variants: (variantsResult.data ?? []) as RawCoverageData["variants"],
      families: (familiesResult.data ?? []) as RawCoverageData["families"],
      records
    });
  }
}

const recordPageSize = 1_000;

export async function collectPagedRecords<T>(
  fetchPage: (from: number, to: number) => Promise<readonly T[]>
): Promise<T[]> {
  const records: T[] = [];
  for (let from = 0; ; from += recordPageSize) {
    const page = await fetchPage(from, from + recordPageSize - 1);
    records.push(...page);
    if (page.length < recordPageSize) return records;
  }
}

export function mapPersistedCoverageData(raw: RawCoverageData): PersistedCoverageData {
  const rootKeyById = new Map(raw.roots.map((root) => [root.id, root.root_key]));
  const familyKeyById = new Map(raw.families.map((family) => [family.id, family.family_key]));
  return {
    datasetVersion: raw.datasetVersion,
    roots: raw.roots.map((root) => ({
      id: root.id,
      rootKey: root.root_key,
      educationalContent: asObject(root.educational_content),
      provenance: asObject(root.provenance)
    })),
    variants: raw.variants.flatMap((variant) => {
      const rootKey = rootKeyById.get(variant.canonical_root_id);
      if (!rootKey) return [];
      return [{
        rootKey,
        form: variant.variant_form,
        relation: variant.relation,
        explanation: variant.explanation,
        provenance: asObject(variant.provenance)
      }];
    }),
    records: raw.records.map((record) => ({
      catalogWordId: record.catalog_word_id,
      confidence: record.confidence,
      reviewStatus: record.review_status,
      source: record.source,
      provenance: asObject(record.provenance),
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

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
