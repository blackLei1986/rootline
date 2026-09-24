import { describe, expect, it, vi } from "vitest";
import { SupabaseDailyReadingMorphologyRepository } from "@/lib/repositories/supabase/daily-reading-morphology-repository";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

const vocabulary = [entry("gold-id", "adapt"), entry("support-id", "ordinary"), entry("bad-lemma-id", "correct")];

function entry(id: string, lemma: string): ProductionVocabularyEntry {
  return {
    id, word: lemma, lemma, wordFamilyId: id, surfaceForms: [lemma], partOfSpeech: ["verb"], coreMeaningZh: `${lemma} 含义`,
    coreDefinitionEn: `${lemma} definition`, example: `${lemma} example`, examples: [`${lemma} example`], frequencyBand: "high",
    frequencyRank: 1, learningValueScore: 80, contentTier: "tier-2-important", learningGoal: "understanding", coverageTags: ["general"],
    pipelineStatus: "accepted", morphologyConfidence: "none", sourceMetadata: { frequencySources: [], academicSources: [], examSources: [], generatedAt: "2026-01-01", generatedBy: "test", confidence: 80 }
  };
}

function makeClient(rows: Record<string, unknown>) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const client = {
    from(table: string) {
      const result = rows[table] ?? { data: [], error: null };
      const query: Record<string, unknown> = {};
      for (const method of ["select", "eq", "in", "order", "limit"]) {
        query[method] = (...args: unknown[]) => { calls.push({ table, method, args }); return query; };
      }
      query.maybeSingle = async () => { calls.push({ table, method: "maybeSingle", args: [] }); return result; };
      query.then = (resolve: (value: unknown) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve(result).then(resolve, reject);
      return query;
    }
  };
  return { client: client as never, calls };
}

describe("Daily-3 published morphology repository", () => {
  it("queries only matched IDs and returns exact-lemma trusted records from the published Gold dataset", async () => {
    const { client, calls } = makeClient({
      morphology_datasets: { data: { id: "published-gold" }, error: null },
      word_morphology_records: { data: [
        record("gold-id", "adapt", "verified", "approved", "reviewed"),
        record("support-id", "ordinary", "none", "pending", "import"),
        record("bad-lemma-id", "mismatch", "verified", "approved", "reviewed")
      ], error: null },
      morphology_roots: { data: [root()], error: null },
      morphology_families: { data: [{ id: "family-1", family_key: "adapt", formation_explanation: "adapt formation" }], error: null }
    });

    const result = await new SupabaseDailyReadingMorphologyRepository(client).getPublishedForWordIds(vocabulary.map((word) => word.id), vocabulary);

    expect(result.get("gold-id")?.morphology).toEqual(expect.objectContaining({ formationExplanation: "adapt formation" }));
    expect(result.has("support-id")).toBe(false);
    expect(result.has("bad-lemma-id")).toBe(false);
    expect(calls).toContainEqual({ table: "word_morphology_records", method: "in", args: ["catalog_word_id", ["gold-id", "support-id", "bad-lemma-id"]] });
    expect(calls).toContainEqual({ table: "morphology_datasets", method: "eq", args: ["kind", "gold"] });
    expect(calls).toContainEqual({ table: "morphology_datasets", method: "eq", args: ["status", "published"] });
  });

  it("returns no morphology and skips dataset reads when there are no non-Today IDs", async () => {
    const { client } = makeClient({});
    const result = await new SupabaseDailyReadingMorphologyRepository(client).getPublishedForWordIds([], vocabulary);
    expect(result.size).toBe(0);
  });
});

function root() {
  return { id: "root-1", root_key: "apt", meaning_en: ["fit"], meaning_zh: ["适合"], educational_content: { description: "fit" }, provenance: { rootMetadata: { pedagogicalConfidence: 90 } } };
}

function record(id: string, lemma: string, confidence: "verified" | "derived" | "none", review_status: "approved" | "pending", source: string) {
  return {
    catalog_word_id: id, lemma, confidence, review_status, source, family_id: "family-1", formation_explanation: null,
    word_morphology_segments: [{ position: 0, kind: "root", surface_form: "apt", root_id: "root-1", meaning: "fit", explanation: "root" }]
  };
}
