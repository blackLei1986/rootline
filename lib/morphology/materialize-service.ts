import type { GoldWord, MorphologyRecordInput } from "@/lib/morphology/types";

type CatalogWord = {
  id: string;
  word: string;
  lemma: string;
  wordFamilyId: string;
  morphologyConfidence: string;
};

type ExistingRecord = Pick<MorphologyRecordInput, "catalogWordId" | "datasetVersion" | "source" | "confidence" | "reviewStatus">;

export function materializeExactGoldMatches({
  dataset,
  vocabulary,
  existing
}: {
  dataset: { version: string; words: readonly GoldWord[] };
  vocabulary: readonly CatalogWord[];
  existing: readonly ExistingRecord[];
}): {
  created: MorphologyRecordInput[];
  skippedVerified: number;
  skippedRejected: number;
  unchanged: number;
} {
  const goldByLemma = new Map(dataset.words.map((word) => [normalize(word.lemma), word]));
  const created: MorphologyRecordInput[] = [];
  let skippedVerified = 0;
  let skippedRejected = 0;
  let unchanged = 0;

  for (const vocabularyWord of vocabulary) {
    const goldWord = goldByLemma.get(normalize(vocabularyWord.lemma));
    if (!goldWord || goldWord.rootIds.length === 0) {
      unchanged += 1;
      continue;
    }

    const matchingRecords = existing.filter((record) => record.catalogWordId === vocabularyWord.id);
    if (matchingRecords.some((record) => record.confidence === "verified")) {
      skippedVerified += 1;
      continue;
    }
    if (matchingRecords.some((record) => (
      record.datasetVersion === dataset.version
      && record.source === "gold-dataset-exact-lemma"
      && record.reviewStatus === "rejected"
    ))) {
      skippedRejected += 1;
      continue;
    }
    if (matchingRecords.some((record) => record.datasetVersion === dataset.version && record.source === "gold-dataset-exact-lemma")) {
      unchanged += 1;
      continue;
    }

    created.push({
      datasetVersion: dataset.version,
      catalogWordId: vocabularyWord.id,
      lemma: vocabularyWord.lemma,
      familyKey: null,
      primaryRootKey: goldWord.rootIds[0] ?? null,
      segments: [
        ...(goldWord.prefix ? [{ position: 0, kind: "prefix" as const, surfaceForm: goldWord.prefix.form, meaning: goldWord.prefix.meaning }] : []),
        ...goldWord.rootIds.map((rootKey, index) => ({ position: index + (goldWord.prefix ? 1 : 0), kind: "root" as const, surfaceForm: rootKey, rootKey })),
        ...(goldWord.suffix ? [{ position: goldWord.rootIds.length + (goldWord.prefix ? 1 : 0), kind: "suffix" as const, surfaceForm: goldWord.suffix.form, meaning: goldWord.suffix.meaning }] : [])
      ],
      confidence: "derived",
      morphologyScore: 100,
      source: "gold-dataset-exact-lemma",
      provenance: {
        curatedWordId: goldWord.wordId,
        curatedLemma: goldWord.lemma,
        matchingRule: "exact-lemma",
        datasetVersion: dataset.version,
        legacyWordFamilyId: vocabularyWord.wordFamilyId
      },
      formationExplanation: goldWord.formationExplanation,
      reviewStatus: "pending"
    });
  }

  return { created, skippedVerified, skippedRejected, unchanged };
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}
