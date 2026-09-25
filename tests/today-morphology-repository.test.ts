import { describe, expect, it } from "vitest";
import { mapTodayMorphologyCandidates } from "@/lib/repositories/supabase/today-morphology-repository";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

describe("Today morphology repository mapping", () => {
  it("maps exact catalog lemmas with root metadata and ordered segments", () => {
    const candidates = mapTodayMorphologyCandidates([entry("inspect")], {
      roots: [{ id: "root-1", root_key: "spect", meaning_en: ["look"], meaning_zh: ["看"], educational_content: { description: "look carefully" }, provenance: {} }],
      families: [{ id: "family-1", family_key: "inspect-family", formation_explanation: "look into" }],
      records: [{
        catalog_word_id: "inspect", lemma: "inspect", confidence: "derived", review_status: "pending",
        source: "gold-dataset-exact-lemma", family_id: "family-1", formation_explanation: "look into",
        word_morphology_segments: [
          { position: 1, kind: "root", surface_form: "spect", root_id: "root-1", meaning: "look", explanation: null },
          { position: 0, kind: "prefix", surface_form: "in-", root_id: null, meaning: "into", explanation: null }
        ]
      }, {
        catalog_word_id: "inspect", lemma: "inspector", confidence: "verified", review_status: "approved",
        source: "manual", family_id: null, formation_explanation: null, word_morphology_segments: []
      }]
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.morphology).toMatchObject({
      lemma: "inspect", rootId: "root-1", rootForm: "spect", familyId: "family-1",
      segments: [{ surfaceForm: "in-" }, { surfaceForm: "spect" }]
    });
  });
});

function entry(id: string): ProductionVocabularyEntry {
  return {
    id, word: id, lemma: id, wordFamilyId: id, surfaceForms: [id], partOfSpeech: ["verb"],
    coreMeaningZh: "检查", coreDefinitionEn: "examine", example: "Inspect the report.", examples: ["Inspect the report."],
    frequencyBand: "high", frequencyRank: 1, learningValueScore: 90, contentTier: "tier-1-core", learningGoal: "understanding",
    coverageTags: ["general"], pipelineStatus: "accepted", morphologyConfidence: "none",
    sourceMetadata: { frequencySources: [{ name: "fixture" }], academicSources: [], examSources: [], generatedAt: "2026-09-23", generatedBy: "test", confidence: 90 }
  };
}
