import type { AIMetadata, ContentStatus, CoverageTag, ExamRelevance, SourceMetadata, VocabularyBand } from "@/types/vocabulary";

export interface SeedWord { word: string; source: string; sourceRank?: number; }
export interface CandidateSentence {
  text: string;
  translationZh: string;
  kind: "simple" | "common" | "academic";
  naturalnessScore: number;
  utilityScore: number;
  difficultyScore: number;
}
export interface VocabularyCandidatePayload {
  id: string;
  lemma: string;
  word: string;
  partOfSpeech: string[];
  coreMeaningZh: string;
  coreDefinitionEn: string;
  vocabularyBand: VocabularyBand;
  coverageTags: CoverageTag[];
  examRelevance: ExamRelevance;
  morphology: string;
  rootIds: string[];
  collocations: string[];
  sentences: CandidateSentence[];
  family: string[];
  memoryHook: string;
  sourceMetadata: SourceMetadata;
  aiMetadata: AIMetadata;
}
export interface VocabularyCandidate {
  id: string;
  status: ContentStatus;
  attempts: number;
  failureReason?: string;
  qualityScore?: number;
  duplicateOf?: string;
  payload?: VocabularyCandidatePayload;
  seed: SeedWord;
  updatedAt: string;
}
export interface PipelineState { vocabularyVersion: string; candidates: VocabularyCandidate[]; }
export interface PipelineRunOptions { limit: number; dryRun: boolean; }
