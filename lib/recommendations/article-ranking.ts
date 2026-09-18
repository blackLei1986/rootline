import type { ArticleCandidate } from "@/types/articles";

export interface ArticleRankingInput {
  articleId: string;
  title: string;
  sourceTitle: string;
  canonicalUrl: string;
  estimatedMinutes: number;
  timeBudgetMinutes: number;
  contentWordCoverage: number;
  valuableUnknownWordIds: string[];
  pathFit: number;
  recentSourceCount: number;
  hidden: boolean;
  completed: boolean;
}

export function rankArticleCandidates(inputs: ArticleRankingInput[]): ArticleCandidate[] {
  return inputs
    .filter((input) => !input.hidden && !input.completed)
    .map(scoreCandidate)
    .sort((left, right) => right.score - left.score || left.articleId.localeCompare(right.articleId))
    .slice(0, 3);
}

function scoreCandidate(input: ArticleRankingInput): ArticleCandidate {
  const unknownCount = input.valuableUnknownWordIds.length;
  const coverageScore = Math.max(0, 50 - Math.abs(96 - input.contentWordCoverage) * 3);
  const unknownScore = unknownCount >= 3 && unknownCount <= 8
    ? 25
    : Math.max(0, 25 - Math.min(Math.abs(unknownCount - 5), 10) * 4);
  const pathScore = Math.max(0, Math.min(1, input.pathFit)) * 15;
  const timeScore = Math.max(0, 10 - Math.abs(input.estimatedMinutes - input.timeBudgetMinutes) * 1.5);
  const diversityPenalty = Math.min(20, input.recentSourceCount * 4);
  const explanationCodes: string[] = [];

  if (input.contentWordCoverage >= 92 && input.contentWordCoverage <= 98) {
    explanationCodes.push("coverage-fit");
  }
  if (unknownCount >= 3 && unknownCount <= 8) explanationCodes.push("valuable-new-words");
  if (input.estimatedMinutes <= input.timeBudgetMinutes) explanationCodes.push("time-fit");
  if (input.pathFit >= 0.7) explanationCodes.push("path-fit");
  if (diversityPenalty > 0) explanationCodes.push("source-diversity-penalty");

  return {
    articleId: input.articleId,
    title: input.title,
    sourceTitle: input.sourceTitle,
    canonicalUrl: input.canonicalUrl,
    estimatedMinutes: input.estimatedMinutes,
    contentWordCoverage: input.contentWordCoverage,
    valuableUnknownWordIds: input.valuableUnknownWordIds,
    score: round(coverageScore + unknownScore + pathScore + timeScore - diversityPenalty),
    explanationCodes
  };
}

function round(value: number): number {
  return Math.round(value * 1_000) / 1_000;
}
