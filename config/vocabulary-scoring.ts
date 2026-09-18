export const VOCABULARY_VERSION = "2026.09.v1";
export const VALIDATION_VERSION = "vocabulary-schema.v1";
export const VOCABULARY_SCORING_WEIGHTS = Object.freeze({ frequency: 0.3, generalUtility: 0.2, academicUtility: 0.15, examRelevance: 0.15, familyValue: 0.1, transferValue: 0.1 });
export const QUALITY_THRESHOLDS = Object.freeze({ autoAccept: 85, needsReview: 70, sentenceCatalog: 78, sourceConfidenceForFactFields: 80 });
export const PIPELINE_LIMITS = Object.freeze({ batchSize: 50, maxRetries: 3, sentenceKnownWordRatio: 0.8 });
