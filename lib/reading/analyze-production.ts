import { getProductionReadingIndex, type ProductionReadingEntry } from "@/lib/reading/production-index";
import type { ArticleAnalysis, ArticleVocabularyMatch } from "@/types/articles";
import type { LearningStorage } from "@/types/progress";
import type { VocabularyBand } from "@/types/vocabulary";

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for", "from",
  "had", "has", "have", "he", "her", "his", "i", "in", "is", "it", "its", "not",
  "of", "on", "or", "our", "she", "that", "the", "their", "they", "this", "to", "was",
  "we", "were", "will", "with", "you", "your"
]);

export interface ProductionArticleInput {
  id: string;
  title: string;
  text: string;
  wordCount?: number;
}

export interface LearnerArticleAnalysis extends ArticleAnalysis {
  contentWordCoverage: number;
  valuableUnknownWordIds: string[];
  unknownContentWordIds: string[];
}

export async function analyzeArticleForLearner(
  article: ProductionArticleInput,
  learner: LearningStorage,
  now = new Date()
): Promise<LearnerArticleAnalysis> {
  const index = await getProductionReadingIndex();
  const tokens = article.text.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g)?.map(normalize) ?? [];
  const contentTokens = tokens.filter((token) => !STOPWORDS.has(token));
  const occurrences = new Map<string, { entry: ProductionReadingEntry; count: number }>();
  let stableCount = 0;
  let trackedContentCount = 0;

  for (const token of contentTokens) {
    const entry = index.bySurfaceForm.get(token);
    if (!entry) continue;
    trackedContentCount += 1;
    const current = occurrences.get(entry.id);
    occurrences.set(entry.id, { entry, count: (current?.count ?? 0) + 1 });
    const state = learner.words[entry.id] ?? learner.words[entry.lemma];
    if (state?.recognitionState === "known" || state?.status === "mastered") stableCount += 1;
  }

  const lexicalMatches: ArticleVocabularyMatch[] = [...occurrences.values()].map(({ entry, count }) => ({
    wordId: entry.id,
    lemma: entry.lemma,
    familyId: entry.familyId,
    occurrences: count,
    frequencyRank: entry.frequencyRank,
    learningValue: entry.learningValue,
    vocabularyBand: vocabularyBand(entry),
    coverageTags: entry.coverageTags
  }));
  const unknown = lexicalMatches.filter((match) => {
    const state = learner.words[match.wordId] ?? learner.words[match.lemma];
    return !state || state.recognitionState === "unknown" || state.recognitionState === "fuzzy";
  });
  const valuableUnknownWordIds = unknown
    .filter((match) => match.learningValue >= 50 && match.frequencyRank <= 12_000)
    .sort((left, right) => right.learningValue - left.learningValue || left.frequencyRank - right.frequencyRank)
    .slice(0, 12)
    .map((match) => match.wordId);
  const denominator = Math.max(1, contentTokens.length);
  const assumedKnownUntracked = Math.max(0, contentTokens.length - trackedContentCount);
  const contentWordCoverage = ((stableCount + assumedKnownUntracked) / denominator) * 100;

  return {
    articleId: article.id,
    analysisState: "full",
    vocabularyVersion: index.vocabularyVersion,
    wordCount: article.wordCount ?? tokens.length,
    uniqueLemmaCount: new Set(lexicalMatches.map((match) => match.lemma)).size,
    estimatedMinutes: Math.max(1, Math.ceil((article.wordCount ?? tokens.length) / 220)),
    lexicalMatches,
    analyzedAt: now.toISOString(),
    contentWordCoverage: round(contentWordCoverage),
    valuableUnknownWordIds,
    unknownContentWordIds: unknown.map((match) => match.wordId)
  };
}

function normalize(value: string): string {
  return value.normalize("NFKC").toLowerCase().replaceAll("’", "'");
}

function vocabularyBand(entry: ProductionReadingEntry): VocabularyBand {
  switch (entry.contentTier) {
    case "tier-1-core": return "core-3000";
    case "tier-2-important": return "core-5000";
    case "tier-3-recognition": return "academic";
    case "tier-4-extension": return "advanced";
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
