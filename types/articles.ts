import type { CoverageTag, VocabularyBand } from "@/types/vocabulary";

export type ArticleExtractionState = "pending" | "extracted" | "rejected" | "failed";
export type ArticleAnalysisState = "metadata" | "full" | "stale";

export interface ArticleRecord {
  id: string;
  feedSourceId: string | null;
  externalId: string | null;
  canonicalUrl: string;
  publisherUrl: string;
  title: string;
  author: string | null;
  summary: string | null;
  publishedAt: string | null;
  language: string;
  contentFingerprint: string | null;
  extractionState: ArticleExtractionState;
}

export interface ExtractedArticle {
  publisherUrl: string;
  canonicalUrl: string;
  title: string;
  byline: string | null;
  excerpt: string | null;
  text: string;
  wordCount: number;
  language: string;
}

export interface ArticleIdentity {
  canonicalUrl: string;
  contentFingerprint: string | null;
  identityKey: string;
}

export interface MetadataAnalysis {
  estimatedMinutes: number;
  likelyLanguage: string;
  topicTerms: string[];
  eligible: boolean;
  rejectionReason: string | null;
}

export interface ArticleVocabularyMatch {
  wordId: string;
  lemma: string;
  familyId: string;
  occurrences: number;
  frequencyRank: number;
  learningValue: number;
  vocabularyBand: VocabularyBand;
  coverageTags: CoverageTag[];
}

export interface ArticleAnalysis {
  articleId: string;
  analysisState: ArticleAnalysisState;
  vocabularyVersion: string;
  wordCount: number;
  uniqueLemmaCount: number;
  estimatedMinutes: number;
  lexicalMatches: ArticleVocabularyMatch[];
  analyzedAt: string;
}

export interface ArticleCandidate {
  articleId: string;
  title: string;
  sourceTitle: string;
  canonicalUrl: string;
  estimatedMinutes: number;
  contentWordCoverage: number;
  valuableUnknownWordIds: string[];
  score: number;
  explanationCodes: string[];
}

export interface AnalysisRunResult {
  considered: number;
  extracted: number;
  analyzed: number;
  rejected: number;
}
