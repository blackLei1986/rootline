import type { ArticleCandidate } from "@/types/articles";

export interface RecentArticleHistory {
  articleId: string;
  sourceTitle: string;
  completed?: boolean;
  hidden?: boolean;
}

const MIN_CANDIDATE_SCORE = 60;
const MIN_CONTENT_WORD_COVERAGE = 88;
const MAX_CONTENT_WORD_COVERAGE = 99;
const MAX_BUDGET_DIFFERENCE_MINUTES = 3;
const MAX_RECENT_ARTICLES_PER_SOURCE = 2;

export function selectTodayArticle(
  candidates: ArticleCandidate[],
  recentHistory: RecentArticleHistory[],
  budgetMinutes: number
): ArticleCandidate | null {
  const excludedArticleIds = new Set(
    recentHistory
      .filter((entry) => entry.completed || entry.hidden)
      .map((entry) => entry.articleId)
  );
  const recentSourceCounts = new Map<string, number>();

  for (const entry of recentHistory) {
    recentSourceCounts.set(entry.sourceTitle, (recentSourceCounts.get(entry.sourceTitle) ?? 0) + 1);
  }

  return candidates
    .filter((candidate) => !excludedArticleIds.has(candidate.articleId))
    .filter((candidate) => candidate.score >= MIN_CANDIDATE_SCORE)
    .filter((candidate) => candidate.contentWordCoverage >= MIN_CONTENT_WORD_COVERAGE)
    .filter((candidate) => candidate.contentWordCoverage <= MAX_CONTENT_WORD_COVERAGE)
    .filter((candidate) => Math.abs(candidate.estimatedMinutes - budgetMinutes) <= MAX_BUDGET_DIFFERENCE_MINUTES)
    .filter((candidate) => (recentSourceCounts.get(candidate.sourceTitle) ?? 0) < MAX_RECENT_ARTICLES_PER_SOURCE)
    .sort((left, right) => right.score - left.score || left.articleId.localeCompare(right.articleId))[0] ?? null;
}
