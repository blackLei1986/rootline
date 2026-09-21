import { describe, expect, it } from "vitest";
import { makeWord } from "@/data/word-factory";
import { buildMorphologyCoverageReport } from "@/lib/morphology/audit";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";
import type { Word } from "@/types";

function productionEntry(overrides: Partial<ProductionVocabularyEntry> = {}): ProductionVocabularyEntry {
  return {
    id: "inspect",
    word: "inspect",
    lemma: "inspect",
    wordFamilyId: "inspect",
    surfaceForms: ["inspect", "inspected", "inspecting"],
    partOfSpeech: ["verb"],
    coreMeaningZh: "检查",
    coreDefinitionEn: "examine carefully",
    example: "Inspect the bridge.",
    examples: ["Inspect the bridge."],
    frequencyBand: "high",
    frequencyRank: 10,
    learningValueScore: 95,
    contentTier: "tier-1-core",
    learningGoal: "active-use",
    coverageTags: ["general"],
    pipelineStatus: "accepted",
    morphologyConfidence: "none",
    sourceMetadata: {
      frequencySources: [{ name: "test" }],
      academicSources: [],
      examSources: [],
      generatedAt: "2026-09-21T00:00:00Z",
      generatedBy: "test",
      confidence: 100
    },
    ...overrides
  };
}

function curatedWord(overrides: Partial<Word> = {}): Word {
  return {
    ...makeWord({
    word: "inspect",
    phonetic: "/ɪnˈspekt/",
    partOfSpeech: ["verb"],
    meaningZh: ["检查"],
    meaningEn: ["examine carefully"],
    frequency: "high",
    lemma: "inspect",
    rootIds: ["spect"],
    prefix: { form: "in-", meaning: "into" },
    morphology: "in + spect",
    literalMeaning: "look into",
    family: ["inspection"],
    example: ["Inspect the bridge.", "检查桥梁。"]
    }),
    ...overrides
  };
}

describe("buildMorphologyCoverageReport", () => {
  it("derives a candidate only from an exact curated lemma and preserves the production family id", () => {
    const vocabulary = [productionEntry({ wordFamilyId: "inspection" })];
    const report = buildMorphologyCoverageReport({ vocabulary, curatedWords: [curatedWord()] });

    expect(report.dryRun.derivedCandidateCount).toBe(1);
    expect(report.candidates).toEqual([expect.objectContaining({
      word: "inspect",
      familyId: "inspection",
      primaryRoot: "spect",
      rootIds: ["spect"],
      confidence: "derived",
      morphologyScore: 100,
      source: "gold-dataset-exact-lemma"
    })]);
    expect(vocabulary[0].morphologyConfidence).toBe("none");
  });

  it("leaves a root lookalike without an exact gold match as none", () => {
    const report = buildMorphologyCoverageReport({
      vocabulary: [productionEntry({ id: "inspection", word: "inspection", lemma: "inspection" })],
      curatedWords: [curatedWord()]
    });

    expect(report.dryRun.derivedCandidateCount).toBe(0);
    expect(report.dryRun.noMorphologyCount).toBe(1);
    expect(report.candidates).toEqual([]);
  });

  it("reports root cluster capacity from dry-run candidates without treating one root as one family", () => {
    const report = buildMorphologyCoverageReport({
      vocabulary: [
        productionEntry({ id: "inspect", wordFamilyId: "inspect" }),
        productionEntry({ id: "respect", word: "respect", lemma: "respect", wordFamilyId: "respect" }),
        productionEntry({ id: "unrelated", word: "unrelated", lemma: "unrelated", wordFamilyId: "unrelated" })
      ],
      curatedWords: [
        curatedWord(),
        curatedWord({ id: "respect", word: "respect", lemma: "respect", rootIds: ["spect"], morphology: "re + spect" })
      ]
    });

    expect(report.familyCoverage.derivedFamilyCount).toBe(2);
    expect(report.roots).toEqual([expect.objectContaining({ rootId: "spect", usableWordCount: 2, canFormFiveWordCluster: false, canFormTenWordCluster: false })]);
  });
});
