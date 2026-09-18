export type ReadingKnowledgeState = "fluent" | "known" | "fuzzy" | "unknown" | "untracked";
export type ReadingMatchStatus = "matched" | "proper-noun" | "number" | "unknown";
export type ReadingRecommendationBand = "must-learn" | "worth-learning" | "can-infer" | "ignore";
export type ReadingSourceType = "general" | "ielts" | "toefl" | "academic" | "news" | "other";

export interface ReadingTokenMatch {
  id: string;
  token: string;
  normalized: string;
  lemma?: string;
  wordId?: string;
  familyId?: string;
  start: number;
  end: number;
  sentenceIndex: number;
  status: ReadingMatchStatus;
  knowledgeState: ReadingKnowledgeState;
  isContentWord: boolean;
}

export interface ReadingCoverage {
  overallTokenCoverage: number;
  contentWordCoverage: number;
  stableCoverage: number;
  lemmaCoverage: number;
  familyCoverage: number;
  unknownContentWords: number;
  fuzzyContentWords: number;
  untrackedContentWords: number;
  contentWordCount: number;
}

export interface ReadingVocabularyItem {
  wordId: string;
  lemma: string;
  familyId: string;
  knowledgeState: ReadingKnowledgeState;
  occurrences: number;
  occurrenceTokenIds: string[];
  contextSentence: string;
  contextImportance: number;
  recommendationScore: number;
  recommendation: ReadingRecommendationBand;
  canInfer: boolean;
}

export interface ReadingPhraseMatch {
  phraseId: string;
  text: string;
  startTokenIndex: number;
  endTokenIndex: number;
  sentenceIndex: number;
}

export interface ReadingPatternMatch {
  patternId: string;
  text: string;
  sentenceIndex: number;
}

export interface ReadingDocument {
  id: string;
  title?: string;
  text: string;
  sourceType: ReadingSourceType;
  createdAt: string;
  wordCount: number;
  uniqueLemmaCount: number;
  documentDifficulty: number;
  userDifficulty: number;
  difficultyLabel: "easy" | "comfortable" | "challenging" | "hard";
  coverage: ReadingCoverage;
  unknownDensity: number;
  academicVocabularyRatio: number;
  tokens: ReadingTokenMatch[];
  vocabulary: ReadingVocabularyItem[];
  phrases: ReadingPhraseMatch[];
  patterns: ReadingPatternMatch[];
  sentences: string[];
  analysisVersion: string;
}

export interface ReadingProgress {
  documentId: string;
  startedAt: string;
  completedAt?: string;
  readingSeconds?: number;
  clickedWordIds: string[];
  learnedWordIds: string[];
  unknownBefore?: number;
  unknownAfter?: number;
  coverageBefore?: number;
  coverageAfter?: number;
}

export interface ReadingLearningItem {
  documentId: string;
  wordId: string;
  contextSentence: string;
  contextImportance: number;
  recommendationScore: number;
  status: "pending" | "learning" | "completed" | "skipped";
}

export interface PersonalSentence {
  id: string;
  documentId: string;
  text: string;
  targetWordIds: string[];
  createdAt: string;
}

export interface ReadingStore {
  version: number;
  documents: Record<string, ReadingDocument>;
  progress: Record<string, ReadingProgress>;
  learningQueue: ReadingLearningItem[];
  personalSentences: PersonalSentence[];
}
