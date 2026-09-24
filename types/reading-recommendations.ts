export type DifficultyPreference = "easy" | "balanced" | "challenging";

export interface DailyRecommendationWord {
  wordId: string;
  lemma: string;
}

export interface RecentLearningWord extends DailyRecommendationWord {
  learnedAt: string;
}

export interface DailyRecommendationLexicalMatch {
  wordId: string;
  lemma: string;
  occurrences: number;
  titleOccurrences?: number;
}

export interface DailyReadingCandidate {
  articleId: string;
  title: string;
  canonicalUrl: string;
  publisherUrl: string;
  sourceKey: string;
  publishedAt: string | null;
  ingestedAt: string;
  contentFingerprint: string | null;
  summary: string | null;
  language: string;
  contentWordCount: number;
  lexicalMatches: DailyRecommendationLexicalMatch[];
  sourceReliability: number;
}

export interface DailyRecommendationScores {
  todayMatches: number;
  recentMatches: number;
  difficultyFit: number;
  freshness: number;
  sourceQuality: number;
  total: number;
}

export interface EstimatedUnknownCoverage {
  percent: number;
  approximate: true;
  basis: "tracked-vocabulary-match-occurrences";
}

export interface DailyReadingRecommendation {
  articleId: string;
  title: string;
  canonicalUrl: string;
  publisherUrl: string;
  sourceKey: string;
  sourceTitle: string;
  attribution: string;
  publishedAt: string | null;
  summary: string | null;
  scores: DailyRecommendationScores;
  matchedTodayWordIds: string[];
  matchedRecentWordIds: string[];
  estimatedUnknownCoverage: EstimatedUnknownCoverage;
  reasonCodes: string[];
}

export interface DailyReadingRecommendationResult {
  algorithmVersion: string;
  generatedAt: string;
  recommendations: DailyReadingRecommendation[];
}
