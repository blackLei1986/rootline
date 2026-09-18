import { VOCABULARY_VERSION } from "@/config/vocabulary-scoring";
import { normalizeSeed } from "@/pipeline/normalize";
import type { PipelineState, SeedWord } from "@/pipeline/types";

export function importSeeds(seeds: SeedWord[], previous?: PipelineState): PipelineState {
  const existing = new Map((previous?.candidates ?? []).map((candidate) => [candidate.id, candidate]));
  for (const raw of seeds) {
    const seed = normalizeSeed(raw);
    if (!seed.word || existing.has(seed.word)) continue;
    existing.set(seed.word, { id: seed.word, status: "pending", attempts: 0, seed, updatedAt: new Date().toISOString() });
  }
  return { vocabularyVersion: VOCABULARY_VERSION, candidates: [...existing.values()] };
}
