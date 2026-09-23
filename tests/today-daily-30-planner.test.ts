import { describe, expect, it } from "vitest";
import { buildDailyTargets, type DailyTargetCandidate } from "@/lib/today/daily-30-planner";
import type { DailyTargetSnapshot } from "@/types/today";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

function candidate(
  index: number,
  options: Partial<Pick<DailyTargetCandidate, "weakPriority" | "rootRelevanceScore" | "morphology">> & {
    rootId?: string;
    familyId?: string;
    coverageTags?: ProductionVocabularyEntry["coverageTags"];
  } = {}
): DailyTargetCandidate {
  const word = `word${index}`;
  return {
    entry: {
      id: word,
      word,
      lemma: word,
      wordFamilyId: options.familyId ?? `family-${index}`,
      surfaceForms: [word],
      partOfSpeech: ["noun"],
      coreMeaningZh: `含义${index}`,
      coreDefinitionEn: `definition ${index}`,
      example: `Example ${index}.`,
      examples: [`Example ${index}.`],
      frequencyBand: "high",
      frequencyRank: index + 1,
      learningValueScore: 90 - index,
      contentTier: "tier-2-important",
      learningGoal: "understanding",
      coverageTags: options.coverageTags ?? ["general"],
      pipelineStatus: "accepted",
      morphologyConfidence: "none",
      sourceMetadata: { frequencySources: [], academicSources: [], examSources: [], generatedAt: "2026-09-23", generatedBy: "test", confidence: 100 }
    },
    weakPriority: options.weakPriority,
    rootRelevanceScore: options.rootRelevanceScore,
    morphology: options.morphology ?? (options.rootId ? {
      lemma: word,
      source: "manual-review",
      rootId: options.rootId,
      rootForm: options.rootId,
      rootMeaningEn: ["move"],
      rootMeaningZh: ["移动"],
      rootExplanation: "a reliable root",
      confidence: "verified",
      reviewStatus: "approved",
      familyId: options.familyId ?? `family-${index}`,
      segments: [{ kind: "root", surfaceForm: options.rootId, rootId: options.rootId }],
      formationExplanation: `formed from ${options.rootId}`
    } : null)
  };
}

function carryover(index: number): DailyTargetSnapshot {
  const word = `carry${index}`;
  return {
    wordId: word,
    word,
    lemma: word,
    coreMeaningZh: "旧目标",
    coreDefinitionEn: "previous target",
    example: "A previous example.",
    examples: ["A previous example."],
    partOfSpeech: ["noun"],
    source: "root-core",
    rootId: "root-old",
    rootForm: "old",
    rootMeaningEn: ["old"],
    rootMeaningZh: ["旧"],
    rootExplanation: "trusted preview",
    familyId: "old-family",
    morphology: { segments: [{ kind: "root", surfaceForm: "old", rootId: "root-old" }], formationExplanation: "old formation" },
    block: 1,
    position: index
  };
}

describe("buildDailyTargets", () => {
  it("allocates up to 30 unique words across three stable blocks, preferring carryover and weak targets", () => {
    const targets = buildDailyTargets({
      carryoverTargets: [carryover(0), carryover(1)],
      weakCandidates: [candidate(2, { weakPriority: 10 }), candidate(3, { weakPriority: 5 })],
      rootCoreCandidates: Array.from({ length: 30 }, (_, index) => candidate(index + 10, { rootId: `root-${index % 3}`, familyId: `family-${index}`, rootRelevanceScore: 80 })),
      supportCandidates: Array.from({ length: 30 }, (_, index) => candidate(index + 50))
    });

    expect(targets).toHaveLength(30);
    expect(targets.map((target) => target.wordId)).toEqual([...new Set(targets.map((target) => target.wordId))]);
    expect(targets.slice(0, 4).map((target) => target.source)).toEqual(["carryover", "carryover", "weak", "weak"]);
    expect(targets.map((target) => target.block)).toEqual([
      ...Array(10).fill(1), ...Array(10).fill(2), ...Array(10).fill(3)
    ]);
    expect(targets.map((target) => target.position)).toEqual(Array.from({ length: 30 }, (_, index) => index));
    expect(targets[0]).toMatchObject({ source: "carryover", originSource: "root-core", rootId: "root-old" });
  });

  it("limits weak allocation, filters unreliable morphology, and fills remaining slots with morphology-free Support Words", () => {
    const invalidMorphology = candidate(2, { rootId: "root-fake", morphology: {
      lemma: "different-lemma", source: "gold-dataset-exact-lemma", rootId: "root-fake", rootForm: "fake", rootMeaningEn: ["fake"], rootMeaningZh: ["伪"], rootExplanation: "not exact",
      confidence: "derived", reviewStatus: "pending", familyId: "legacy-family", segments: [], formationExplanation: "not trusted"
    } });
    const rootCore = Array.from({ length: 20 }, (_, index) => candidate(index + 10, { rootId: `root-${index % 3}`, familyId: `family-${index}`, rootRelevanceScore: 80 }));
    const weak = Array.from({ length: 7 }, (_, index) => candidate(index + 100, { weakPriority: 10 - index }));
    const support = [candidate(2), ...Array.from({ length: 8 }, (_, index) => candidate(index + 60))];

    const targets = buildDailyTargets({ carryoverTargets: [], weakCandidates: weak, rootCoreCandidates: [...rootCore, invalidMorphology], supportCandidates: support });

    expect(targets).toHaveLength(30);
    expect(targets.filter((target) => target.source === "weak")).toHaveLength(5);
    expect(targets.filter((target) => target.source === "root-core")).toHaveLength(20);
    expect(targets.find((target) => target.wordId === "word2")).toMatchObject({ source: "support", rootId: null, familyId: null, morphology: null });
  });

  it("returns only available unique words rather than fabricating or duplicating a full 30", () => {
    const targets = buildDailyTargets({
      carryoverTargets: [carryover(0)],
      weakCandidates: [candidate(1, { weakPriority: 1 })],
      rootCoreCandidates: [candidate(2, { rootId: "root-1" })],
      supportCandidates: [candidate(1), candidate(3)]
    });

    expect(targets.map((target) => target.wordId)).toEqual(["carry0", "word1", "word2", "word3"]);
    expect(targets.map((target) => target.source)).toEqual(["carryover", "weak", "root-core", "support"]);
  });

  it("accepts exact-lemma Gold morphology projections that remain pending review", () => {
    const goldProjection = candidate(90, { rootId: "root-gold", morphology: {
      lemma: "word90", rootId: "root-gold", rootForm: "gold", rootMeaningEn: ["value"], rootMeaningZh: ["价值"], rootExplanation: "curated Gold entry",
      confidence: "derived", reviewStatus: "pending", source: "gold-dataset-exact-lemma", familyId: "gold-family",
      segments: [{ kind: "root", surfaceForm: "gold", rootId: "root-gold" }], formationExplanation: "curated Gold formation"
    } });

    const [target] = buildDailyTargets({ carryoverTargets: [], weakCandidates: [], rootCoreCandidates: [goldProjection], supportCandidates: [] });

    expect(target).toMatchObject({ source: "root-core", rootId: "root-gold", morphology: { formationExplanation: "curated Gold formation" } });
  });
});
