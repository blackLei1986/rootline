import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ContentTier, CoverageTag } from "@/types/vocabulary";

export interface ProductionReadingEntry {
  id: string;
  lemma: string;
  surfaceForms: string[];
  familyId: string;
  contentTier: ContentTier;
  frequencyRank: number;
  learningValue: number;
  coverageTags: CoverageTag[];
}

export interface ProductionReadingIndex {
  vocabularyVersion: string;
  acceptedLemmaCount: number;
  byLemma: Map<string, ProductionReadingEntry>;
  bySurfaceForm: Map<string, ProductionReadingEntry>;
}

type SerializedIndex = {
  vocabularyVersion: string;
  acceptedLemmaCount: number;
  entries: ProductionReadingEntry[];
};

let cachedIndex: Promise<ProductionReadingIndex> | null = null;

export function getProductionReadingIndex(): Promise<ProductionReadingIndex> {
  cachedIndex ??= loadIndex();
  return cachedIndex;
}

async function loadIndex(): Promise<ProductionReadingIndex> {
  const path = resolve(process.cwd(), "data", "vocabulary", "reading-index.json");
  const serialized = JSON.parse(await readFile(path, "utf8")) as SerializedIndex;
  const byLemma = new Map<string, ProductionReadingEntry>();
  const bySurfaceForm = new Map<string, ProductionReadingEntry>();

  for (const entry of serialized.entries) {
    const lemma = normalize(entry.lemma);
    if (byLemma.has(lemma)) throw new Error(`Duplicate Reading lemma: ${lemma}`);
    byLemma.set(lemma, entry);
    for (const rawForm of entry.surfaceForms) {
      const form = normalize(rawForm);
      const current = bySurfaceForm.get(form);
      if (!current || entry.frequencyRank < current.frequencyRank) bySurfaceForm.set(form, entry);
    }
  }
  if (serialized.acceptedLemmaCount !== 9_000 || byLemma.size !== serialized.acceptedLemmaCount) {
    throw new Error("Production Reading index failed the accepted lemma count gate.");
  }
  return {
    vocabularyVersion: serialized.vocabularyVersion,
    acceptedLemmaCount: serialized.acceptedLemmaCount,
    byLemma,
    bySurfaceForm
  };
}

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}
