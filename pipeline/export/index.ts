import type { PipelineState, VocabularyCandidatePayload } from "@/pipeline/types";

export function exportAccepted(state: PipelineState): VocabularyCandidatePayload[] {
  return state.candidates.filter((candidate) => candidate.status === "accepted" && candidate.payload).map((candidate) => candidate.payload as VocabularyCandidatePayload);
}
