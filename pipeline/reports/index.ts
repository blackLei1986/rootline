import { words } from "@/data/words";
import { phrases, sentences, wordFamilies } from "@/data/learning-content";
import type { PipelineState } from "@/pipeline/types";

export function createCoverageReport() {
  return {
    vocabularyVersion: "2026.09.v1",
    totalLemmas: new Set(words.map((word) => word.lemma)).size,
    surfaceWords: words.length,
    wordFamilies: wordFamilies.length,
    core2000Coverage: words.filter((word) => ["core-1000", "core-2000"].includes(word.vocabularyBand)).length,
    core3000Coverage: words.filter((word) => ["core-1000", "core-2000", "core-3000"].includes(word.vocabularyBand)).length,
    academicCount: words.filter((word) => word.coverageTags.includes("academic")).length,
    ieltsTagged: words.filter((word) => word.coverageTags.includes("ielts")).length,
    toeflTagged: words.filter((word) => word.coverageTags.includes("toefl")).length,
    wordsWithRoots: words.filter((word) => word.rootIds.length > 0).length,
    wordsWithoutRoots: words.filter((word) => word.rootIds.length === 0).length,
    wordsWithCollocations: words.filter((word) => word.phraseIds.length > 0).length,
    wordsWith3PlusSentences: words.filter((word) => word.sentenceIds.length >= 3).length,
    acceptedPhrases: phrases.filter((phrase) => phrase.status === "accepted").length,
    acceptedSentences: sentences.filter((sentence) => sentence.status === "accepted").length
  };
}

export function createQualityReport(state: PipelineState) {
  return {
    totalCandidates: state.candidates.length,
    pending: state.candidates.filter((item) => item.status === "pending").length,
    generated: state.candidates.filter((item) => item.status === "generated").length,
    validated: state.candidates.filter((item) => item.status === "validated").length,
    accepted: state.candidates.filter((item) => item.status === "accepted").length,
    needsReview: state.candidates.filter((item) => item.status === "needs-review").length,
    rejected: state.candidates.filter((item) => item.status === "rejected").length,
    lowConfidence: state.candidates.filter((item) => item.payload && item.payload.sourceMetadata.confidence < 70).map((item) => item.id),
    duplicateCandidates: state.candidates.filter((item) => item.duplicateOf).map((item) => ({ id: item.id, duplicateOf: item.duplicateOf })),
    failures: state.candidates.filter((item) => item.failureReason).map((item) => ({ id: item.id, reason: item.failureReason }))
  };
}
