import { roots } from "@/data/roots";
import { words as masterWords } from "@/data/words";
import { CONTENT_QUALITY_GATES } from "@/config/content-quality";
import type { ContentTier, ProductionVocabularyEntry, Word } from "@/types";

export const ACCEPTED_LEMMA_MINIMUM = CONTENT_QUALITY_GATES.acceptedLemmaMinimum;
export const ACCEPTED_LEMMA_TARGET_MIN = CONTENT_QUALITY_GATES.acceptedLemmaTargetMinimum;
export const ACCEPTED_LEMMA_TARGET_MAX = CONTENT_QUALITY_GATES.acceptedLemmaTargetMaximum;

const tiers: ContentTier[] = ["tier-1-core", "tier-2-important", "tier-3-recognition", "tier-4-extension"];

export interface VocabularyProductionReport {
  totalRecords: number;
  totalLemmas: number;
  totalSurfaceForms: number;
  totalWordFamilies: number;
  acceptedLemmaCount: number;
  acceptedSurfaceFormCount: number;
  tierCounts: Record<ContentTier, number>;
  generalCoverage: number;
  academicCount: number;
  ieltsOrientedCount: number;
  toeflOrientedCount: number;
  wordsWithExamples: number;
  wordsWithCollocations: number;
  wordsWithMorphology: number;
  wordsMissingMeaning: string[];
  wordsMissingSource: string[];
  needsReview: string[];
  lowConfidence: string[];
  duplicateCandidates: Array<{ lemma: string; wordIds: string[] }>;
  brokenReferences: string[];
  finalGatePassed: boolean;
  targetGatePassed: boolean;
}

export interface FullVocabularyProductionReport {
  totalRecords: number;
  totalLemmas: number;
  totalSurfaceForms: number;
  totalWordFamilies: number;
  acceptedLemmaCount: number;
  tierCounts: Record<ContentTier, number>;
  generalCoverage: number;
  academicCount: number;
  ieltsOrientedCount: number;
  toeflOrientedCount: number;
  wordsWithExamples: number;
  wordsWithThreeOrMoreExamples: number;
  wordsWithMorphology: number;
  wordsMissingMeaning: string[];
  wordsMissingSource: string[];
  needsReview: string[];
  lowConfidence: string[];
  duplicateCandidates: string[];
  tierDepthIssues: string[];
  finalGatePassed: boolean;
  targetGatePassed: boolean;
}

export function passesAcceptedMinimum(word: Word): boolean {
  return Boolean(
    word.pipelineStatus === "accepted" &&
    word.word.trim() &&
    word.lemma.trim() &&
    word.partOfSpeech.length &&
    word.meaningZh.some((meaning) => meaning.trim()) &&
    word.frequency.band &&
    Number.isFinite(word.learningValueScore) &&
    word.contentTier &&
    word.examples.length >= 1 &&
    word.sourceMetadata.frequencySources.length >= 1
  );
}

export function passesProductionAcceptedMinimum(entry: ProductionVocabularyEntry): boolean {
  return Boolean(
    entry.pipelineStatus === "accepted" &&
    entry.word.trim() &&
    entry.lemma.trim() &&
    entry.partOfSpeech.length &&
    entry.coreMeaningZh.trim() &&
    entry.frequencyBand &&
    Number.isFinite(entry.learningValueScore) &&
    entry.contentTier &&
    entry.examples.some((example) => example.trim()) &&
    entry.sourceMetadata.frequencySources.length
  );
}

export function toProductionVocabularyEntry(word: Word): ProductionVocabularyEntry {
  return {
    id: word.id,
    word: word.word,
    lemma: word.lemma,
    wordFamilyId: word.wordFamilyId,
    surfaceForms: [...new Set([word.word, ...word.family].map((form) => form.toLowerCase()))],
    phonetic: word.phonetic,
    partOfSpeech: word.partOfSpeech,
    coreMeaningZh: word.meaningZh[0] ?? "",
    coreDefinitionEn: word.meaningEn?.[0] ?? word.senses[0]?.definitionEn ?? "",
    example: word.examples[0]?.en ?? "",
    examples: word.examples.map((example) => example.en),
    frequencyBand: word.frequency.band,
    frequencyRank: word.frequency.rank ?? 30_000,
    learningValueScore: word.learningValueScore,
    contentTier: word.contentTier,
    learningGoal: word.learningGoal,
    coverageTags: word.coverageTags,
    pipelineStatus: "accepted",
    morphologyConfidence: word.morphologyConfidence,
    sourceMetadata: word.sourceMetadata
  };
}

export function createFullVocabularyProductionReport(catalog: ProductionVocabularyEntry[]): FullVocabularyProductionReport {
  const groups = new Map<string, ProductionVocabularyEntry[]>();
  for (const entry of catalog) {
    const lemma = entry.lemma.trim().toLowerCase();
    groups.set(lemma, [...(groups.get(lemma) ?? []), entry]);
  }
  const accepted = catalog.filter(passesProductionAcceptedMinimum);
  const acceptedByLemma = new Map<string, ProductionVocabularyEntry>();
  for (const entry of accepted) if (!acceptedByLemma.has(entry.lemma.toLowerCase())) acceptedByLemma.set(entry.lemma.toLowerCase(), entry);
  const acceptedEntries = [...acceptedByLemma.values()];
  const tierCounts = Object.fromEntries(tiers.map((tier) => [tier, acceptedEntries.filter((entry) => entry.contentTier === tier).length])) as Record<ContentTier, number>;
  const tierDepthIssues = acceptedEntries.filter((entry) => {
    if (entry.contentTier === "tier-1-core") return entry.examples.length < 3;
    if (entry.contentTier === "tier-2-important") return entry.examples.length < 2;
    return entry.examples.length < 1;
  }).map((entry) => entry.id);
  const acceptedLemmaCount = acceptedByLemma.size;
  return {
    totalRecords: catalog.length,
    totalLemmas: groups.size,
    totalSurfaceForms: new Set(catalog.flatMap((entry) => entry.surfaceForms.map((form) => form.toLowerCase()))).size,
    totalWordFamilies: new Set(catalog.map((entry) => entry.wordFamilyId.toLowerCase())).size,
    acceptedLemmaCount,
    tierCounts,
    generalCoverage: acceptedEntries.filter((entry) => entry.coverageTags.includes("general")).length,
    academicCount: acceptedEntries.filter((entry) => entry.coverageTags.includes("academic")).length,
    ieltsOrientedCount: acceptedEntries.filter((entry) => entry.coverageTags.includes("ielts")).length,
    toeflOrientedCount: acceptedEntries.filter((entry) => entry.coverageTags.includes("toefl")).length,
    wordsWithExamples: acceptedEntries.filter((entry) => entry.examples.length > 0).length,
    wordsWithThreeOrMoreExamples: acceptedEntries.filter((entry) => entry.examples.length >= 3).length,
    wordsWithMorphology: acceptedEntries.filter((entry) => entry.morphologyConfidence === "high" || entry.morphologyConfidence === "medium").length,
    wordsMissingMeaning: catalog.filter((entry) => !entry.coreMeaningZh.trim()).map((entry) => entry.id),
    wordsMissingSource: catalog.filter((entry) => !entry.sourceMetadata.frequencySources.length).map((entry) => entry.id),
    needsReview: catalog.filter((entry) => !passesProductionAcceptedMinimum(entry)).map((entry) => entry.id),
    lowConfidence: catalog.filter((entry) => entry.sourceMetadata.confidence < 70).map((entry) => entry.id),
    duplicateCandidates: [...groups.entries()].filter(([, entries]) => entries.length > 1).map(([lemma]) => lemma),
    tierDepthIssues,
    finalGatePassed: acceptedLemmaCount >= ACCEPTED_LEMMA_MINIMUM,
    targetGatePassed: acceptedLemmaCount >= ACCEPTED_LEMMA_TARGET_MIN && acceptedLemmaCount <= ACCEPTED_LEMMA_TARGET_MAX
  };
}

function uniqueLemmas(catalog: Word[]): Map<string, Word> {
  const byLemma = new Map<string, Word>();
  for (const word of catalog) if (!byLemma.has(word.lemma.toLowerCase())) byLemma.set(word.lemma.toLowerCase(), word);
  return byLemma;
}

export function createVocabularyProductionReport(catalog: Word[] = masterWords): VocabularyProductionReport {
  const rootIds = new Set(roots.map((root) => root.id));
  const allLemmas = uniqueLemmas(catalog);
  const acceptedWords = catalog.filter(passesAcceptedMinimum);
  const acceptedLemmas = uniqueLemmas(acceptedWords);
  const lemmaGroups = new Map<string, string[]>();
  for (const word of catalog) lemmaGroups.set(word.lemma.toLowerCase(), [...(lemmaGroups.get(word.lemma.toLowerCase()) ?? []), word.id]);
  const brokenReferences = catalog.flatMap((word) => word.rootIds.filter((rootId) => !rootIds.has(rootId)).map((rootId) => `${word.id} -> root:${rootId}`));
  const tierCounts = Object.fromEntries(tiers.map((tier) => [tier, [...acceptedLemmas.values()].filter((word) => word.contentTier === tier).length])) as Record<ContentTier, number>;
  const acceptedLemmaCount = acceptedLemmas.size;
  return {
    totalRecords: catalog.length,
    totalLemmas: allLemmas.size,
    totalSurfaceForms: new Set(catalog.map((word) => word.word.toLowerCase())).size,
    totalWordFamilies: new Set(catalog.map((word) => word.wordFamilyId)).size,
    acceptedLemmaCount,
    acceptedSurfaceFormCount: new Set(acceptedWords.map((word) => word.word.toLowerCase())).size,
    tierCounts,
    generalCoverage: new Set(acceptedWords.filter((word) => word.coverageTags.includes("general")).map((word) => word.lemma)).size,
    academicCount: new Set(acceptedWords.filter((word) => word.coverageTags.includes("academic")).map((word) => word.lemma)).size,
    ieltsOrientedCount: new Set(acceptedWords.filter((word) => word.coverageTags.includes("ielts")).map((word) => word.lemma)).size,
    toeflOrientedCount: new Set(acceptedWords.filter((word) => word.coverageTags.includes("toefl")).map((word) => word.lemma)).size,
    wordsWithExamples: catalog.filter((word) => word.examples.length > 0).length,
    wordsWithCollocations: catalog.filter((word) => word.collocations.length > 0).length,
    wordsWithMorphology: catalog.filter((word) => word.morphologyConfidence === "high" || word.morphologyConfidence === "medium").length,
    wordsMissingMeaning: catalog.filter((word) => !word.meaningZh.some(Boolean)).map((word) => word.id),
    wordsMissingSource: catalog.filter((word) => !word.sourceMetadata.frequencySources.length).map((word) => word.id),
    needsReview: catalog.filter((word) => word.pipelineStatus === "review").map((word) => word.id),
    lowConfidence: catalog.filter((word) => word.sourceMetadata.confidence < 70 || word.aiMetadata.confidence < 70).map((word) => word.id),
    duplicateCandidates: [...lemmaGroups.entries()].filter(([, wordIds]) => wordIds.length > 1).map(([lemma, wordIds]) => ({ lemma, wordIds })),
    brokenReferences,
    finalGatePassed: acceptedLemmaCount >= ACCEPTED_LEMMA_MINIMUM,
    targetGatePassed: acceptedLemmaCount >= ACCEPTED_LEMMA_TARGET_MIN && acceptedLemmaCount <= ACCEPTED_LEMMA_TARGET_MAX
  };
}
