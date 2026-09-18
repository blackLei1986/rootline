import { QUALITY_THRESHOLDS } from "@/config/vocabulary-scoring";
import type { VocabularyCandidate } from "@/pipeline/types";
import type { ContentStatus } from "@/types/vocabulary";

export function scoreCandidate(candidate: VocabularyCandidate): VocabularyCandidate {
  if (!candidate.payload || candidate.status === "rejected") return { ...candidate, qualityScore: 0 };
  const p = candidate.payload;
  const completeness = [p.coreMeaningZh, p.coreDefinitionEn, p.morphology, p.memoryHook].filter(Boolean).length / 4 * 25;
  const source = p.sourceMetadata.confidence * 0.25;
  const sentence = p.sentences.reduce((sum, item) => sum + (item.naturalnessScore + item.utilityScore) / 2, 0) / p.sentences.length * 0.25;
  const context = Math.min(15, (p.collocations.length / 5) * 8 + (p.sentences.length / 5) * 7);
  const duplicate = candidate.duplicateOf ? 0 : 10;
  const qualityScore = Math.round(completeness + source + sentence + context + duplicate);
  let status: ContentStatus = candidate.status;
  if (qualityScore >= QUALITY_THRESHOLDS.autoAccept && p.sourceMetadata.confidence >= QUALITY_THRESHOLDS.sourceConfidenceForFactFields) status = "accepted";
  else if (qualityScore >= QUALITY_THRESHOLDS.needsReview) status = "needs-review";
  else status = "rejected";
  return { ...candidate, qualityScore, status };
}
