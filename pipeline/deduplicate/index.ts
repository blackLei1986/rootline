import type { VocabularyCandidate } from "@/pipeline/types";

export function markDuplicateCandidates(candidates: VocabularyCandidate[]): VocabularyCandidate[] {
  const seen = new Map<string, string>();
  return candidates.map((candidate) => {
    const key = `${candidate.payload?.lemma ?? candidate.seed.word}:${candidate.payload?.partOfSpeech.join("|") ?? "unknown"}`;
    const duplicateOf = seen.get(key);
    if (duplicateOf) return { ...candidate, duplicateOf, status: "needs-review" };
    seen.set(key, candidate.id);
    return candidate;
  });
}
