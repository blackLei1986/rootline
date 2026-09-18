import type { ContextQuestion } from "@/types/context-question";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";

export type TodayPlanStatus = "not-started" | "active" | "complete";
export type TodayStage = "warmup" | "scan" | "learn" | "reading" | "context-quiz" | "summary";

export const TODAY_STAGE_ORDER = Object.freeze([
  "warmup", "scan", "learn", "reading", "context-quiz", "summary"
] as const);

export interface TodayArticleSelection {
  articleId: string;
  title: string;
  sourceTitle: string;
  canonicalUrl: string;
  estimatedMinutes: number;
  contentWordCoverage: number;
  targetWordIds: string[];
  selectionReasons: string[];
}

export interface TodayPlan {
  id: string;
  date: string;
  version: number;
  status: TodayPlanStatus;
  estimatedMinutes: number;
  warmupReviewIds: string[];
  rapidScanEntries: ProductionVocabularyEntry[];
  focusedLearningTarget: number;
  sentenceTarget: number;
  quizTarget: number;
  readingCandidateIds: string[];
  mix: { review: number; newVocabulary: number; reading: number; sentence: number };
  article: TodayArticleSelection | null;
  contextQuestions: ContextQuestion[];
  stages: TodayStage[];
  degradationReason: string | null;
}

export interface TodayPlanDTO extends Omit<TodayPlan, "article"> {
  warmupReviewEntries: ProductionVocabularyEntry[];
  article: (TodayArticleSelection & { text: string }) | null;
}

export interface TodaySessionDTO {
  planId: string;
  status: TodayPlanStatus;
  currentStage: string;
  completedQuestionIds: string[];
}

export function normalizeTodayPlan(value: unknown): TodayPlan {
  const input = record(value);
  if (Array.isArray(input.article)) throw new Error("Today plan supports at most one article.");
  const article = input.article == null ? null : normalizeArticle(input.article);
  const questions = Array.isArray(input.contextQuestions) ? input.contextQuestions.map(normalizeQuestion) : [];
  if (new Set(questions.map((question) => question.id)).size !== questions.length) {
    throw new Error("Today plan contains duplicate question IDs.");
  }
  if (!article && questions.length > 0) throw new Error("Context questions require one Today article.");
  if (article && questions.some((question) => question.articleId !== article.articleId)) {
    throw new Error("Context question article does not match the Today article.");
  }

  return {
    id: text(input.id, "today-legacy"),
    date: text(input.date, ""),
    version: positiveInteger(input.version, 1),
    status: normalizeStatus(input.status),
    estimatedMinutes: positiveInteger(input.estimatedMinutes, 20),
    warmupReviewIds: stringArray(input.warmupReviewIds),
    rapidScanEntries: Array.isArray(input.rapidScanEntries) ? input.rapidScanEntries as ProductionVocabularyEntry[] : [],
    focusedLearningTarget: positiveInteger(input.focusedLearningTarget, 7),
    sentenceTarget: nonnegativeInteger(input.sentenceTarget, 0),
    quizTarget: positiveInteger(input.quizTarget, 5),
    readingCandidateIds: stringArray(input.readingCandidateIds),
    mix: normalizeMix(input.mix),
    article,
    contextQuestions: questions,
    stages: article ? [...TODAY_STAGE_ORDER] : ["warmup", "scan", "learn", "summary"],
    degradationReason: typeof input.degradationReason === "string" ? input.degradationReason : null
  };
}

function normalizeArticle(value: unknown): TodayArticleSelection {
  const input = record(value);
  const canonicalUrl = text(input.canonicalUrl);
  const url = new URL(canonicalUrl);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Today article URL is invalid.");
  return {
    articleId: text(input.articleId),
    title: text(input.title),
    sourceTitle: text(input.sourceTitle),
    canonicalUrl: url.toString(),
    estimatedMinutes: positiveInteger(input.estimatedMinutes, 6),
    contentWordCoverage: finiteNumber(input.contentWordCoverage, 0),
    targetWordIds: stringArray(input.targetWordIds),
    selectionReasons: stringArray(input.selectionReasons)
  };
}

function normalizeQuestion(value: unknown): ContextQuestion {
  const input = record(value);
  const choices = stringArray(input.choices);
  const correctChoice = text(input.correctChoice);
  if (!choices.includes(correctChoice)) throw new Error("Context question choices must include the correct answer.");
  return {
    id: text(input.id),
    articleId: text(input.articleId),
    sentence: text(input.sentence),
    targetWordId: text(input.targetWordId),
    prompt: text(input.prompt),
    choices,
    correctChoice
  };
}

function normalizeMix(value: unknown): TodayPlan["mix"] {
  const input = record(value);
  return {
    review: finiteNumber(input.review, 40),
    newVocabulary: finiteNumber(input.newVocabulary, 30),
    reading: finiteNumber(input.reading, 20),
    sentence: finiteNumber(input.sentence, 10)
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown, fallback = ""): string { return typeof value === "string" && value ? value : fallback; }
function stringArray(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function finiteNumber(value: unknown, fallback: number): number { return typeof value === "number" && Number.isFinite(value) ? value : fallback; }
function positiveInteger(value: unknown, fallback: number): number { return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback; }
function nonnegativeInteger(value: unknown, fallback: number): number { return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback; }
function normalizeStatus(value: unknown): TodayPlanStatus { return value === "active" || value === "complete" ? value : "not-started"; }
