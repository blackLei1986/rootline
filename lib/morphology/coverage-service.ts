import type { MorphologyConfidenceV2, MorphologyReviewStatus } from "@/lib/morphology/types";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

export interface PersistedCoverageRecord {
  catalogWordId: string;
  confidence: MorphologyConfidenceV2;
  reviewStatus: MorphologyReviewStatus;
  source: string;
  familyKey: string | null;
  rootKeys: string[];
  provenance: Record<string, unknown>;
}

export interface PersistedMorphologyCoverageReport {
  datasetVersion: string;
  totalVocabulary: number;
  goldRoots: number;
  goldWords: number;
  persistedVerified: number;
  persistedDerived: number;
  persistedNone: number;
  rejected: number;
  morphologyCoveragePercent: number;
  rootsAtLeast5UsableWords: number;
  rootsAtLeast10UsableWords: number;
  provenanceDistribution: Record<string, number>;
  datasetVersionDistribution: Record<string, number>;
  roots: Array<{
    rootKey: string;
    usableWordCount: number;
    usableFamilyCount: number;
    atLeast5UsableWords: boolean;
    atLeast10UsableWords: boolean;
  }>;
}

export function buildPersistedMorphologyCoverageReport({
  datasetVersion,
  vocabulary,
  roots,
  records
}: {
  datasetVersion: string;
  vocabulary: readonly ProductionVocabularyEntry[];
  roots: readonly { id: string; rootKey: string }[];
  records: readonly PersistedCoverageRecord[];
}): PersistedMorphologyCoverageReport {
  const vocabularyIds = new Set(vocabulary.map((word) => word.id));
  const productionRecords = records.filter((record) => vocabularyIds.has(record.catalogWordId));
  const rejectedRecords = productionRecords.filter((record) => record.reviewStatus === "rejected");
  const verifiedRecords = productionRecords.filter((record) => (
    record.confidence === "verified" && record.reviewStatus !== "rejected"
  ));
  const derivedRecords = productionRecords.filter((record) => (
    record.confidence === "derived" && record.reviewStatus !== "rejected"
  ));
  const usableRecords = [...verifiedRecords, ...derivedRecords];
  const usableByRoot = new Map<string, PersistedCoverageRecord[]>();

  for (const record of usableRecords) {
    for (const rootKey of new Set(record.rootKeys)) {
      const current = usableByRoot.get(rootKey) ?? [];
      current.push(record);
      usableByRoot.set(rootKey, current);
    }
  }

  const rootReports = roots
    .map((root) => {
      const usable = usableByRoot.get(root.rootKey) ?? [];
      const usableWordCount = new Set(usable.map((record) => record.catalogWordId)).size;
      const usableFamilyCount = new Set(
        usable.flatMap((record) => record.familyKey ? [record.familyKey] : [])
      ).size;
      return {
        rootKey: root.rootKey,
        usableWordCount,
        usableFamilyCount,
        atLeast5UsableWords: usableWordCount >= 5,
        atLeast10UsableWords: usableWordCount >= 10
      };
    })
    .sort((left, right) => (
      right.usableWordCount - left.usableWordCount
      || left.rootKey.localeCompare(right.rootKey, "en")
    ));

  const provenanceDistribution = countBy(records, (record) => record.source);
  const datasetVersionDistribution = countBy(records, (record) => {
    const value = record.provenance.datasetVersion;
    return typeof value === "string" ? value : datasetVersion;
  });

  return {
    datasetVersion,
    totalVocabulary: vocabulary.length,
    goldRoots: roots.length,
    goldWords: records.filter((record) => record.source === "gold-dataset").length,
    persistedVerified: verifiedRecords.length,
    persistedDerived: derivedRecords.length,
    persistedNone: Math.max(
      0,
      vocabulary.length - verifiedRecords.length - derivedRecords.length - rejectedRecords.length
    ),
    rejected: rejectedRecords.length,
    morphologyCoveragePercent: percentage(
      verifiedRecords.length + derivedRecords.length,
      vocabulary.length
    ),
    rootsAtLeast5UsableWords: rootReports.filter((root) => root.atLeast5UsableWords).length,
    rootsAtLeast10UsableWords: rootReports.filter((root) => root.atLeast10UsableWords).length,
    provenanceDistribution,
    datasetVersionDistribution,
    roots: rootReports
  };
}

function countBy<T>(items: readonly T[], key: (item: T) => string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const value = key(item);
    result[value] = (result[value] ?? 0) + 1;
  }
  return result;
}

function percentage(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Number(((numerator / denominator) * 100).toFixed(2));
}
