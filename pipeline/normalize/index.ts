import type { SeedWord } from "@/pipeline/types";

export function normalizeLemma(value: string): string {
  return value.trim().toLowerCase().normalize("NFKC").replace(/[^a-z'-]/g, "");
}
export function normalizeSeed(seed: SeedWord): SeedWord {
  return { ...seed, word: normalizeLemma(seed.word), source: seed.source.trim() };
}
