import { createHash } from "node:crypto";

import type {
  GoldDatasetV1,
  GoldRoot,
  GoldWord,
  MorphologyConfidenceV2,
  MorphologyReviewStatus
} from "@/lib/morphology/types";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

type ChangeCounts = { insert: number; update: number; unchanged: number };

export interface PersistedMorphologyState {
  datasets: Array<{ id: string; version: string; contentHash: string }>;
  roots: Array<{
    id: string;
    datasetVersion: string;
    rootKey: string;
    contentHash: string;
  }>;
  families: Array<{
    id: string;
    datasetVersion: string;
    familyKey: string;
    contentHash: string;
  }>;
  records: Array<{
    id: string;
    datasetVersion: string;
    catalogWordId: string;
    source: string;
    confidence: MorphologyConfidenceV2;
    reviewStatus: MorphologyReviewStatus;
    contentHash: string;
    segmentCount: number;
    rootRelationCount: number;
    hasFamilyRelation: boolean;
  }>;
}

export interface MorphologyImportSegment {
  position: number;
  kind: "prefix" | "root" | "suffix";
  surfaceForm: string;
  normalizedForm: string;
  rootKey: string | null;
  meaning: string | null;
  explanation: string | null;
  provenance: Record<string, unknown>;
}

export interface MorphologyImportRecord {
  catalogWordId: string;
  word: string;
  lemma: string;
  familyKey: string | null;
  primaryRootKey: string | null;
  segments: MorphologyImportSegment[];
  confidence: MorphologyConfidenceV2;
  morphologyScore: number | null;
  source: "gold-dataset" | "gold-dataset-exact-lemma";
  provenance: Record<string, unknown>;
  morphologyExpression: string;
  literalMeaning: string;
  formationExplanation: string;
  reviewStatus: MorphologyReviewStatus;
  contentHash: string;
}

export interface MorphologyImportPlan {
  payload: {
    dataset: GoldDatasetV1;
    roots: Array<GoldRoot & { contentHash: string }>;
    families: Array<{
      familyKey: string;
      displayName: string;
      primaryRootKey: string | null;
      formationExplanation: string;
      source: "gold-dataset";
      provenance: Record<string, unknown>;
      contentHash: string;
    }>;
    records: MorphologyImportRecord[];
  };
  summary: {
    dataset: "insert" | "unchanged" | "error";
    goldRoots: ChangeCounts;
    families: ChangeCounts;
    goldWords: ChangeCounts;
    segments: ChangeCounts;
    relations: ChangeCounts;
    derivedCandidates: ChangeCounts & {
      verifiedConflicts: number;
      rejectedConflicts: number;
    };
    auditEvents: { create: number; unchanged: number };
  };
  errors: string[];
}

type VocabularyWord = Pick<ProductionVocabularyEntry, "id" | "word" | "lemma" | "wordFamilyId">;

export function buildMorphologyImportPlan({
  dataset,
  vocabulary,
  persisted
}: {
  dataset: GoldDatasetV1;
  vocabulary: readonly VocabularyWord[];
  persisted: PersistedMorphologyState;
}): MorphologyImportPlan {
  const existingDataset = persisted.datasets.find((item) => item.version === dataset.version);
  const errors: string[] = [];
  if (existingDataset && existingDataset.contentHash !== dataset.provenance.contentHash) {
    errors.push(
      `Dataset version ${dataset.version} already exists with a different content hash; create a new dataset version.`
    );
  }

  const roots = dataset.roots.map((root) => ({ ...root, contentHash: hash(root) }));
  const rootMeaning = new Map(dataset.roots.map((root) => [root.rootKey, root.meaningEn.join(", ")]));
  const families = dataset.words.map((word) => {
    const value = {
      familyKey: familyKey(word),
      displayName: `${word.lemma} morphology family`,
      primaryRootKey: word.rootIds[0] ?? null,
      formationExplanation: word.formationExplanation,
      source: "gold-dataset" as const,
      provenance: {
        datasetVersion: dataset.version,
        sourceWordId: word.wordId,
        teachingFamily: word.teachingFamily
      }
    };
    return { ...value, contentHash: hash(value) };
  });

  const goldRecords = dataset.words.map((word) => goldRecord(dataset, word, rootMeaning));
  const goldByLemma = new Map(
    dataset.words
      .filter((word) => word.rootIds.length > 0)
      .map((word) => [normalize(word.lemma), word] as const)
  );
  const derivedRecords: MorphologyImportRecord[] = [];
  let verifiedConflicts = 0;
  let rejectedConflicts = 0;

  for (const vocabularyWord of vocabulary) {
    const goldWord = goldByLemma.get(normalize(vocabularyWord.lemma));
    if (!goldWord) continue;

    const existingForWord = persisted.records.filter(
      (record) => record.catalogWordId === vocabularyWord.id
    );
    if (existingForWord.some((record) => record.confidence === "verified")) {
      verifiedConflicts += 1;
      continue;
    }
    if (existingForWord.some((record) => (
      record.datasetVersion === dataset.version
      && record.source === "gold-dataset-exact-lemma"
      && record.reviewStatus === "rejected"
    ))) {
      rejectedConflicts += 1;
      continue;
    }

    derivedRecords.push(derivedRecord(dataset, goldWord, vocabularyWord, rootMeaning));
  }

  const rootCounts = countChanges(roots, persisted.roots.filter(
    (root) => root.datasetVersion === dataset.version
  ), (item) => item.rootKey);
  const familyCounts = countChanges(families, persisted.families.filter(
    (family) => family.datasetVersion === dataset.version
  ), (item) => item.familyKey);
  const goldCounts = countRecordChanges(goldRecords, persisted.records, dataset.version);
  const derivedCounts = countRecordChanges(derivedRecords, persisted.records, dataset.version);
  const segments = structuralCounts(
    [...goldRecords, ...derivedRecords],
    persisted.records,
    dataset.version,
    (record) => record.segments.length,
    (record) => record.segmentCount
  );
  const relations = structuralCounts(
    [...goldRecords, ...derivedRecords],
    persisted.records,
    dataset.version,
    relationCount,
    (record) => record.rootRelationCount + (record.hasFamilyRelation ? 1 : 0)
  );
  const eventCreate = (existingDataset ? 0 : 1)
    + goldCounts.insert + goldCounts.update
    + derivedCounts.insert + derivedCounts.update;
  const potentialEventCount = 1 + goldRecords.length + derivedRecords.length;

  return {
    payload: {
      dataset,
      roots,
      families,
      records: [...goldRecords, ...derivedRecords]
    },
    summary: {
      dataset: errors.length > 0 ? "error" : existingDataset ? "unchanged" : "insert",
      goldRoots: rootCounts,
      families: familyCounts,
      goldWords: goldCounts,
      segments,
      relations,
      derivedCandidates: {
        ...derivedCounts,
        verifiedConflicts,
        rejectedConflicts
      },
      auditEvents: {
        create: eventCreate,
        unchanged: potentialEventCount - eventCreate
      }
    },
    errors
  };
}

function goldRecord(
  dataset: GoldDatasetV1,
  word: GoldWord,
  rootMeaning: ReadonlyMap<string, string>
): MorphologyImportRecord {
  const value = {
    catalogWordId: `gold:${word.wordId}`,
    word: word.word,
    lemma: word.lemma,
    familyKey: familyKey(word),
    primaryRootKey: word.rootIds[0] ?? null,
    segments: segmentsFor(dataset, word, rootMeaning, "gold-dataset"),
    confidence: "verified" as const,
    morphologyScore: 100,
    source: "gold-dataset" as const,
    provenance: {
      datasetVersion: dataset.version,
      datasetContentHash: dataset.provenance.contentHash,
      sourceWordId: word.wordId,
      sourceLemma: word.lemma,
      sourcePaths: dataset.provenance.sourcePaths,
      teachingFamily: word.teachingFamily
    },
    morphologyExpression: word.morphology,
    literalMeaning: word.formationExplanation,
    formationExplanation: word.formationExplanation,
    reviewStatus: "approved" as const
  };
  return { ...value, contentHash: hash(value) };
}

function derivedRecord(
  dataset: GoldDatasetV1,
  word: GoldWord,
  vocabularyWord: VocabularyWord,
  rootMeaning: ReadonlyMap<string, string>
): MorphologyImportRecord {
  const value = {
    catalogWordId: vocabularyWord.id,
    word: vocabularyWord.word,
    lemma: vocabularyWord.lemma,
    familyKey: familyKey(word),
    primaryRootKey: word.rootIds[0] ?? null,
    segments: segmentsFor(dataset, word, rootMeaning, "gold-dataset-exact-lemma"),
    confidence: "derived" as const,
    morphologyScore: 100,
    source: "gold-dataset-exact-lemma" as const,
    provenance: {
      datasetVersion: dataset.version,
      datasetContentHash: dataset.provenance.contentHash,
      sourceWordId: word.wordId,
      sourceLemma: word.lemma,
      matchingRule: "exact-lemma",
      legacyWordFamilyId: vocabularyWord.wordFamilyId
    },
    morphologyExpression: word.morphology,
    literalMeaning: word.formationExplanation,
    formationExplanation: word.formationExplanation,
    reviewStatus: "pending" as const
  };
  return { ...value, contentHash: hash(value) };
}

function segmentsFor(
  dataset: GoldDatasetV1,
  word: GoldWord,
  rootMeaning: ReadonlyMap<string, string>,
  source: MorphologyImportRecord["source"]
): MorphologyImportSegment[] {
  const raw = [
    ...(word.prefix ? [{
      kind: "prefix" as const,
      surfaceForm: word.prefix.form,
      rootKey: null,
      meaning: word.prefix.meaning
    }] : []),
    ...word.rootIds.map((rootKey) => ({
      kind: "root" as const,
      surfaceForm: rootKey,
      rootKey,
      meaning: rootMeaning.get(rootKey) ?? null
    })),
    ...(word.suffix ? [{
      kind: "suffix" as const,
      surfaceForm: word.suffix.form,
      rootKey: null,
      meaning: word.suffix.meaning
    }] : [])
  ];

  return raw.map((segment, position) => ({
    position,
    kind: segment.kind,
    surfaceForm: segment.surfaceForm,
    normalizedForm: normalize(segment.surfaceForm),
    rootKey: segment.rootKey,
    meaning: segment.meaning,
    explanation: word.formationExplanation,
    provenance: {
      datasetVersion: dataset.version,
      source,
      sourceWordId: word.wordId
    }
  }));
}

function countChanges<T extends { contentHash: string }, P extends { contentHash: string }>(
  desired: readonly T[],
  persisted: readonly P[],
  key: (item: T | P) => string
): ChangeCounts {
  const current = new Map(persisted.map((item) => [key(item), item]));
  const counts: ChangeCounts = { insert: 0, update: 0, unchanged: 0 };
  for (const item of desired) {
    const existing = current.get(key(item));
    if (!existing) counts.insert += 1;
    else if (existing.contentHash !== item.contentHash) counts.update += 1;
    else counts.unchanged += 1;
  }
  return counts;
}

function countRecordChanges(
  desired: readonly MorphologyImportRecord[],
  persisted: readonly PersistedMorphologyState["records"][number][],
  datasetVersion: string
): ChangeCounts {
  return countChanges(
    desired,
    persisted.filter((record) => record.datasetVersion === datasetVersion),
    (record) => `${record.catalogWordId}:${record.source}`
  );
}

function structuralCounts(
  desired: readonly MorphologyImportRecord[],
  persisted: readonly PersistedMorphologyState["records"][number][],
  datasetVersion: string,
  desiredCount: (record: MorphologyImportRecord) => number,
  persistedCount: (record: PersistedMorphologyState["records"][number]) => number
): ChangeCounts {
  const current = new Map(
    persisted
      .filter((record) => record.datasetVersion === datasetVersion)
      .map((record) => [`${record.catalogWordId}:${record.source}`, record])
  );
  const counts: ChangeCounts = { insert: 0, update: 0, unchanged: 0 };
  for (const record of desired) {
    const count = desiredCount(record);
    const existing = current.get(`${record.catalogWordId}:${record.source}`);
    if (!existing) counts.insert += count;
    else if (existing.contentHash !== record.contentHash || persistedCount(existing) !== count) counts.update += count;
    else counts.unchanged += count;
  }
  return counts;
}

function relationCount(record: MorphologyImportRecord): number {
  return record.segments.filter((segment) => segment.kind === "root").length
    + (record.familyKey === null ? 0 : 1);
}

function familyKey(word: GoldWord): string {
  return `gold:${word.wordId}`;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
