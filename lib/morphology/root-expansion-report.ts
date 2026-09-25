import type { RootExpansionCandidate } from "@/lib/morphology/types";
import type { CoverageTag, ProductionVocabularyEntry } from "@/types/vocabulary";

type ExpansionEvidence = Pick<
  ProductionVocabularyEntry,
  "id" | "word" | "lemma" | "frequencyRank" | "learningValueScore" | "coverageTags"
>;

export interface RootExpansionReadinessReport {
  status: "sufficient" | "insufficient-evidence";
  evidenceRule: "exact-configured-lexical-cue";
  minimumEvidenceWords: number;
  minimumReadyCandidates: number;
  candidates: Array<{
    root: string;
    coreMeaning: string;
    exactEvidenceCount: number;
    readinessScore: number;
    pedagogicalClarity: number;
    riskNotes: string;
    tagDistribution: Record<CoverageTag, number>;
    examples: ExpansionEvidence[];
  }>;
}

export function buildRootExpansionReadinessReport({
  vocabulary,
  proposals,
  minimumReadyCandidates = 20,
  minimumEvidenceWords = 2,
  limit = 30
}: {
  vocabulary: readonly ProductionVocabularyEntry[];
  proposals: readonly RootExpansionCandidate[];
  minimumReadyCandidates?: number;
  minimumEvidenceWords?: number;
  limit?: number;
}): RootExpansionReadinessReport {
  const vocabularyByLemma = new Map<string, ProductionVocabularyEntry[]>();
  for (const word of vocabulary) {
    const lemma = normalize(word.lemma);
    const matches = vocabularyByLemma.get(lemma) ?? [];
    matches.push(word);
    vocabularyByLemma.set(lemma, matches);
  }

  const candidates = proposals.flatMap((proposal) => {
    const evidenceById = new Map<string, ProductionVocabularyEntry>();
    for (const cue of proposal.lexicalCues) {
      for (const match of vocabularyByLemma.get(normalize(cue)) ?? []) {
        evidenceById.set(match.id, match);
      }
    }
    const evidence = [...evidenceById.values()].sort((left, right) => (
      left.frequencyRank - right.frequencyRank || left.lemma.localeCompare(right.lemma, "en")
    ));
    if (evidence.length < minimumEvidenceWords) return [];

    const tagDistribution: Record<CoverageTag, number> = {
      general: 0,
      academic: 0,
      ielts: 0,
      toefl: 0
    };
    for (const word of evidence) {
      for (const tag of word.coverageTags) tagDistribution[tag] += 1;
    }

    const frequencyEvidence = evidence.reduce(
      (sum, word) => sum + Math.max(0, 100 - Math.log10(Math.max(1, word.frequencyRank)) * 20),
      0
    ) / evidence.length;
    const tagEvidence = Math.min(
      100,
      (tagDistribution.general * 8)
        + (tagDistribution.academic * 10)
        + (tagDistribution.ielts * 12)
        + (tagDistribution.toefl * 12)
    );
    const breadthEvidence = Math.min(100, evidence.length * 20);
    const readinessScore = Number((
      proposal.pedagogicalClarity * 0.45
      + frequencyEvidence * 0.25
      + breadthEvidence * 0.2
      + tagEvidence * 0.1
    ).toFixed(2));

    return [{
      root: proposal.root,
      coreMeaning: proposal.coreMeaning,
      exactEvidenceCount: evidence.length,
      readinessScore,
      pedagogicalClarity: proposal.pedagogicalClarity,
      riskNotes: proposal.riskNotes,
      tagDistribution,
      examples: evidence.slice(0, 5).map((word) => ({
        id: word.id,
        word: word.word,
        lemma: word.lemma,
        frequencyRank: word.frequencyRank,
        learningValueScore: word.learningValueScore,
        coverageTags: word.coverageTags
      }))
    }];
  }).sort((left, right) => (
    right.readinessScore - left.readinessScore
    || right.exactEvidenceCount - left.exactEvidenceCount
    || left.root.localeCompare(right.root, "en")
  )).slice(0, limit);

  return {
    status: candidates.length >= minimumReadyCandidates ? "sufficient" : "insufficient-evidence",
    evidenceRule: "exact-configured-lexical-cue",
    minimumEvidenceWords,
    minimumReadyCandidates,
    candidates
  };
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}
