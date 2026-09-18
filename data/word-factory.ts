import { calculateWordLearningValueScore } from "@/lib/value-scoring";
import { calculateVocabularyPriorityScore } from "@/lib/vocabulary-scoring";
import { VALIDATION_VERSION } from "@/config/vocabulary-scoring";
import type { CefrLevel, ContentTier, CoverageTag, ExamRelevance, FrequencyBand, MorphologyConfidence, PipelineStatus, RootTier, VocabularyBand, VocabularyGoalType, Word, WordVariant } from "@/types";

export interface WordSeed {
  word: string;
  phonetic?: string;
  partOfSpeech: string[];
  meaningZh: string[];
  meaningEn?: string[];
  frequency: FrequencyBand;
  rootIds: string[];
  prefix?: { form: string; meaning: string };
  suffix?: { form: string; meaning: string };
  morphology: string;
  literalMeaning: string;
  semanticEvolution?: string[];
  mnemonic?: string;
  collocations?: string[];
  family?: string[];
  relatedWords?: string[];
  example?: [string, string];
  examples?: Array<[string, string]>;
  rootTier?: RootTier;
  lemma?: string;
  cefr?: CefrLevel;
  vocabularyBand?: VocabularyBand;
  coverageTags?: CoverageTag[];
  examRelevance?: ExamRelevance;
  variants?: WordVariant;
  memoryHook?: string;
  synonyms?: string[];
  antonyms?: string[];
  confusableWith?: string[];
  staticDifficulty?: number;
  relationConfidence?: "high" | "medium" | "low";
  learningGoal?: VocabularyGoalType;
  activePriority?: number;
  contentTier?: ContentTier;
  pipelineStatus?: PipelineStatus;
  morphologyConfidence?: MorphologyConfidence;
}

const frequencyScore: Record<FrequencyBand, number> = {
  "very-high": 100,
  high: 84,
  medium: 62,
  low: 35
};

const tierOverrides: Record<string, RootTier> = {
  perspective: "extension", aspect: "extension", retrospect: "advanced", portfolio: "extension",
  dictator: "advanced", contradiction: "extension", prediction: "extension", predictable: "extension"
};
const lemmaOverrides: Record<string, string> = {
  dictation: "dictate", dictator: "dictate", contradiction: "contradict", prediction: "predict", predictable: "predict"
};

export function makeWord(seed: WordSeed): Word {
  const rootTier = seed.rootTier ?? tierOverrides[seed.word] ?? (seed.frequency === "low" ? "advanced" : seed.frequency === "medium" ? "extension" : "core");
  const family = seed.family ?? [seed.word];
  const morphologyClarity = seed.morphology.includes(" + ") ? 92 : 72;
  const complexityPenalty = Math.min(85, Math.max(5, (seed.word.length - 5) * 6 + (seed.meaningZh.length - 1) * 8));
  const metrics = {
    frequencyScore: frequencyScore[seed.frequency],
    utilityScore: rootTier === "core" ? 90 : rootTier === "extension" ? 70 : 48,
    familyValue: Math.min(100, 48 + family.length * 10),
    morphologyClarity,
    complexityPenalty
  };
  const lemma = seed.lemma ?? lemmaOverrides[seed.word] ?? seed.word;
  const relatedWords = seed.word === "dictionary"
    ? (seed.relatedWords ?? []).filter((wordId) => wordId !== "dictum")
    : seed.relatedWords ?? [];
  const vocabularyBand = seed.vocabularyBand ?? (seed.frequency === "very-high" ? "core-1000" : seed.frequency === "high" ? "core-2000" : seed.frequency === "medium" ? "core-3000" : rootTier === "advanced" ? "advanced" : "core-5000");
  const coverageTags = seed.coverageTags ?? (rootTier === "core" ? ["general"] : rootTier === "extension" ? ["general", "academic"] : ["academic"]);
  const examRelevance = seed.examRelevance ?? {
    general: metrics.frequencyScore,
    academic: rootTier === "core" ? 62 : rootTier === "extension" ? 76 : 70,
    ielts: rootTier === "advanced" ? 64 : 74,
    toefl: rootTier === "advanced" ? 68 : 74
  };
  const examples = seed.examples ?? (seed.example ? [seed.example] : []);
  const priorityMetrics = {
    frequency: metrics.frequencyScore,
    generalUtility: metrics.utilityScore,
    academicUtility: examRelevance.academic,
    examRelevance: Math.round((examRelevance.ielts + examRelevance.toefl) / 2),
    familyValue: metrics.familyValue,
    transferValue: metrics.morphologyClarity,
    contextUtility: Math.min(100, 55 + (seed.collocations?.length ?? 0) * 8 + examples.length * 8),
    difficulty: seed.staticDifficulty ?? complexityPenalty
  };
  const phraseIds = (seed.collocations ?? []).map((_, index) => `phrase-${seed.word}-${index + 1}`);
  const sentenceIds = examples.map((_, index) => `sentence-${seed.word}-${index + 1}`);
  const activeUseCandidate = seed.partOfSpeech.some((part) => part === "verb" || part === "adjective") &&
    metrics.frequencyScore >= 84 &&
    Math.max(examRelevance.ielts, examRelevance.toefl, examRelevance.academic) >= 80;
  const learningGoal = seed.learningGoal ?? (
    activeUseCandidate
      ? "active-use"
      : rootTier === "advanced" || seed.frequency === "low"
        ? "recognition"
        : "understanding"
  );
  const activePriority = seed.activePriority ?? (
    learningGoal === "active-use"
      ? Math.round(metrics.utilityScore * 0.4 + metrics.frequencyScore * 0.35 + Math.max(examRelevance.ielts, examRelevance.toefl, examRelevance.academic) * 0.25)
      : learningGoal === "understanding"
        ? Math.round(metrics.utilityScore * 0.25 + metrics.frequencyScore * 0.2)
        : 0
  );
  const contentTier = seed.contentTier ?? (
    vocabularyBand === "core-1000" || vocabularyBand === "core-2000" ? "tier-1-core"
      : vocabularyBand === "core-3000" || vocabularyBand === "core-5000" ? "tier-2-important"
        : vocabularyBand === "academic" ? "tier-3-recognition" : "tier-4-extension"
  );
  const pipelineStatus = seed.pipelineStatus ?? (examples.length > 0 ? "accepted" : "review");
  const morphologyConfidence = seed.morphologyConfidence ?? (
    seed.rootIds.length && seed.morphology.includes(" + ") ? "high"
      : seed.rootIds.length ? "medium"
        : seed.morphology && seed.morphology !== seed.word ? "medium" : "none"
  );
  return {
    ...seed,
    id: seed.word,
    frequency: { band: seed.frequency, confidence: 55, source: "Rootline editorial seed" },
    cefr: seed.cefr,
    vocabularyBand,
    coverageTags,
    examRelevance,
    priorityMetrics,
    priorityScore: calculateVocabularyPriorityScore(priorityMetrics),
    variants: seed.variants,
    rootTier,
    learningMetrics: metrics,
    learningValueScore: calculateWordLearningValueScore(metrics),
    learningGoal,
    activePriority,
    contentTier,
    pipelineStatus,
    morphologyConfidence,
    staticDifficulty: seed.staticDifficulty ?? Math.min(95, Math.max(20, complexityPenalty + (rootTier === "advanced" ? 20 : rootTier === "extension" ? 8 : 0))),
    lemma,
    wordFamilyId: lemma,
    senses: seed.meaningZh.map((meaningZh, index) => ({
      id: `${seed.word}-${index + 1}`,
      partOfSpeech: seed.partOfSpeech[Math.min(index, seed.partOfSpeech.length - 1)] ?? seed.partOfSpeech[0] ?? "word",
      meaningZh,
      definitionEn: seed.meaningEn?.[index],
      isCore: index < 2,
      usageFrequency: index === 0 ? 100 : Math.max(30, 75 - index * 15),
      cefr: seed.cefr,
      exampleSentenceIds: index === 0 ? sentenceIds : [],
      collocationIds: index === 0 ? phraseIds : []
    })),
    rootRelations: seed.rootIds.map((rootId) => ({
      wordId: seed.word,
      rootId,
      confidence: seed.relationConfidence ?? (seed.word === "portfolio" ? "medium" : "high"),
      relationType: "teaching" as const
    })),
    related: relatedWords.map((wordId) => ({ wordId, type: "same-root" as const })),
    synonyms: seed.synonyms ?? [],
    antonyms: seed.antonyms ?? [],
    confusableWith: seed.confusableWith,
    semanticEvolution: seed.semanticEvolution ?? [seed.literalMeaning, seed.meaningZh[0]],
    collocations: seed.collocations ?? [],
    phraseIds,
    sentenceIds,
    examples: examples.map(([en, zh]) => ({ en, zh })),
    memoryHook: seed.memoryHook ?? seed.mnemonic,
    sourceMetadata: {
      frequencySources: [{ name: "Rootline editorial seed", version: "stage-1" }],
      academicSources: [],
      examSources: [],
      generatedAt: "2026-09-17",
      generatedBy: "rootline-editorial-migration",
      confidence: 55
    },
    aiMetadata: {
      generated: false,
      validationVersion: VALIDATION_VERSION,
      confidence: 80,
      needsReview: !seed.cefr
    },
    family,
    relatedWords
  };
}
