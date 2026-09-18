import type { VocabularyBand, VocabularyGoalType } from "@/types/vocabulary";

export type ReviewRating = "again" | "hard" | "good" | "easy";

export type LearningStatus = "new" | "learning" | "review" | "mastered";

/** A learner's immediate self-assessment, separate from long-term SRS state. */
export type RecognitionState = "known" | "fuzzy" | "unknown";

export type LearningPath = "general" | "ielts" | "toefl" | "ielts-toefl" | "academic";

export type SessionLengthMinutes = 10 | 20 | 30;

export interface LearningGoal {
  path: LearningPath;
  vocabularyBand: VocabularyBand;
  sessionMinutes: SessionLengthMinutes;
  goalType: VocabularyGoalType;
}

export type LearningEventType =
  | "word_seen"
  | "recognition_known"
  | "recognition_fuzzy"
  | "recognition_unknown"
  | "quiz_correct"
  | "quiz_wrong"
  | "sentence_understood"
  | "review_completed"
  | "session_completed"
  | "reading_encounter"
  | "reading_lookup"
  | "reading_queue_added";

export type LearningSource = "course" | "rapid" | "reading" | "manual-search";

export interface WordEncounterSummary {
  totalCount: number;
  readingCount: number;
  quizCount: number;
  sentenceCount: number;
  lastEncounterAt: string | null;
}

export interface LearningEvent {
  id: string;
  type: LearningEventType;
  timestamp: string;
  wordId?: string;
  sessionId?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface CalibrationProfile {
  completedAt: string;
  sampleSize: number;
  knownCount: number;
  fuzzyCount: number;
  unknownCount: number;
  estimatedBand: VocabularyBand;
  confidence: number;
}

export interface WordProgress {
  wordId: string;
  status: LearningStatus;
  recognitionState: RecognitionState | null;
  recognitionConfidence: number;
  recognitionCount: number;
  knownCount: number;
  fuzzyCount: number;
  unknownCount: number;
  lastRecognizedAt: string | null;
  averageResponseTime: number | null;
  lastResponseTime: number | null;
  fluencyScore: number;
  verificationDue: boolean;
  verificationCorrectCount: number;
  verificationWrongCount: number;
  reviewCount: number;
  correctCount: number;
  wrongCount: number;
  streak: number;
  lapses: number;
  memoryStrength: number;
  difficulty: number;
  intervalMinutes: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  firstLearnedAt: string | null;
  lastRating: ReviewRating | null;
  firstSeenSource: LearningSource | null;
  encounters: WordEncounterSummary;
}

export interface RootProgress {
  rootId: string;
  status: LearningStatus;
  learnedWordIds: string[];
  mastery: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
}

export interface DailyStats {
  date: string;
  newWordsLearned: number;
  reviewsCompleted: number;
  correctAnswers: number;
  wrongAnswers: number;
  sessionsCompleted: number;
  studyMinutes: number;
}

export interface LearningStorage {
  version: number;
  words: Record<string, WordProgress>;
  roots: Record<string, RootProgress>;
  dailyStats: Record<string, DailyStats>;
  events: LearningEvent[];
  calibration: CalibrationProfile | null;
  settings: {
    dailyNewWordGoal: number;
    dailyReviewGoal: number;
    learningGoal: LearningGoal;
  };
  transferStats: {
    attempts: number;
    correct: number;
  };
}
