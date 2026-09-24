import { trustedDailyTargetMorphology } from "@/lib/today/daily-30-planner";
import { mapTodayMorphologyCandidates, type RawTodayMorphologyFamily, type RawTodayMorphologyRecord, type RawTodayMorphologyRoot } from "@/lib/repositories/supabase/today-morphology-repository";
import { throwRepositoryError, type DatabaseClient } from "@/lib/repositories/supabase/shared";
import type { DailyTargetCandidate } from "@/lib/today/daily-30-planner";
import type { DailyTargetSnapshot } from "@/types/today";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

export class SupabaseDailyReadingMorphologyRepository {
  constructor(private readonly client: DatabaseClient) {}

  async getPublishedForWordIds(wordIds: readonly string[], vocabulary: readonly ProductionVocabularyEntry[]): Promise<Map<string, DailyTargetSnapshot>> {
    const wantedIds = [...new Set(wordIds)].filter((id) => vocabulary.some((entry) => entry.id === id));
    if (wantedIds.length === 0) return new Map();

    const datasetResult = await this.client.from("morphology_datasets")
      .select("id,version").eq("kind", "gold").eq("status", "published")
      .order("published_at", { ascending: false }).limit(1).maybeSingle();
    throwRepositoryError(datasetResult.error, "load published Daily-3 morphology dataset");
    if (!datasetResult.data) return new Map();
    const datasetId = (datasetResult.data as { id: string }).id;

    const recordsResult = await this.client.from("word_morphology_records")
      .select("catalog_word_id,lemma,confidence,review_status,source,family_id,formation_explanation,word_morphology_segments(position,kind,surface_form,root_id,meaning,explanation)")
      .eq("dataset_id", datasetId).in("catalog_word_id", wantedIds);
    throwRepositoryError(recordsResult.error, "load matched Daily-3 morphology records");
    const records = (recordsResult.data ?? []) as unknown as RawTodayMorphologyRecord[];
    const rootIds = [...new Set(records.flatMap((record) => (record.word_morphology_segments ?? []).flatMap((segment) => segment.root_id ? [segment.root_id] : [])))];
    const familyIds = [...new Set(records.flatMap((record) => record.family_id ? [record.family_id] : []))];
    const [rootResult, familyResult] = await Promise.all([
      rootIds.length ? this.client.from("morphology_roots").select("id,root_key,meaning_en,meaning_zh,educational_content,provenance").eq("dataset_id", datasetId).in("id", rootIds) : Promise.resolve({ data: [], error: null }),
      familyIds.length ? this.client.from("morphology_families").select("id,family_key,formation_explanation").eq("dataset_id", datasetId).in("id", familyIds) : Promise.resolve({ data: [], error: null })
    ]);
    throwRepositoryError(rootResult.error, "load matched Daily-3 morphology roots");
    throwRepositoryError(familyResult.error, "load matched Daily-3 morphology families");

    const matchedVocabulary = vocabulary.filter((entry) => wantedIds.includes(entry.id));
    const candidates = mapTodayMorphologyCandidates(matchedVocabulary, {
      roots: (rootResult.data ?? []) as unknown as RawTodayMorphologyRoot[],
      families: (familyResult.data ?? []) as unknown as RawTodayMorphologyFamily[],
      records
    });
    const output = new Map<string, DailyTargetSnapshot>();
    for (const candidate of candidates) {
      const morphology = trustedDailyTargetMorphology(candidate);
      if (!morphology) continue;
      output.set(candidate.entry.id, toDailyTargetSnapshot(candidate, morphology));
    }
    return output;
  }
}

function toDailyTargetSnapshot(candidate: DailyTargetCandidate, morphology: NonNullable<DailyTargetSnapshot["morphology"]> & { rootId?: string; rootForm?: string; rootMeaningEn?: string[]; rootMeaningZh?: string[]; rootExplanation?: string | null; familyId?: string | null }): DailyTargetSnapshot {
  const entry = candidate.entry;
  return {
    wordId: entry.id, word: entry.word, lemma: entry.lemma, coreMeaningZh: entry.coreMeaningZh,
    coreDefinitionEn: entry.coreDefinitionEn, ...(entry.phonetic ? { phonetic: entry.phonetic } : {}),
    partOfSpeech: [...entry.partOfSpeech], example: entry.example, examples: [...entry.examples], source: "root-core",
    rootId: morphology.rootId ?? null, rootForm: morphology.rootForm ?? null,
    rootMeaningEn: morphology.rootMeaningEn ?? [], rootMeaningZh: morphology.rootMeaningZh ?? [],
    rootExplanation: morphology.rootExplanation ?? null, familyId: morphology.familyId ?? null,
    morphology: { segments: morphology.segments.map((segment) => ({ ...segment })), formationExplanation: morphology.formationExplanation },
    block: 1, position: 0
  };
}
