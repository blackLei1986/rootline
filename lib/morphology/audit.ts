import type { Word } from "@/types";
import type { MorphologyConfidence, ProductionVocabularyEntry } from "@/types/vocabulary";

export type MorphologyAuditConfidence = "verified" | "derived" | "none";

type CuratedMorphologyWord = Pick<
  Word,
  "lemma" | "word" | "rootIds" | "prefix" | "suffix" | "morphology" | "literalMeaning"
>;

export interface MorphologyCandidate {
  wordId: string;
  word: string;
  lemma: string;
  familyId: string;
  primaryRoot: string;
  rootIds: string[];
  prefixes: Array<{ form: string; meaning: string }>;
  suffixes: Array<{ form: string; meaning: string }>;
  formationExplanation: string;
  confidence: Extract<MorphologyAuditConfidence, "derived">;
  morphologyScore: number;
  source: "gold-dataset-exact-lemma";
  provenance: {
    curatedLemma: string;
    matchingRule: "exact-lemma";
  };
}

export interface RootCoverage {
  rootId: string;
  usableWordCount: number;
  usableFamilyCount: number;
  canFormFiveWordCluster: boolean;
  canFormTenWordCluster: boolean;
}

export interface MorphologyCoverageReport {
  baseline: {
    totalVocabularyCount: number;
    v2VerifiedCount: number;
    v2DerivedCount: number;
    v2NoneCount: number;
    legacyMorphologyConfidenceCounts: Record<MorphologyConfidence, number>;
  };
  dryRun: {
    derivedCandidateCount: number;
    noMorphologyCount: number;
    candidateRate: number;
  };
  familyCoverage: {
    totalFamilyCount: number;
    derivedFamilyCount: number;
    coverageRate: number;
  };
  rootCoverage: {
    knownRootCount: number;
    coveredRootCount: number;
    coverageRate: number;
  };
  roots: RootCoverage[];
  candidates: MorphologyCandidate[];
  candidateExamples: MorphologyCandidate[];
}

const normalizeLemma = (value: string) => value.trim().toLocaleLowerCase("en-US");

const percentage = (numerator: number, denominator: number) => (
  denominator === 0 ? 0 : Number(((numerator / denominator) * 100).toFixed(2))
);

/**
 * Projects only exact matches from the curated static word set into a candidate
 * layer. It deliberately does not infer roots from spelling, word-family IDs,
 * or substring matches, and it never mutates the production catalog.
 */
export function buildMorphologyCoverageReport({
  vocabulary,
  curatedWords
}: {
  vocabulary: readonly ProductionVocabularyEntry[];
  curatedWords: readonly CuratedMorphologyWord[];
}): MorphologyCoverageReport {
  const curatedByLemma = new Map<string, CuratedMorphologyWord>();
  const knownRoots = new Set<string>();

  for (const curatedWord of curatedWords) {
    if (curatedWord.rootIds.length === 0) continue;

    const lemma = normalizeLemma(curatedWord.lemma);
    if (!curatedByLemma.has(lemma)) curatedByLemma.set(lemma, curatedWord);
    for (const rootId of curatedWord.rootIds) knownRoots.add(rootId);
  }

  const legacyMorphologyConfidenceCounts: Record<MorphologyConfidence, number> = {
    high: 0,
    medium: 0,
    low: 0,
    none: 0
  };
  const candidates: MorphologyCandidate[] = [];

  for (const entry of vocabulary) {
    legacyMorphologyConfidenceCounts[entry.morphologyConfidence] += 1;

    const curatedWord = curatedByLemma.get(normalizeLemma(entry.lemma));
    if (!curatedWord) continue;

    const primaryRoot = curatedWord.rootIds[0];
    if (!primaryRoot) continue;

    candidates.push({
      wordId: entry.id,
      word: entry.word,
      lemma: entry.lemma,
      familyId: entry.wordFamilyId,
      primaryRoot,
      rootIds: [...curatedWord.rootIds],
      prefixes: curatedWord.prefix ? [curatedWord.prefix] : [],
      suffixes: curatedWord.suffix ? [curatedWord.suffix] : [],
      formationExplanation: curatedWord.literalMeaning || curatedWord.morphology,
      confidence: "derived",
      morphologyScore: 100,
      source: "gold-dataset-exact-lemma",
      provenance: {
        curatedLemma: curatedWord.lemma,
        matchingRule: "exact-lemma"
      }
    });
  }

  candidates.sort((left, right) => (
    left.word.localeCompare(right.word, "en") || left.wordId.localeCompare(right.wordId, "en")
  ));

  const families = new Set(vocabulary.map((entry) => entry.wordFamilyId).filter(Boolean));
  const candidateFamilies = new Set(candidates.map((candidate) => candidate.familyId).filter(Boolean));
  const candidatesByRoot = new Map<string, MorphologyCandidate[]>();

  for (const candidate of candidates) {
    for (const rootId of candidate.rootIds) {
      const rootCandidates = candidatesByRoot.get(rootId) ?? [];
      rootCandidates.push(candidate);
      candidatesByRoot.set(rootId, rootCandidates);
    }
  }

  const roots = [...candidatesByRoot.entries()]
    .map(([rootId, rootCandidates]) => {
      const usableWordCount = new Set(rootCandidates.map((candidate) => candidate.wordId)).size;
      return {
        rootId,
        usableWordCount,
        usableFamilyCount: new Set(rootCandidates.map((candidate) => candidate.familyId)).size,
        canFormFiveWordCluster: usableWordCount >= 5,
        canFormTenWordCluster: usableWordCount >= 10
      };
    })
    .sort((left, right) => right.usableWordCount - left.usableWordCount || left.rootId.localeCompare(right.rootId, "en"));

  return {
    baseline: {
      totalVocabularyCount: vocabulary.length,
      // Phase 1A-1 has no persisted V2 morphology model yet. Legacy high/medium/low
      // values are reported separately rather than relabeled as verified evidence.
      v2VerifiedCount: 0,
      v2DerivedCount: 0,
      v2NoneCount: vocabulary.length,
      legacyMorphologyConfidenceCounts
    },
    dryRun: {
      derivedCandidateCount: candidates.length,
      noMorphologyCount: vocabulary.length - candidates.length,
      candidateRate: percentage(candidates.length, vocabulary.length)
    },
    familyCoverage: {
      totalFamilyCount: families.size,
      derivedFamilyCount: candidateFamilies.size,
      coverageRate: percentage(candidateFamilies.size, families.size)
    },
    rootCoverage: {
      knownRootCount: knownRoots.size,
      coveredRootCount: roots.length,
      coverageRate: percentage(roots.length, knownRoots.size)
    },
    roots,
    candidates,
    candidateExamples: candidates.slice(0, 20)
  };
}
