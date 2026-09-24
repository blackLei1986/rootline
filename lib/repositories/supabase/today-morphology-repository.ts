import type { DailyTargetCandidate, DailyTargetMorphology } from "@/lib/today/daily-30-planner";
import { collectPagedRecords } from "@/lib/repositories/supabase/morphology-coverage-repository";
import { throwRepositoryError, type DatabaseClient } from "@/lib/repositories/supabase/shared";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

export type RawTodayMorphologyRoot = { id: string; root_key: string; meaning_en: unknown; meaning_zh: unknown; educational_content: unknown; provenance: unknown };
export type RawTodayMorphologyRecord = {
  catalog_word_id: string; lemma: string; confidence: DailyTargetMorphology["confidence"];
  review_status: DailyTargetMorphology["reviewStatus"]; source: string; family_id: string | null;
  formation_explanation: string | null;
  word_morphology_segments?: Array<{ position: number; kind: "prefix" | "root" | "suffix"; surface_form: string; root_id: string | null; meaning: string | null; explanation: string | null }>;
};
export type RawTodayMorphologyFamily = { id: string; family_key: string; formation_explanation: string | null };

export class SupabaseTodayMorphologyRepository {
  constructor(private readonly client: DatabaseClient) {}

  async getCandidates(vocabulary: readonly ProductionVocabularyEntry[]): Promise<DailyTargetCandidate[]> {
    const dataset = await this.client.from("morphology_datasets")
      .select("id,version").eq("kind", "gold").eq("status", "published")
      .order("published_at", { ascending: false }).limit(1).maybeSingle();
    throwRepositoryError(dataset.error, "load published Today morphology dataset");
    if (!dataset.data) return [];
    const datasetId = (dataset.data as { id: string }).id;

    const [rootResult, familyResult, records] = await Promise.all([
      this.client.from("morphology_roots").select("id,root_key,meaning_en,meaning_zh,educational_content,provenance").eq("dataset_id", datasetId),
      this.client.from("morphology_families").select("id,family_key,formation_explanation").eq("dataset_id", datasetId),
      collectPagedRecords(async (from, to) => {
        const result = await this.client.from("word_morphology_records")
          .select("catalog_word_id,lemma,confidence,review_status,source,family_id,formation_explanation,word_morphology_segments(position,kind,surface_form,root_id,meaning,explanation)")
          .eq("dataset_id", datasetId).order("catalog_word_id").range(from, to);
        throwRepositoryError(result.error, "load Today morphology records");
        return (result.data ?? []) as unknown as RawTodayMorphologyRecord[];
      })
    ]);
    throwRepositoryError(rootResult.error, "load Today morphology roots");
    throwRepositoryError(familyResult.error, "load Today morphology families");
    return mapTodayMorphologyCandidates(vocabulary, {
      roots: (rootResult.data ?? []) as unknown as RawTodayMorphologyRoot[],
      families: (familyResult.data ?? []) as unknown as RawTodayMorphologyFamily[],
      records
    });
  }
}

export function mapTodayMorphologyCandidates(
  vocabulary: readonly ProductionVocabularyEntry[],
  raw: { roots: RawTodayMorphologyRoot[]; families: RawTodayMorphologyFamily[]; records: RawTodayMorphologyRecord[] }
): DailyTargetCandidate[] {
  const entries = new Map(vocabulary.map((entry) => [entry.id, entry]));
  const roots = new Map(raw.roots.map((root) => [root.id, root]));
  const families = new Map(raw.families.map((family) => [family.id, family]));
  return raw.records.flatMap((record) => {
    const entry = entries.get(record.catalog_word_id);
    if (!entry || normalize(record.lemma) !== normalize(entry.lemma)) return [];
    const segments = [...(record.word_morphology_segments ?? [])].sort((a, b) => a.position - b.position);
    const primaryRootId = segments.find((segment) => segment.kind === "root" && segment.root_id)?.root_id;
    const root = primaryRootId ? roots.get(primaryRootId) : undefined;
    const family = record.family_id ? families.get(record.family_id) : undefined;
    const education = object(root?.educational_content);
    const morphology: DailyTargetMorphology = {
      lemma: record.lemma,
      source: record.source,
      confidence: record.confidence,
      reviewStatus: record.review_status,
      rootId: root?.id ?? "",
      rootForm: root?.root_key ?? "",
      rootMeaningEn: strings(root?.meaning_en),
      rootMeaningZh: strings(root?.meaning_zh),
      rootExplanation: stringValue(education.description),
      familyId: family?.id ?? null,
      segments: segments.map((segment) => ({
        kind: segment.kind, surfaceForm: segment.surface_form,
        ...(segment.root_id ? { rootId: segment.root_id } : {}),
        ...(segment.meaning ? { meaning: segment.meaning } : {}),
        ...(segment.explanation ? { explanation: segment.explanation } : {})
      })),
      formationExplanation: record.formation_explanation ?? family?.formation_explanation ?? ""
    };
    const provenance = object(root?.provenance);
    const rootMetadata = object(provenance.rootMetadata);
    const rootRelevanceScore = finiteNumber(rootMetadata.pedagogicalConfidence, 0);
    return [{ entry, morphology, rootRelevanceScore }];
  });
}

function normalize(value: string): string { return value.trim().toLocaleLowerCase("en-US"); }
function object(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function strings(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function stringValue(value: unknown): string { return typeof value === "string" ? value : ""; }
function finiteNumber(value: unknown, fallback: number): number { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }
