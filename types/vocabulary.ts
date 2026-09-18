export type FrequencyBand = "very-high" | "high" | "medium" | "low";
export type VocabularyBand = "core-1000" | "core-2000" | "core-3000" | "core-5000" | "academic" | "advanced";
export type CoverageTag = "general" | "academic" | "ielts" | "toefl";
export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type RootTier = "core" | "extension" | "advanced";
export type RootCategory = "vision" | "speech" | "writing" | "movement" | "carrying" | "thinking" | "building" | "position" | "action" | "other";
export type ContentStatus = "pending" | "generated" | "validated" | "accepted" | "rejected" | "needs-review";
export type VocabularyGoalType = "recognition" | "understanding" | "active-use";
export type ContentTier = "tier-1-core" | "tier-2-important" | "tier-3-recognition" | "tier-4-extension";
export type PipelineStatus = "seed" | "normalized" | "enriched" | "validated" | "review" | "accepted" | "rejected";
export type MorphologyConfidence = "high" | "medium" | "low" | "none";

export interface FrequencyProfile {
  band: FrequencyBand;
  rank?: number;
  source?: string;
  confidence?: number;
}

export interface ExamRelevance { ielts: number; toefl: number; academic: number; general: number; }
export interface SourceReference { name: string; version?: string; url?: string; note?: string; }
export interface SourceMetadata {
  frequencySources: SourceReference[];
  academicSources: SourceReference[];
  examSources: SourceReference[];
  generatedAt: string;
  generatedBy: string;
  reviewedAt?: string;
  confidence: number;
}
export interface AIMetadata {
  generated: boolean;
  model?: string;
  generatedAt?: string;
  validationVersion: string;
  promptVersions?: string[];
  confidence: number;
  needsReview: boolean;
}
export interface WordVariant { american?: string; british?: string; }
export interface RootValueMetrics { frequencyCoverage: number; usefulWordCount: number; morphologyClarity: number; transferValue: number; learnerDifficulty: number; }
export interface WordLearningMetrics { frequencyScore: number; utilityScore: number; familyValue: number; morphologyClarity: number; complexityPenalty: number; }
export interface VocabularyPriorityMetrics {
  frequency: number;
  generalUtility: number;
  academicUtility: number;
  examRelevance: number;
  familyValue: number;
  transferValue: number;
  contextUtility: number;
  difficulty: number;
  readingDistinctArticles?: number;
  readingDistinctSources?: number;
}
export interface WordRootRelation { wordId: string; rootId: string; confidence: "high" | "medium" | "low"; relationType: "historical" | "morphological" | "teaching"; }
export interface WordSense {
  id: string;
  partOfSpeech: string;
  definitionEn?: string;
  meaningZh: string;
  isCore: boolean;
  usageFrequency: number;
  frequencyRank?: number;
  cefr?: CefrLevel;
  exampleSentenceIds: string[];
  collocationIds: string[];
}
export type RelatedWordType = "same-root" | "word-family" | "synonym" | "antonym" | "confusable" | "semantic-related";
export interface RelatedWord { wordId: string; type: RelatedWordType; }
export interface WordFamily { id: string; headword: string; memberIds: string[]; lemmaCount: number; surfaceWordCount: number; coverageTags: CoverageTag[]; }
export type PhraseType = "collocation" | "phrasal-verb" | "fixed-expression" | "academic-phrase" | "spoken-expression";
export interface Phrase {
  id: string;
  text: string;
  meaningZh: string;
  type: PhraseType;
  frequency: FrequencyBand;
  targetWordIds: string[];
  exampleSentenceIds: string[];
  difficulty: number;
  coverageTags: CoverageTag[];
  qualityScore: number;
  status: ContentStatus;
}
export interface Sentence {
  id: string;
  text: string;
  translationZh: string;
  level: CefrLevel;
  frequencyBand: FrequencyBand;
  topic: string;
  pattern?: string;
  targetWordIds: string[];
  targetPhraseIds: string[];
  difficulty: number;
  sourceType: "editorial" | "licensed" | "ai-candidate";
  aiGenerated: boolean;
  naturalnessScore: number;
  utilityScore: number;
  difficultyScore: number;
  qualityScore: number;
  status: ContentStatus;
}
export interface SentencePattern { id: string; pattern: string; meaningZh: string; usage: string; exampleSentenceIds: string[]; level: CefrLevel; tags: CoverageTag[]; }
export interface QuizCandidate {
  id: string;
  type: "word-meaning" | "meaning-word" | "collocation-blank" | "sentence-cloze" | "root-inference" | "confusable-word";
  prompt: string;
  answer: string;
  distractors: string[];
  sourceEntityIds: string[];
  qualityScore: number;
}
export type LearningEntityType = "word" | "root" | "phrase" | "sentence-pattern";
export interface MasterVocabularyStats { lemmaCount: number; acceptedLemmaCount: number; surfaceWordCount: number; familyCount: number; }

export interface ProductionVocabularyEntry {
  id: string;
  word: string;
  lemma: string;
  wordFamilyId: string;
  surfaceForms: string[];
  phonetic?: string;
  partOfSpeech: string[];
  coreMeaningZh: string;
  coreDefinitionEn: string;
  example: string;
  examples: string[];
  frequencyBand: FrequencyBand;
  frequencyRank: number;
  learningValueScore: number;
  contentTier: ContentTier;
  learningGoal: VocabularyGoalType;
  coverageTags: CoverageTag[];
  pipelineStatus: "accepted";
  morphologyConfidence: MorphologyConfidence;
  sourceMetadata: SourceMetadata;
}
