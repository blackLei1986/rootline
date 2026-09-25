import { buildSummaryTokens, type DailyReadingHighlightMatch } from "@/lib/reading/daily-reading-highlights";
import type { WeakReadingEvent } from "@/lib/repositories/supabase/reading-reinforcement-repository";
import type { DailyReadingRecommendation } from "@/types/reading-recommendations";
import type { ProductionVocabularyEntry } from "@/types/vocabulary";
import type { WordProgress } from "@/types/progress";
import type { DailyReadingArticleWord } from "@/components/reading/daily-reading-article";
import { buildReinforcementQuestions } from "@/lib/reading/reinforcement/questions";
import type { PublicQuestion, PublicSession, ReadingSessionRow } from "@/lib/reading/reinforcement/types";
import type { CommitReadingAnswerInput, CommitReadingAnswerResult } from "@/lib/reading/reinforcement/types";
import { createWordProgress } from "@/lib/storage";
import { applyReadingResult } from "@/lib/reading/reinforcement/progress";
import { gradeReinforcementAnswer } from "@/lib/reading/reinforcement/questions";

export type ReadingEvidenceAction = "exposure" | "detail-open";

export interface CurrentReadingArticle {
  article: DailyReadingRecommendation;
  learningDate: string;
}

export interface ReinforcementAvailability {
  availableCount: number;
  sessionId: string | null;
  status: "not-started" | "active" | "complete";
}

export interface ReadingReinforcementDependencies {
  getCurrentArticle(userId: string, articleId: string): Promise<CurrentReadingArticle | null>;
  getVocabulary(): Promise<ProductionVocabularyEntry[]>;
  getArticleState?(userId: string, articleId: string): Promise<{openedAt: string | null; completedAt: string | null} | null>;
  getWordStates?(userId: string, wordIds: string[]): Promise<Record<string, WordProgress>>;
  getOpenedWordIds?(userId: string, articleId: string): Promise<string[]>;
  repository: {
    appendWeakEvidence(userId: string, event: WeakReadingEvent): Promise<boolean>;
    getByArticle?(userId: string, articleId: string): Promise<ReadingSessionRow | null>;
    getById?(userId: string, sessionId: string): Promise<ReadingSessionRow | null>;
    createOnce?(userId: string, articleId: string, learningDate: string, questions: ReadingSessionRow["questions"]): Promise<ReadingSessionRow>;
    getWordState?(userId: string, wordId: string): Promise<WordProgress | null>;
    commitAnswer?(input: CommitReadingAnswerInput): Promise<CommitReadingAnswerResult>;
  };
  now?: () => Date;
}

export function createReadingReinforcementService(dependencies: ReadingReinforcementDependencies) {
  async function buildAvailableQuestions(userId: string, articleId: string, current: CurrentReadingArticle) {
    const vocabulary = await dependencies.getVocabulary();
    const ids = [...new Set([...current.article.matchedTodayWordIds,
      ...(current.article.matchedRecent7DayWordIds ?? current.article.matchedRecentWordIds)])];
    const byId = new Map(vocabulary.map((entry) => [entry.id, entry]));
    const words: DailyReadingArticleWord[] = ids.flatMap((id) => {
      const entry = byId.get(id);
      if (!entry) return [];
      return [{wordId: id, word: entry.word, lemma: entry.lemma, surfaceForms: entry.surfaceForms,
        level: current.article.matchedTodayWordIds.includes(id) ? "today" as const : "recent-7-day" as const,
        coreMeaningZh: entry.coreMeaningZh, coreDefinitionEn: entry.coreDefinitionEn,
        morphology: null}];
    });
    const summary = current.article.summary ?? "";
    const summaryTokens = buildSummaryTokens(summary, words, vocabulary);
    const [progressByWordId, openedWordIds] = await Promise.all([
      dependencies.getWordStates?.(userId, ids) ?? {},
      dependencies.getOpenedWordIds?.(userId, articleId) ?? []
    ]);
    return buildReinforcementQuestions({
      articleId, summary, summaryTokens, words,
      todayWordIds: current.article.matchedTodayWordIds,
      recentWordIds: current.article.matchedRecent7DayWordIds ?? current.article.matchedRecentWordIds,
      openedWordIds, progressByWordId
    });
  }

  return {
    async getAvailability(userId: string, articleId: string): Promise<ReinforcementAvailability | null> {
      const existing = await dependencies.repository.getByArticle?.(userId, articleId);
      if (existing) return {availableCount: existing.questions.length, sessionId: existing.id, status: existing.status};
      const current = await dependencies.getCurrentArticle(userId, articleId);
      if (!current) return null;
      const questions = await buildAvailableQuestions(userId, articleId, current);
      return {availableCount: questions.length, sessionId: null, status: "not-started"};
    },

    async submitAnswer(userId: string, sessionId: string, questionId: string, answer: string): Promise<
      {session: PublicSession; wordState: WordProgress | null} | "conflict" | null
    > {
      if (!dependencies.repository.getById || !dependencies.repository.getWordState || !dependencies.repository.commitAnswer) {
        throw new Error("Reading answer persistence is unavailable.");
      }
      const row = await dependencies.repository.getById(userId, sessionId);
      if (!row) return null;
      const previous = row.outcomes.find((outcome) => outcome.questionId === questionId);
      if (previous) return {session: toPublicSession(row), wordState: await dependencies.repository.getWordState(userId, previous.wordId)};
      const question = row.questions[row.cursor];
      if (!question || row.status !== "active" || question.id !== questionId) throw new InvalidReadingQuestionError();

      async function attempt(currentRow: ReadingSessionRow): Promise<CommitReadingAnswerResult> {
        const currentQuestion = currentRow.questions[currentRow.cursor];
        if (!currentQuestion || currentQuestion.id !== questionId) throw new InvalidReadingQuestionError();
        const stored = await dependencies.repository.getWordState!(userId, currentQuestion.wordId);
        const currentWord = {...createWordProgress(currentQuestion.wordId), ...stored};
        const correct = gradeReinforcementAnswer(currentQuestion, answer);
        const progress = applyReadingResult(currentWord, currentQuestion, correct, dependencies.now?.() ?? new Date());
        return dependencies.repository.commitAnswer!({
          userId, sessionId, questionId, expectedSessionRevision: currentRow.revision,
          wordId: currentQuestion.wordId, expectedReadingRevision: currentWord.readingRevision ?? 0,
          eventId: `reading-answer:${sessionId}:${questionId}`,
          submittedAnswer: answer, correct, eventType: progress.eventType,
          eventPayload: progress.metadata, nextWordState: progress.nextState
        });
      }

      let result = await attempt(row);
      if (result.kind === "conflict") {
        const latest = await dependencies.repository.getById(userId, sessionId);
        if (!latest) return null;
        const saved = latest.outcomes.find((outcome) => outcome.questionId === questionId);
        if (saved) return {session: toPublicSession(latest), wordState: await dependencies.repository.getWordState(userId, saved.wordId)};
        if (latest.questions[latest.cursor]?.id !== questionId) return "conflict";
        result = await attempt(latest);
      }
      if (result.kind === "conflict") return "conflict";
      const wordState = result.kind === "accepted" ? result.wordState
        : await dependencies.repository.getWordState(userId, question.wordId);
      return {session: toPublicSession(result.row), wordState};
    },

    async startOrResume(userId: string, articleId: string): Promise<
      {kind: "session"; session: PublicSession} | {kind: "empty"; availableCount: 0} | {kind: "not-found"} | {kind: "unfinished"}
    > {
      const existing = await dependencies.repository.getByArticle?.(userId, articleId);
      if (existing) return {kind: "session", session: toPublicSession(existing)};
      const current = await dependencies.getCurrentArticle(userId, articleId);
      if (!current) return {kind: "not-found"};
      const articleState = await dependencies.getArticleState?.(userId, articleId);
      if (!articleState?.completedAt) return {kind: "unfinished"};
      const questions = await buildAvailableQuestions(userId, articleId, current);
      if (questions.length === 0) return {kind: "empty", availableCount: 0};
      if (!dependencies.repository.createOnce) throw new Error("Reading session persistence is unavailable.");
      const row = await dependencies.repository.createOnce(userId, articleId, current.learningDate, questions);
      return {kind: "session", session: toPublicSession(row)};
    },

    async getOwnedSession(userId: string, sessionId: string): Promise<PublicSession | null> {
      const row = await dependencies.repository.getById?.(userId, sessionId);
      return row ? toPublicSession(row) : null;
    },

    async recordReadingEvidence(
      userId: string, articleId: string, action: ReadingEvidenceAction, wordId: string
    ): Promise<{saved: boolean} | null> {
      const current = await dependencies.getCurrentArticle(userId, articleId);
      if (!current || !current.article.summary?.trim()) return null;
      const article = current.article;
      const summary = article.summary;
      if (!summary) return null;
      const allowed = new Set([...article.matchedTodayWordIds,
        ...(article.matchedRecent7DayWordIds ?? article.matchedRecentWordIds)]);
      if (!allowed.has(wordId)) return null;
      const vocabulary = await dependencies.getVocabulary();
      const byId = new Map(vocabulary.map((entry) => [entry.id, entry]));
      const matches: DailyReadingHighlightMatch[] = [...allowed].flatMap((id) => {
        const entry = byId.get(id);
        return entry ? [{wordId: id, lemma: entry.lemma, surfaceForms: entry.surfaceForms,
          level: article.matchedTodayWordIds.includes(id) ? "today" as const : "recent-7-day" as const}] : [];
      });
      const tokens = buildSummaryTokens(summary, matches, vocabulary);
      if (!tokens.some((token) => token.wordId === wordId)) return null;
      const event: WeakReadingEvent = {
        id: `${action === "exposure" ? "reading-exposure" : "reading-lookup"}:${articleId}:${wordId}`,
        type: action === "exposure" ? "reading_encounter" : "reading_lookup",
        articleId, wordId, occurredAt: (dependencies.now?.() ?? new Date()).toISOString()
      };
      return {saved: await dependencies.repository.appendWeakEvidence(userId, event)};
    }
  };
}

export class InvalidReadingQuestionError extends Error {
  constructor() { super("INVALID_READING_QUESTION"); }
}

export function toPublicSession(row: ReadingSessionRow): PublicSession {
  const question = row.questions[row.cursor];
  const currentQuestion: PublicQuestion | null = question ? {
    id: question.id, wordId: question.wordId, type: question.type,
    context: question.context, prompt: question.prompt,
    ...(question.choices ? {choices: question.choices} : {}),
    ...(question.explanation ? {explanation: question.explanation} : {})
  } : null;
  return {
    id: row.id, articleId: row.article_id, articleLabel: "文章语境词汇",
    learningDate: row.learning_date, status: row.status, cursor: row.cursor,
    total: row.questions.length, practiced: row.outcomes.length,
    correct: row.outcomes.filter((outcome) => outcome.correct).length,
    currentQuestion, outcomes: row.outcomes
  };
}
