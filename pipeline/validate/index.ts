import { QUALITY_THRESHOLDS } from "@/config/vocabulary-scoring";
import { vocabularyCandidatePayloadSchema } from "@/pipeline/schema";
import type { VocabularyCandidate } from "@/pipeline/types";

export function validateCandidate(candidate: VocabularyCandidate): VocabularyCandidate {
  const result = vocabularyCandidatePayloadSchema.safeParse(candidate.payload);
  if (!result.success) return { ...candidate, status: "rejected", failureReason: result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") };
  const sentencesPass = result.data.sentences.every((sentence) => sentence.naturalnessScore >= QUALITY_THRESHOLDS.sentenceCatalog && sentence.utilityScore >= QUALITY_THRESHOLDS.sentenceCatalog);
  if (!sentencesPass) return { ...candidate, status: "needs-review", failureReason: "One or more sentences are below the catalog quality gate." };
  return { ...candidate, payload: result.data, status: "validated", failureReason: undefined };
}
