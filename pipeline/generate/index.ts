import { vocabularyEnrichmentPrompt } from "@/prompts/vocabulary-enrichment";
import type { AIProvider } from "@/pipeline/generate/provider";
import { withRetry } from "@/pipeline/generate/retry";
import type { VocabularyCandidate, VocabularyCandidatePayload } from "@/pipeline/types";

export async function generateCandidate(candidate: VocabularyCandidate, provider: AIProvider): Promise<VocabularyCandidate> {
  if (candidate.status === "accepted") return candidate;
  const result = await withRetry(() => provider.generateStructuredData<VocabularyCandidatePayload>({ schemaName: "VocabularyCandidatePayload", prompt: vocabularyEnrichmentPrompt.text, input: candidate.seed }));
  if (!result.value) return { ...candidate, attempts: candidate.attempts + result.attempts, status: "needs-review", failureReason: result.error, updatedAt: new Date().toISOString() };
  return { ...candidate, attempts: candidate.attempts + result.attempts, status: "generated", payload: result.value, failureReason: undefined, updatedAt: new Date().toISOString() };
}
