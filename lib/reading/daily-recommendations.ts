import { canonicalizeArticleUrl } from "@/lib/articles/canonicalize";
import { eligibleCuratedReadingSources, type CuratedReadingSource } from "@/data/curated-reading-sources";
import type {
  DailyReadingCandidate,
  DailyReadingRecommendation,
  DailyReadingRecommendationResult,
  DailyRecommendationWord,
  DifficultyPreference,
  RecentLearningWord
} from "@/types/reading-recommendations";

export type { DailyReadingCandidate } from "@/types/reading-recommendations";

export interface RankDailyReadingRecommendationsInput {
  candidates: readonly DailyReadingCandidate[];
  todayTargets: readonly DailyRecommendationWord[];
  recentWords: readonly RecentLearningWord[];
  knownWordIds: readonly string[];
  difficultyPreference: DifficultyPreference;
  now: string | Date;
  sources?: readonly CuratedReadingSource[];
}

interface ScoredCandidate {
  recommendation: DailyReadingRecommendation;
  contentFingerprint: string | null;
  canonicalUrl: string;
  titleTokens: Set<string>;
  publishedTime: number;
}

const ALGORITHM_VERSION = "daily-3-v1" as const;
const FRESHNESS_WINDOW_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEIGHTS = { todayMatches: 0.45, recentMatches: 0.2, difficultyFit: 0.15, freshness: 0.1, sourceQuality: 0.1 } as const;
const DIFFICULTY_TARGET_UNKNOWN_SHARE: Record<DifficultyPreference, number> = {
  easy: 0.05,
  balanced: 0.15,
  challenging: 0.3
};

export function rankDailyReadingRecommendations(
  input: RankDailyReadingRecommendationsInput
): DailyReadingRecommendationResult {
  const now = input.now instanceof Date ? input.now.getTime() : Date.parse(input.now);
  if (!Number.isFinite(now)) throw new Error("Daily recommendation clock must be a valid instant.");
  const sources = input.sources ?? eligibleCuratedReadingSources;
  const sourceByKey = new Map(sources
    .filter((source) => source.enabled && source.language === "en")
    .map((source) => [source.key, source]));
  const todayIds = new Set(input.todayTargets.map((word) => word.wordId));
  const todayLemmas = new Set(input.todayTargets.map((word) => normalizeLemma(word.lemma)));
  const recentWords = input.recentWords.filter((word) => {
    const learnedAt = Date.parse(word.learnedAt);
    return Number.isFinite(learnedAt)
      && learnedAt <= now
      && learnedAt >= now - 30 * DAY_MS
      && !todayIds.has(word.wordId)
      && !todayLemmas.has(normalizeLemma(word.lemma));
  });
  const knownIds = new Set(input.knownWordIds);

  const scored = input.candidates.flatMap((candidate) => {
    const source = sourceByKey.get(candidate.sourceKey);
    if (!source || !/^en(?:[-_]|$)/i.test(candidate.language) || !candidate.title.trim()) return [];
    let canonicalUrl: string;
    try {
      canonicalUrl = canonicalizeArticleUrl(candidate.canonicalUrl);
    } catch {
      return [];
    }
    const matchedTodayWordIds = matchWordIds(candidate.lexicalMatches, input.todayTargets);
    const matchedRecentWordIds = matchWordIds(candidate.lexicalMatches, recentWords);
    if (matchedTodayWordIds.length === 0 && matchedRecentWordIds.length === 0) return [];
    const estimatedUnknownCoverage = estimateUnknownCoverage(candidate, knownIds);
    const scores = {
      todayMatches: distinctMatchScore(matchedTodayWordIds.length),
      recentMatches: distinctMatchScore(matchedRecentWordIds.length),
      difficultyFit: difficultyFitScore(estimatedUnknownCoverage.percent / 100, input.difficultyPreference),
      freshness: freshnessScore(candidate.publishedAt ?? candidate.ingestedAt, now),
      sourceQuality: sourceQualityScore(source.qualityScore, candidate.sourceReliability),
      total: 0
    };
    scores.total = round(
      scores.todayMatches * WEIGHTS.todayMatches
      + scores.recentMatches * WEIGHTS.recentMatches
      + scores.difficultyFit * WEIGHTS.difficultyFit
      + scores.freshness * WEIGHTS.freshness
      + scores.sourceQuality * WEIGHTS.sourceQuality
    );
    const reasonCodes = [
      ...(matchedTodayWordIds.length ? ["today-target-match"] : []),
      ...(matchedRecentWordIds.length ? ["recent-learning-match"] : []),
      ...(scores.difficultyFit >= 70 ? ["difficulty-fit"] : []),
      ...(scores.freshness >= 70 ? ["fresh-article"] : []),
      ...(scores.sourceQuality >= 70 ? ["reliable-curated-source"] : [])
    ];
    const recommendation: DailyReadingRecommendation = {
      articleId: candidate.articleId,
      title: candidate.title.trim(),
      canonicalUrl,
      publisherUrl: candidate.publisherUrl,
      sourceKey: candidate.sourceKey,
      sourceTitle: source.title,
      attribution: source.attribution,
      publishedAt: candidate.publishedAt,
      summary: candidate.summary,
      scores,
      matchedTodayWordIds,
      matchedRecentWordIds,
      estimatedUnknownCoverage,
      reasonCodes
    };
    const effectiveTime = Date.parse(candidate.publishedAt ?? candidate.ingestedAt);
    return [{
      recommendation,
      contentFingerprint: candidate.contentFingerprint,
      canonicalUrl,
      titleTokens: titleTokens(candidate.title),
      publishedTime: Number.isFinite(effectiveTime) ? effectiveTime : 0
    }];
  });

  scored.sort((left, right) =>
    right.recommendation.scores.total - left.recommendation.scores.total
    || right.publishedTime - left.publishedTime
    || compareText(left.recommendation.articleId, right.recommendation.articleId)
  );
  const unique: ScoredCandidate[] = [];
  for (const candidate of scored) {
    if (unique.some((selected) => isDuplicate(selected, candidate))) continue;
    unique.push(candidate);
    if (unique.length === 3) break;
  }

  return {
    algorithmVersion: ALGORITHM_VERSION,
    generatedAt: new Date(now).toISOString(),
    recommendations: unique.map((item) => item.recommendation)
  };
}

function matchWordIds(
  lexicalMatches: DailyReadingCandidate["lexicalMatches"],
  targets: readonly DailyRecommendationWord[]
): string[] {
  const targetById = new Map(targets.map((target) => [target.wordId, target]));
  const targetsByLemma = new Map<string, DailyRecommendationWord[]>();
  for (const target of targets) {
    const lemma = normalizeLemma(target.lemma);
    targetsByLemma.set(lemma, [...(targetsByLemma.get(lemma) ?? []), target]);
  }
  const matched = new Set<string>();
  for (const lexical of [...lexicalMatches].sort((left, right) => compareText(left.wordId, right.wordId))) {
    const exact = targetById.get(lexical.wordId);
    if (exact) {
      matched.add(exact.wordId);
      continue;
    }
    const lemmaMatch = targetsByLemma.get(normalizeLemma(lexical.lemma))
      ?.find((target) => !matched.has(target.wordId));
    if (lemmaMatch) matched.add(lemmaMatch.wordId);
  }
  return [...matched].sort(compareText);
}

function estimateUnknownCoverage(candidate: DailyReadingCandidate, knownIds: ReadonlySet<string>) {
  const trackedOccurrences = candidate.lexicalMatches.reduce((sum, match) => sum + nonNegativeInteger(match.occurrences), 0);
  const unknownOccurrences = candidate.lexicalMatches
    .filter((match) => !knownIds.has(match.wordId))
    .reduce((sum, match) => sum + nonNegativeInteger(match.occurrences), 0);
  const denominator = Math.max(nonNegativeInteger(candidate.contentWordCount), trackedOccurrences);
  const percent = denominator ? round(Math.min(100, unknownOccurrences / denominator * 100)) : 0;
  return { percent, approximate: true as const, basis: "tracked-vocabulary-match-occurrences" as const };
}

function distinctMatchScore(count: number): number {
  // A word earns at most one unit regardless of repeats; only new target lemmas add value.
  return round(Math.min(100, count / 4 * 100));
}

function difficultyFitScore(unknownShare: number, preference: DifficultyPreference): number {
  const target = DIFFICULTY_TARGET_UNKNOWN_SHARE[preference];
  const tolerance = Math.max(target, 0.5 - target);
  return round(Math.max(0, 1 - Math.abs(unknownShare - target) / tolerance) * 100);
}

function freshnessScore(value: string, now: number): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 0;
  const ageDays = Math.max(0, (now - timestamp) / DAY_MS);
  return round(Math.max(0, 100 * (1 - ageDays / FRESHNESS_WINDOW_DAYS)));
}

function sourceQualityScore(quality: number, reliability: number): number {
  const boundedQuality = clamp(quality, 0, 100);
  const boundedReliability = clamp(reliability, 0, 1) * 100;
  return round(boundedQuality * 0.7 + boundedReliability * 0.3);
}

function isDuplicate(left: ScoredCandidate, right: ScoredCandidate): boolean {
  if (left.canonicalUrl === right.canonicalUrl) return true;
  if (left.contentFingerprint && right.contentFingerprint && left.contentFingerprint === right.contentFingerprint) return true;
  return titleSimilarity(left.titleTokens, right.titleTokens) >= 0.85;
}

function titleSimilarity(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  if (left.size < 4 || right.size < 4) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection++;
  return intersection / (left.size + right.size - intersection);
}

function titleTokens(value: string): Set<string> {
  const stop = new Set(["a", "an", "and", "as", "at", "by", "for", "from", "in", "of", "on", "the", "to", "with"]);
  return new Set(normalizeLemma(value).match(/[a-z0-9]+/g)?.filter((token) => !stop.has(token)) ?? []);
}

function normalizeLemma(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-US").trim();
}

function nonNegativeInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min;
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
