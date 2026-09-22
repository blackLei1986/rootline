import type { PersistedCoverageRecord } from "@/lib/morphology/coverage-service";
import type { PersistedCoverageData } from "@/lib/repositories/supabase/morphology-coverage-repository";
import type { CoverageTag, ProductionVocabularyEntry } from "@/types/vocabulary";

export interface PersistedRootExpansionReport {
  datasetVersion: string;
  rules: {
    productionExactMatch: "source=gold-dataset-exact-lemma";
    usableProductionRecord: "exact-match + non-rejected + verified-or-derived";
    highFrequency: "frequencyBand=high";
    pedagogicalValue: "usable*5 + families*4 + high*2 + tagged + confidence/10";
  };
  roots: Array<{
    rootKey: string;
    goldWordCount: number;
    productionExactMatchCount: number;
    usableProductionWordCount: number;
    usableProductionFamilyCount: number;
    highFrequencyCount: number;
    ieltsTaggedCount: number;
    toeflTaggedCount: number;
    academicTaggedCount: number;
    variants: string[];
    etymologyConfidence: "high" | "medium" | "cautious" | "not-recorded";
    pedagogicalConfidence: number | null;
    riskNotes: string | null;
    pedagogicalValue: number;
  }>;
}

export function buildPersistedRootExpansionReport({
  datasetVersion,
  vocabulary,
  roots,
  variants,
  records
}: PersistedCoverageData & { vocabulary: readonly ProductionVocabularyEntry[] }): PersistedRootExpansionReport {
  const vocabularyById = new Map(vocabulary.map((word) => [word.id, word]));
  const variantsByRoot = new Map<string, string[]>();
  for (const variant of variants) {
    const forms = variantsByRoot.get(variant.rootKey) ?? [];
    forms.push(variant.form);
    variantsByRoot.set(variant.rootKey, forms);
  }

  const reportRoots = roots.map((root) => {
    const rootRecords = records.filter((record) => record.rootKeys.includes(root.rootKey));
    const goldWordCount = distinctCount(rootRecords.filter((record) => record.source === "gold-dataset"), (record) => record.catalogWordId);
    const exactMatches = rootRecords.filter((record) => record.source === "gold-dataset-exact-lemma");
    const productionExactMatchCount = distinctCount(exactMatches, (record) => record.catalogWordId);
    const usableRecords = exactMatches.filter((record) => (
      record.reviewStatus !== "rejected"
      && (record.confidence === "verified" || record.confidence === "derived")
      && vocabularyById.has(record.catalogWordId)
    ));
    const usableWords = [...new Map(usableRecords.map((record) => [record.catalogWordId, record])).values()];
    const usableProductionFamilyCount = distinctCount(
      usableWords.filter((record) => record.familyKey !== null),
      (record) => record.familyKey ?? ""
    );
    const usableVocabulary = usableWords.flatMap((record) => {
      const word = vocabularyById.get(record.catalogWordId);
      return word ? [word] : [];
    });
    const metadata = rootMetadata(root.provenance);
    const tagCount = (tag: CoverageTag) => usableVocabulary.filter((word) => word.coverageTags.includes(tag)).length;
    const highFrequencyCount = usableVocabulary.filter((word) => word.frequencyBand === "high").length;
    const pedagogicalValue = Number((
      usableWords.length * 5
      + usableProductionFamilyCount * 4
      + highFrequencyCount * 2
      + tagCount("ielts") + tagCount("toefl") + tagCount("academic")
      + (metadata.pedagogicalConfidence ?? 0) / 10
    ).toFixed(2));

    return {
      rootKey: root.rootKey,
      goldWordCount,
      productionExactMatchCount,
      usableProductionWordCount: usableWords.length,
      usableProductionFamilyCount,
      highFrequencyCount,
      ieltsTaggedCount: tagCount("ielts"),
      toeflTaggedCount: tagCount("toefl"),
      academicTaggedCount: tagCount("academic"),
      variants: [...new Set(variantsByRoot.get(root.rootKey) ?? [])].sort((left, right) => left.localeCompare(right, "en")),
      ...metadata,
      pedagogicalValue
    };
  }).sort((left, right) => (
    right.pedagogicalValue - left.pedagogicalValue
    || right.usableProductionWordCount - left.usableProductionWordCount
    || left.rootKey.localeCompare(right.rootKey, "en")
  ));

  return {
    datasetVersion,
    rules: {
      productionExactMatch: "source=gold-dataset-exact-lemma",
      usableProductionRecord: "exact-match + non-rejected + verified-or-derived",
      highFrequency: "frequencyBand=high",
      pedagogicalValue: "usable*5 + families*4 + high*2 + tagged + confidence/10"
    },
    roots: reportRoots
  };
}

function distinctCount(items: readonly PersistedCoverageRecord[], key: (item: PersistedCoverageRecord) => string): number {
  return new Set(items.map(key)).size;
}

function rootMetadata(provenance: Record<string, unknown>): {
  etymologyConfidence: "high" | "medium" | "cautious" | "not-recorded";
  pedagogicalConfidence: number | null;
  riskNotes: string | null;
} {
  const metadata = provenance.rootMetadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return { etymologyConfidence: "not-recorded", pedagogicalConfidence: null, riskNotes: null };
  }
  const values = metadata as Record<string, unknown>;
  const etymologyConfidence = values.etymologyConfidence;
  const pedagogicalConfidence = values.pedagogicalConfidence;
  const riskNotes = values.riskNotes;
  return {
    etymologyConfidence: etymologyConfidence === "high" || etymologyConfidence === "medium" || etymologyConfidence === "cautious"
      ? etymologyConfidence
      : "not-recorded",
    pedagogicalConfidence: typeof pedagogicalConfidence === "number" ? pedagogicalConfidence : null,
    riskNotes: typeof riskNotes === "string" ? riskNotes : null
  };
}
