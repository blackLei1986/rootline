export type Difficulty = "easy" | "medium" | "hard";
export type { LearningStatus } from "@/types/progress";
import type { AIMetadata, ContentTier, CoverageTag, ExamRelevance, FrequencyProfile, MorphologyConfidence, PipelineStatus, RelatedWord, RootCategory, RootTier, RootValueMetrics, SourceMetadata, VocabularyBand, VocabularyGoalType, VocabularyPriorityMetrics, WordLearningMetrics, WordRootRelation, WordSense, WordVariant } from "@/types/vocabulary";

export interface Root {
  id: string;
  root: string;
  meaningEn: string[];
  meaningZh: string[];
  origin?: string;
  description: string;
  mnemonic?: string;
  difficulty: Difficulty;
  priority: number;
  category: RootCategory;
  valueMetrics: RootValueMetrics;
  rootValueScore: number;
  learningRationale: string;
  relatedRootIds: string[];
}

export interface Word {
  id: string;
  word: string;
  phonetic?: string;
  partOfSpeech: string[];
  meaningZh: string[];
  meaningEn?: string[];
  frequency: FrequencyProfile;
  cefr?: "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
  vocabularyBand: VocabularyBand;
  coverageTags: CoverageTag[];
  examRelevance: ExamRelevance;
  priorityMetrics: VocabularyPriorityMetrics;
  priorityScore: number;
  variants?: WordVariant;
  rootTier: RootTier;
  learningMetrics: WordLearningMetrics;
  learningValueScore: number;
  learningGoal: VocabularyGoalType;
  activePriority: number;
  contentTier: ContentTier;
  pipelineStatus: PipelineStatus;
  morphologyConfidence: MorphologyConfidence;
  staticDifficulty: number;
  lemma: string;
  wordFamilyId: string;
  senses: WordSense[];
  rootRelations: WordRootRelation[];
  related: RelatedWord[];
  confusableWith?: string[];
  synonyms: string[];
  antonyms: string[];
  rootIds: string[];
  prefix?: { form: string; meaning: string };
  suffix?: { form: string; meaning: string };
  morphology: string;
  literalMeaning: string;
  semanticEvolution: string[];
  mnemonic?: string;
  collocations: string[];
  phraseIds: string[];
  sentenceIds: string[];
  examples: { en: string; zh: string }[];
  memoryHook?: string;
  sourceMetadata: SourceMetadata;
  aiMetadata: AIMetadata;
  family: string[];
  relatedWords: string[];
}

export type {
  CalibrationProfile,
  DailyStats,
  LearningEvent,
  LearningEventType,
  LearningGoal,
  LearningPath,
  LearningStorage,
  RootProgress,
  RecognitionState,
  ReviewRating,
  SessionLengthMinutes,
  WordProgress
} from "@/types/progress";
export type { RapidLearningItem, RapidQuizAnswer, RapidRecognitionResult, RapidSession, RapidSessionPhase, RapidSessionSize } from "@/types/rapid-session";
export type { QuizMode, QuizQuestion } from "@/types/quiz";
export type {
  LearningItemType,
  LearningSession,
  LearningSessionItem,
  LearningStage,
  SessionAnswer
} from "@/types/session";
export type { Course, CourseStage, CourseUnit, StageUnlockRule } from "@/types/course";
export type { PersonalSentence, ReadingCoverage, ReadingDocument, ReadingKnowledgeState, ReadingLearningItem, ReadingMatchStatus, ReadingPatternMatch, ReadingPhraseMatch, ReadingProgress, ReadingRecommendationBand, ReadingSourceType, ReadingStore, ReadingTokenMatch, ReadingVocabularyItem } from "@/types/reading";
export type { AIMetadata, CefrLevel, ContentStatus, ContentTier, CoverageTag, ExamRelevance, FrequencyBand, FrequencyProfile, LearningEntityType, MasterVocabularyStats, MorphologyConfidence, Phrase, PhraseType, PipelineStatus, ProductionVocabularyEntry, QuizCandidate, RelatedWord, RelatedWordType, RootCategory, RootTier, RootValueMetrics, Sentence, SentencePattern, SourceMetadata, SourceReference, VocabularyBand, VocabularyGoalType, VocabularyPriorityMetrics, WordFamily, WordLearningMetrics, WordRootRelation, WordSense, WordVariant } from "@/types/vocabulary";
export type { FeedErrorCode, FeedFetchState, FeedRefreshResult, FeedSourceDTO, NormalizedFeed, NormalizedFeedEntry, OpmlSubscription } from "@/types/feeds";
export type { AnalysisRunResult, ArticleAnalysis, ArticleAnalysisState, ArticleCandidate, ArticleExtractionState, ArticleIdentity, ArticleRecord, ArticleVocabularyMatch, ExtractedArticle, MetadataAnalysis } from "@/types/articles";
